"""Agent worker — LangGraph StateGraph orchestrating the full SDLC workflow."""

import asyncio
import logging
from datetime import datetime, timezone
from typing import TypedDict, Optional

from langgraph.graph import StateGraph, END

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import async_session
from app.core.encryption import decrypt
from app.models.models import Task, Run, Connection, Skill, User
from app.services.git import GitService
from app.services.github import GitHubService
from app.agent.tools import AGENT_TOOLS
from app.agent.tool_handlers import ToolExecutor
from app.agent.loop import run_agent_loop
from app.agent.workspace import create_workspace, cleanup_workspace
from app.agent.prompts import (
    build_plan_prompt, build_develop_prompt, build_review_prompt,
    build_commit_pr_prompt, build_pipeline_prompt,
)
from app.agent import progress as prog

logger = logging.getLogger(__name__)


# ── LangGraph State ─────────────────────────────────────────────────────────

class WorkflowState(TypedDict, total=False):
    task_id: str
    user_id: str
    run_id: str
    title: str
    body: str
    repo_owner: str
    repo_name: str
    issue_number: int
    github_url: str
    github_token: str
    claude_key: str
    owner: str
    develop_skill: str
    review_skill: str
    plan_skill: str
    github_username: str
    github_email: str
    workspace_path: str
    branch_name: str
    plan_text: str
    pr_number: Optional[int]
    pr_url: str
    plan_gate_status: str
    merge_gate_status: str
    status: str
    error: str


# ── Node Functions ───────────────────────────────────────────────────────────

async def setup_node(state: WorkflowState) -> WorkflowState:
    """Load task, connections, skills, clone repo, create branch."""
    task_id = state["task_id"]
    user_id = state["user_id"]

    async with async_session() as db:
        task = await db.get(Task, task_id)
        if not task:
            return {**state, "status": "error", "error": "Task not found"}

        # Load connections by user_id
        result = await db.execute(select(Connection).where(Connection.user_id == user_id))
        connections = result.scalars().all()
        github_token = ""
        claude_key = ""
        owner = ""
        for conn in connections:
            if conn.type == "github":
                github_token = decrypt(conn.credentials_encrypted)
                owner = (conn.extra_config or {}).get("owner", "")
            elif conn.type == "claude_api":
                claude_key = decrypt(conn.credentials_encrypted)

        if not github_token or not claude_key:
            return {**state, "status": "error", "error": "GitHub or Claude connection missing"}

        # Load skills by user_id
        skill_result = await db.execute(
            select(Skill).where(Skill.user_id == user_id, Skill.is_active == True)
        )
        skills = skill_result.scalars().all()

        def find_skill(skill_type: str) -> str:
            for s in skills:
                if s.skill_type == skill_type and s.repository == task.repo_name:
                    return s.content
            for s in skills:
                if s.skill_type == skill_type and not s.repository:
                    return s.content
            return ""

        # Git identity
        user = await db.get(User, user_id)
        gh_username = user.github_username or "" if user else ""
        gh_email = user.github_email or "" if user else ""

        # Use existing Run (created by the API route)
        run_id = state.get("run_id", "")
        if not run_id:
            return {**state, "status": "error", "error": "No run_id provided"}

        task.status = "in_progress"
        task.run_id = run_id
        await db.commit()

    # Workspace
    workspace = create_workspace(task_id)
    branch = f"devagent/task-{task.github_issue_number}"

    git = GitService(pat=github_token)
    github = GitHubService(token=github_token)
    clone_url = github.get_clone_url(task.repo_owner, task.repo_name)

    logger.info(f"Setup: cloning {task.repo_owner}/{task.repo_name} to {workspace}")
    await prog.update_run(run_id, workspace_path=workspace, branch_name=branch, current_step="setup")

    rc, msg = await git.clone(clone_url, workspace)
    logger.info(f"Setup: clone result rc={rc} msg={msg[:200]}")
    if rc != 0:
        return {**state, "run_id": run_id, "status": "error", "error": f"Clone failed: {msg}"}

    for key, val in [("user.name", gh_username), ("user.email", gh_email)]:
        if val:
            proc = await asyncio.create_subprocess_exec(
                "git", "config", key, val, cwd=workspace,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            await proc.communicate()

    rc, msg = await git.checkout_new_branch(workspace, branch)
    if rc != 0:
        return {**state, "run_id": run_id, "status": "error", "error": f"Branch failed: {msg}"}

    return {
        **state, "run_id": run_id,
        "title": task.title, "body": task.body,
        "repo_owner": task.repo_owner, "repo_name": task.repo_name,
        "issue_number": task.github_issue_number, "github_url": task.github_url,
        "github_token": github_token, "claude_key": claude_key, "owner": owner,
        "develop_skill": find_skill("develop"), "review_skill": find_skill("review"),
        "plan_skill": find_skill("plan"),
        "github_username": gh_username, "github_email": gh_email,
        "workspace_path": workspace, "branch_name": branch, "status": "running",
    }


async def plan_node(state: WorkflowState) -> WorkflowState:
    run_id = state["run_id"]
    await prog.update_run(run_id, current_step="plan")
    await prog.create_run_step(run_id, "plan")
    await _update_task_status(state["task_id"], "ready")

    plan_skill = state.get("plan_skill", "")
    skill_msg = f"Using plan skill instructions" if plan_skill else "No plan skill configured — using default AI reasoning"
    await prog.append_reasoning(run_id, "plan", {"content": f"🔧 {skill_msg}", "timestamp": datetime.now(timezone.utc).isoformat()})

    system, user_msg = build_plan_prompt(state["title"], state["body"], state.get("plan_skill", ""))
    tools = [t for t in AGENT_TOOLS if t["name"] in ("read_file", "list_files", "search_files")]

    result = await run_agent_loop(
        api_key=state["claude_key"], model="claude-sonnet-4-6",
        system_prompt=system, user_message=user_msg,
        tools=tools, tool_executor=_make_executor(state),
        on_progress=_make_cb(run_id, "plan"),
    )

    plan_text = result.get("final_response", "")
    await prog.complete_step(run_id, "plan",
                             status="completed" if result["status"] == "completed" else "failed")
    await prog.update_step(run_id, "plan", output={"plan": plan_text})
    await _update_tokens(run_id, result)

    if result["status"] != "completed":
        return {**state, "status": "error", "error": "Plan step failed"}
    return {**state, "plan_text": plan_text}


async def gate_plan_node(state: WorkflowState) -> WorkflowState:
    run_id = state["run_id"]
    await prog.update_run(run_id, status="awaiting_gate", current_step="plan")
    gate_id = await prog.create_gate(run_id, "plan", "plan_approval", {"plan": state["plan_text"]})
    status = await _wait_for_gate(gate_id)
    await prog.update_run(run_id, status="running")
    return {**state, "plan_gate_status": status}


async def develop_node(state: WorkflowState) -> WorkflowState:
    run_id = state["run_id"]
    await prog.update_run(run_id, current_step="develop")
    await prog.create_run_step(run_id, "develop")
    await _update_task_status(state["task_id"], "in_progress")

    develop_skill = state.get("develop_skill", "")
    skill_msg = f"Using develop skill instructions for coding" if develop_skill else "No develop skill configured — using default AI reasoning"
    await prog.append_reasoning(run_id, "develop", {"content": f"🔧 {skill_msg}", "timestamp": datetime.now(timezone.utc).isoformat()})

    system, user_msg = build_develop_prompt(state["title"], state["plan_text"], state.get("develop_skill", ""))
    tools = [t for t in AGENT_TOOLS if t["name"] in (
        "read_file", "write_file", "list_files", "search_files", "run_command",
    )]

    result = await run_agent_loop(
        api_key=state["claude_key"], model="claude-sonnet-4-6",
        system_prompt=system, user_message=user_msg,
        tools=tools, tool_executor=_make_executor(state),
        on_progress=_make_cb(run_id, "develop"),
    )

    await prog.complete_step(run_id, "develop",
                             status="completed" if result["status"] == "completed" else "failed")
    await _update_tokens(run_id, result)

    if result["status"] != "completed":
        return {**state, "status": "error", "error": "Develop step failed"}
    return state


async def review_node(state: WorkflowState) -> WorkflowState:
    run_id = state["run_id"]
    await prog.update_run(run_id, current_step="review")
    await prog.create_run_step(run_id, "review")
    await _update_task_status(state["task_id"], "in_review")

    review_skill = state.get("review_skill", "")
    skill_msg = f"Using review skill instructions for code review" if review_skill else "No review skill configured — using default AI reasoning"
    await prog.append_reasoning(run_id, "review", {"content": f"🔧 {skill_msg}", "timestamp": datetime.now(timezone.utc).isoformat()})

    system, user_msg = build_review_prompt(state["title"], state.get("review_skill", ""))
    tools = [t for t in AGENT_TOOLS if t["name"] in (
        "read_file", "write_file", "list_files", "search_files", "run_command",
    )]

    result = await run_agent_loop(
        api_key=state["claude_key"], model="claude-sonnet-4-6",
        system_prompt=system, user_message=user_msg,
        tools=tools, tool_executor=_make_executor(state),
        on_progress=_make_cb(run_id, "review"),
    )

    await prog.complete_step(run_id, "review",
                             status="completed" if result["status"] == "completed" else "failed")
    await _update_tokens(run_id, result)
    return state


async def commit_pr_node(state: WorkflowState) -> WorkflowState:
    run_id = state["run_id"]
    await prog.update_run(run_id, current_step="commit_pr")
    await prog.create_run_step(run_id, "commit_pr")

    system, user_msg = build_commit_pr_prompt(state["title"], state["issue_number"])
    tools = [t for t in AGENT_TOOLS if t["name"] in ("git_commit", "git_push", "create_pull_request")]

    executor = _make_executor(state)
    result = await run_agent_loop(
        api_key=state["claude_key"], model="claude-sonnet-4-6",
        system_prompt=system, user_message=user_msg,
        tools=tools, tool_executor=executor,
        on_progress=_make_cb(run_id, "commit_pr"),
    )

    pr_number = executor._pr_number
    pr_url = f"https://github.com/{state['repo_owner']}/{state['repo_name']}/pull/{pr_number}" if pr_number else ""

    await prog.complete_step(run_id, "commit_pr", status="completed" if pr_number else "failed")
    await prog.update_step(run_id, "commit_pr", output={"pr_url": pr_url, "pr_number": pr_number})
    await _update_tokens(run_id, result)

    if not pr_number:
        return {**state, "status": "error", "error": "PR not created"}
    return {**state, "pr_number": pr_number, "pr_url": pr_url}


async def gate_merge_node(state: WorkflowState) -> WorkflowState:
    run_id = state["run_id"]
    await prog.update_run(run_id, status="awaiting_gate", current_step="commit_pr")
    gate_id = await prog.create_gate(run_id, "commit_pr", "merge_approval", {
        "pr_url": state.get("pr_url", ""), "pr_number": state.get("pr_number"),
    })
    status = await _wait_for_gate(gate_id)
    await prog.update_run(run_id, status="running")
    return {**state, "merge_gate_status": status}


async def pipeline_node(state: WorkflowState) -> WorkflowState:
    run_id = state["run_id"]
    await prog.update_run(run_id, current_step="pipeline")
    await prog.create_run_step(run_id, "pipeline")

    github = GitHubService(token=state["github_token"])
    try:
        await github.merge_pull_request(state["repo_owner"], state["repo_name"], state["pr_number"])
    except Exception as e:
        logger.error(f"Merge failed: {e}")

    system, user_msg = build_pipeline_prompt()
    tools = [t for t in AGENT_TOOLS if t["name"] in ("get_pipeline_status", "close_issue")]

    result = await run_agent_loop(
        api_key=state["claude_key"], model="claude-sonnet-4-6",
        system_prompt=system, user_message=user_msg,
        tools=tools, tool_executor=_make_executor(state),
        on_progress=_make_cb(run_id, "pipeline"),
    )

    await prog.complete_step(run_id, "pipeline",
                             status="completed" if result["status"] == "completed" else "failed")
    await _update_tokens(run_id, result)
    return {**state, "status": "done"}


async def finish_node(state: WorkflowState) -> WorkflowState:
    run_id = state.get("run_id", "")
    task_id = state["task_id"]
    final_status = state.get("status", "done")
    error_msg = state.get("error", "")

    logger.info(f"Finish node: status={final_status} error={error_msg[:200]}")

    if run_id:
        await prog.update_run(
            run_id, status=final_status, current_step="done",
            finished_at=datetime.now(timezone.utc),
            error=error_msg,
            pr_urls_json=[state.get("pr_url", "")] if state.get("pr_url") else [],
        )
    await _update_task_status(task_id, final_status if final_status == "done" else "error")
    cleanup_workspace(task_id)
    return state


# ── Conditional Edges ────────────────────────────────────────────────────────

def check_setup(state: WorkflowState) -> str:
    return "error" if state.get("status") == "error" else "continue"

def check_plan(state: WorkflowState) -> str:
    return "error" if state.get("status") == "error" else "continue"

def check_plan_gate(state: WorkflowState) -> str:
    return "approved" if state.get("plan_gate_status") == "approved" else "rejected"

def check_develop(state: WorkflowState) -> str:
    return "error" if state.get("status") == "error" else "continue"

def check_commit(state: WorkflowState) -> str:
    return "error" if state.get("status") == "error" else "continue"

def check_merge_gate(state: WorkflowState) -> str:
    return "approved" if state.get("merge_gate_status") == "approved" else "rejected"


# ── Build the Graph ──────────────────────────────────────────────────────────

def build_workflow_graph() -> StateGraph:
    graph = StateGraph(WorkflowState)
    graph.add_node("setup", setup_node)
    graph.add_node("plan", plan_node)
    graph.add_node("gate_plan", gate_plan_node)
    graph.add_node("develop", develop_node)
    graph.add_node("review", review_node)
    graph.add_node("commit_pr", commit_pr_node)
    graph.add_node("gate_merge", gate_merge_node)
    graph.add_node("pipeline", pipeline_node)
    graph.add_node("finish", finish_node)

    graph.set_entry_point("setup")
    graph.add_conditional_edges("setup", check_setup, {"continue": "plan", "error": "finish"})
    graph.add_conditional_edges("plan", check_plan, {"continue": "gate_plan", "error": "finish"})
    graph.add_conditional_edges("gate_plan", check_plan_gate, {"approved": "develop", "rejected": "finish"})
    graph.add_conditional_edges("develop", check_develop, {"continue": "review", "error": "finish"})
    graph.add_edge("review", "commit_pr")
    graph.add_conditional_edges("commit_pr", check_commit, {"continue": "gate_merge", "error": "finish"})
    graph.add_conditional_edges("gate_merge", check_merge_gate, {"approved": "pipeline", "rejected": "finish"})
    graph.add_edge("pipeline", "finish")
    graph.add_edge("finish", END)
    return graph


# ── Entry Point ──────────────────────────────────────────────────────────────

async def start_agent_task(task_id: str, user_id: str, run_id: str) -> None:
    try:
        graph = build_workflow_graph()
        app = graph.compile()
        await app.ainvoke({"task_id": task_id, "user_id": user_id, "run_id": run_id, "status": "", "error": ""})
    except Exception as e:
        logger.exception(f"Agent workflow failed for task {task_id}: {e}")
        try:
            await prog.update_run(run_id, status="error", error=str(e)[:500],
                                  finished_at=datetime.now(timezone.utc))
            await _update_task_status(task_id, "error")
        except Exception:
            pass
        cleanup_workspace(task_id)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _make_executor(state: WorkflowState) -> ToolExecutor:
    return ToolExecutor(
        workspace_path=state["workspace_path"],
        git_service=GitService(pat=state["github_token"]),
        github_service=GitHubService(token=state["github_token"]),
        repo_owner=state["repo_owner"],
        repo_name=state["repo_name"],
        branch_name=state["branch_name"],
        issue_number=state["issue_number"],
    )

def _make_cb(run_id: str, step_name: str):
    async def callback(event_type: str, data: dict):
        if event_type == "tool_call":
            await prog.append_tool_call(run_id, step_name, data)
        elif event_type == "reasoning":
            await prog.append_reasoning(run_id, step_name, data)
        elif event_type == "tokens":
            await prog.update_step_tokens(run_id, step_name, data["input"], data["output"])
    return callback

async def _wait_for_gate(gate_id: str, timeout: int = 86400) -> str:
    elapsed = 0
    while elapsed < timeout:
        status = await prog.check_gate_status(gate_id)
        if status in ("approved", "rejected", "timed_out"):
            return status
        await asyncio.sleep(5)
        elapsed += 5
    return "timed_out"

async def _update_tokens(run_id: str, result: dict) -> None:
    async with async_session() as db:
        run = await db.get(Run, run_id)
        if run:
            run.total_input_tokens += result.get("total_tokens_in", 0)
            run.total_output_tokens += result.get("total_tokens_out", 0)
            await db.commit()

async def _update_task_status(task_id: str, status: str) -> None:
    async with async_session() as db:
        task = await db.get(Task, task_id)
        if task:
            task.status = status
            await db.commit()
