from typing import Optional, List
from datetime import datetime, timezone

import asyncio
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.encryption import decrypt
from app.models.models import User, Task, Run, RunStep, Gate, TaskLog, Connection
from app.api.deps import get_current_user

router = APIRouter()

GITHUB_API = "https://api.github.com"
GITHUB_GRAPHQL = "https://api.github.com/graphql"


# ── Schemas ──────────────────────────────────────────────────────────────────


class SourceItem(BaseModel):
    type: str  # repo | project
    name: str
    id: str


class SourcesResponse(BaseModel):
    repos: List[SourceItem]
    projects: List[SourceItem]


class PullRequest(BaseModel):
    source_type: str = "all"  # all | repo | project
    source_id: Optional[str] = None


class TaskResponse(BaseModel):
    id: str
    github_issue_number: int
    github_url: str
    github_status: str
    title: str
    body: str
    repo_owner: str
    repo_name: str
    status: str
    priority: Optional[str]
    labels: list
    story_points: Optional[int]
    due_date: Optional[str]
    github_created_at: Optional[str]
    pulled_at: str


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _get_github_connection(db: AsyncSession, user_id: str) -> tuple:
    """Get the user's GitHub PAT and owner. Raises clear errors if not configured."""
    result = await db.execute(
        select(Connection).where(
            Connection.user_id == user_id,
            Connection.type == "github",
        ).limit(1)
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(
            400,
            "GitHub is not configured. Go to Settings → Connections and add a GitHub connection first.",
        )

    token = decrypt(conn.credentials_encrypted)
    owner = (conn.extra_config or {}).get("owner", "")
    return token, owner


def _extract_priority(labels: list) -> Optional[str]:
    for label in labels:
        name = label.get("name", "").lower()
        if "priority" in name:
            return name.split(":")[-1].strip() if ":" in name else name
        if name in ("p0", "p1", "p2", "p3", "critical", "high", "medium", "low"):
            return name
    return None


def _extract_story_points(labels: list) -> Optional[int]:
    for label in labels:
        name = label.get("name", "").lower()
        for prefix in ("points:", "sp:", "story-points:", "size:"):
            if name.startswith(prefix):
                try:
                    return int(name.split(":")[-1].strip())
                except ValueError:
                    pass
    return None


def _task_to_response(task: Task) -> TaskResponse:
    return TaskResponse(
        id=task.id,
        github_issue_number=task.github_issue_number,
        github_url=task.github_url,
        github_status=task.github_status or "open",
        title=task.title,
        body=task.body,
        repo_owner=task.repo_owner,
        repo_name=task.repo_name,
        status=task.status,
        priority=task.priority,
        labels=task.labels,
        story_points=task.story_points,
        due_date=task.due_date,
        github_created_at=task.github_created_at,
        pulled_at=task.pulled_at.isoformat(),
    )


async def _fetch_projects_graphql(client: httpx.AsyncClient, headers: dict) -> List[SourceItem]:
    """Fetch user's GitHub Projects V2 via GraphQL."""
    query = """
    query {
      viewer {
        projectsV2(first: 20, orderBy: {field: UPDATED_AT, direction: DESC}) {
          nodes { id title number }
        }
      }
    }
    """
    try:
        resp = await client.post(GITHUB_GRAPHQL, headers=headers, json={"query": query})
        if resp.status_code != 200:
            return []
        data = resp.json().get("data", {})
        nodes = data.get("viewer", {}).get("projectsV2", {}).get("nodes", [])
        return [
            SourceItem(type="project", name=f"{n['title']}", id=n["id"])
            for n in nodes if n
        ]
    except Exception:
        return []


async def _fetch_project_issues(
    client: httpx.AsyncClient, headers: dict, project_id: str, username: str
) -> list:
    """Fetch backlog issues from a GitHub Project V2 via GraphQL."""
    query = """
    query($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          items(first: 100) {
            nodes {
              content {
                ... on Issue {
                  number
                  title
                  body
                  url
                  state
                  createdAt
                  assignees(first: 5) { nodes { login } }
                  labels(first: 10) { nodes { name color } }
                  milestone { dueOn }
                  repository { name owner { login } }
                }
              }
              fieldValues(first: 10) {
                nodes {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                    field { ... on ProjectV2SingleSelectField { name } }
                  }
                }
              }
            }
          }
        }
      }
    }
    """
    try:
        resp = await client.post(
            GITHUB_GRAPHQL, headers=headers,
            json={"query": query, "variables": {"projectId": project_id}},
        )
        if resp.status_code != 200:
            return []

        items = (resp.json().get("data", {}).get("node", {}).get("items", {}).get("nodes", []))
        issues = []
        for item in items:
            content = item.get("content")
            if not content or not content.get("number"):
                continue  # skip non-issue items (PRs, drafts)

            # Check if assigned to this user
            assignees = [a["login"].lower() for a in (content.get("assignees", {}).get("nodes", []))]
            if username.lower() not in assignees:
                continue

            # Check status — only include backlog/todo items
            status_value = ""
            for fv in (item.get("fieldValues", {}).get("nodes", [])):
                if isinstance(fv, dict) and fv.get("field", {}).get("name", "").lower() == "status":
                    status_value = (fv.get("name") or "").lower()
            # Skip items that are in progress or done
            if status_value in ("in progress", "in_progress", "doing", "done", "closed", "completed", "archived"):
                continue

            # Only open issues
            if content.get("state", "").upper() != "OPEN":
                continue

            repo = content.get("repository", {})
            labels_raw = content.get("labels", {}).get("nodes", [])
            issues.append({
                "number": content["number"],
                "title": content["title"],
                "body": (content.get("body") or "")[:5000],
                "html_url": content["url"],
                "repository_url": f"https://api.github.com/repos/{repo.get('owner', {}).get('login', '')}/{repo.get('name', '')}",
                "labels": [{"name": l["name"], "color": l.get("color", "")} for l in labels_raw],
                "milestone": content.get("milestone"),
                "created_at": content.get("createdAt"),
                "_repo_owner": repo.get("owner", {}).get("login", ""),
                "_repo_name": repo.get("name", ""),
            })
        return issues
    except Exception:
        return []


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/tasks/sources", response_model=SourcesResponse)
async def get_task_sources(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch repos and projects from GitHub for the source dropdown."""
    token, owner = await _get_github_connection(db, user.id)
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}

    async with httpx.AsyncClient() as client:
        # Fetch repos
        repos: list = []
        page = 1
        while page <= 3:  # cap at 150 repos
            resp = await client.get(
                f"{GITHUB_API}/user/repos", headers=headers,
                params={"per_page": 50, "page": page, "sort": "updated",
                        "affiliation": "owner,collaborator,organization_member"},
            )
            if resp.status_code != 200:
                break
            batch = resp.json()
            if not batch:
                break
            repos.extend(batch)
            if len(batch) < 50:
                break
            page += 1

        repo_items = [
            SourceItem(type="repo", name=r["full_name"], id=r["full_name"])
            for r in repos if not r.get("archived", False)
        ]

        # Fetch GitHub Projects V2
        project_items = await _fetch_projects_graphql(client, headers)

    return SourcesResponse(repos=repo_items, projects=project_items)


@router.post("/tasks/pull", response_model=List[TaskResponse])
async def pull_tasks(
    req: PullRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pull backlog issues from GitHub and store as tasks."""
    token, owner = await _get_github_connection(db, user.id)
    username = user.github_username or ""
    if not username:
        raise HTTPException(400, "Set your GitHub username in Settings → Profile first.")

    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}

    async with httpx.AsyncClient() as client:
        if req.source_type == "project" and req.source_id:
            # Fetch from GitHub Project V2 (backlog only)
            issues = await _fetch_project_issues(client, headers, req.source_id, username)
        else:
            # Fetch from Search API — open issues only (backlog)
            if req.source_type == "repo" and req.source_id:
                query = f"assignee:{username} is:open is:issue repo:{req.source_id}"
            elif owner:
                query = f"assignee:{username} is:open is:issue org:{owner}"
            else:
                query = f"assignee:{username} is:open is:issue"

            # Exclude in-progress labels
            query += ' -label:"in progress" -label:"doing" -label:"wip"'

            resp = await client.get(
                f"{GITHUB_API}/search/issues", headers=headers,
                params={"q": query, "per_page": 100, "sort": "updated", "order": "desc"},
            )
            if resp.status_code != 200:
                raise HTTPException(502, f"GitHub API error: {resp.status_code}")
            issues = resp.json().get("items", [])

    # Upsert tasks — skip tasks already in_progress/done in our DB
    pulled = []
    for issue in issues:
        # Extract repo info
        if "_repo_owner" in issue:
            r_owner = issue["_repo_owner"]
            r_name = issue["_repo_name"]
        else:
            repo_url = issue.get("repository_url", "")
            parts = repo_url.rstrip("/").split("/")
            r_owner = parts[-2] if len(parts) >= 2 else owner
            r_name = parts[-1] if len(parts) >= 1 else ""

        labels_raw = issue.get("labels", [])
        milestone = issue.get("milestone") or {}

        # Check if task already exists
        existing = await db.execute(
            select(Task).where(
                Task.user_id == user.id,
                Task.repo_owner == r_owner,
                Task.repo_name == r_name,
                Task.github_issue_number == issue["number"],
            )
        )
        task = existing.scalar_one_or_none()

        if task:
            # Skip if actively running or already done
            if task.status in ("in_progress", "done"):
                continue
            # Reset failed/error/interrupted/ready tasks back to backlog for retry
            if task.status in ("error", "failed", "interrupted", "ready", "in_review"):
                task.status = "backlog"
                task.run_id = None
            # Update task details from GitHub
            task.title = issue.get("title", task.title)
            task.body = (issue.get("body") or "")[:5000]
            task.github_url = issue.get("html_url", task.github_url)
            task.github_status = issue.get("state", task.github_status or "open")
            task.labels = [{"name": l["name"], "color": l.get("color", "")} for l in labels_raw]
            task.priority = _extract_priority(labels_raw)
            task.story_points = _extract_story_points(labels_raw)
            task.due_date = milestone.get("due_on") if milestone else task.due_date
            task.github_created_at = issue.get("created_at") or issue.get("createdAt")
        else:
            task = Task(
                user_id=user.id,
                github_issue_number=issue["number"],
                github_url=issue.get("html_url", issue.get("url", "")),
                github_status=issue.get("state", "open"),
                title=issue.get("title", ""),
                body=(issue.get("body") or "")[:5000],
                repo_owner=r_owner,
                repo_name=r_name,
                labels=[{"name": l["name"], "color": l.get("color", "")} for l in labels_raw],
                priority=_extract_priority(labels_raw),
                story_points=_extract_story_points(labels_raw),
                due_date=milestone.get("due_on") if milestone else None,
                github_created_at=issue.get("created_at") or issue.get("createdAt"),
            )
            db.add(task)

        pulled.append(task)

    await db.commit()
    for t in pulled:
        await db.refresh(t)

    return [_task_to_response(t) for t in pulled]


class ActiveTaskResponse(BaseModel):
    id: str
    github_issue_number: int
    title: str
    repo_name: str
    status: str
    run_status: str
    current_step: str
    started_at: Optional[str]


@router.get("/tasks/active", response_model=List[ActiveTaskResponse])
async def get_active_tasks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get tasks with active runs (running or awaiting_gate) from DB."""
    result = await db.execute(
        select(Task, Run)
        .join(Run, Run.id == Task.run_id)
        .where(
            Task.user_id == user.id,
            Run.status.in_(["running", "awaiting_gate"]),
        )
        .order_by(Run.started_at.desc())
    )
    items = []
    for task, run in result.all():
        items.append(ActiveTaskResponse(
            id=task.id,
            github_issue_number=task.github_issue_number,
            title=task.title,
            repo_name=task.repo_name,
            status=task.status,
            run_status=run.status,
            current_step=run.current_step,
            started_at=run.started_at.isoformat() if run.started_at else None,
        ))
    return items


@router.get("/tasks", response_model=List[TaskResponse])
async def list_tasks(
    status: Optional[str] = None,
    exclude_status: Optional[str] = None,
    repo: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Task).where(Task.user_id == user.id)
    if status:
        query = query.where(Task.status == status)
    if exclude_status:
        query = query.where(Task.status != exclude_status)
    if repo:
        query = query.where(Task.repo_name == repo)
    query = query.order_by(Task.pulled_at.desc())

    result = await db.execute(query)
    tasks = result.scalars().all()
    return [_task_to_response(t) for t in tasks]


# ── Agent Start / Progress / Gate endpoints ──────────────────────────────────


class StartTaskResponse(BaseModel):
    run_id: str
    status: str


class TaskProgressResponse(BaseModel):
    task: TaskResponse
    run: Optional[dict] = None
    steps: list = []
    pending_gate: Optional[dict] = None
    gates: list = []
    logs: list = []


class GateActionResponse(BaseModel):
    status: str


@router.post("/tasks/{task_id}/start", response_model=StartTaskResponse)
async def start_task(
    task_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start the AI agent workflow for a task."""
    task = await db.get(Task, task_id)
    if not task or task.user_id != user.id:
        raise HTTPException(404, "Task not found")
    if task.status != "backlog":
        raise HTTPException(400, f"Task is already '{task.status}'. Only 'backlog' tasks can be started.")

    # Verify connections exist
    conns = await db.execute(select(Connection).where(Connection.user_id == user.id))
    connections = conns.scalars().all()
    has_github = any(c.type == "github" for c in connections)
    has_claude = any(c.type == "claude_api" for c in connections)
    if not has_github:
        raise HTTPException(400, "GitHub connection not configured. Go to Settings → Connections.")
    if not has_claude:
        raise HTTPException(400, "Claude API connection not configured. Go to Settings → Connections.")
    if not user.github_username:
        raise HTTPException(400, "GitHub username not set. Go to Settings → Profile.")

    # Create the run record
    run = Run(
        user_id=user.id,
        task_id=task_id,
        status="running",
        model="claude-sonnet-4-6",
    )
    db.add(run)
    task.status = "in_progress"
    task.run_id = run.id
    await db.commit()
    run_id = run.id

    # Spawn background worker — wrapped so DB doesn't get orphaned on failure
    try:
        from app.agent.worker import start_agent_task
        asyncio.create_task(start_agent_task(task_id, user.id, run_id))
    except Exception as e:
        run.status = "error"
        run.error = f"Failed to start agent: {str(e)[:500]}"
        task.status = "error"
        await db.commit()
        return StartTaskResponse(run_id=run_id, status="error")

    return StartTaskResponse(run_id=run_id, status="started")


@router.get("/tasks/{task_id}/progress", response_model=TaskProgressResponse)
async def get_task_progress(
    task_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get live progress of a task's agent workflow."""
    task = await db.get(Task, task_id)
    if not task or task.user_id != user.id:
        raise HTTPException(404, "Task not found")

    task_data = _task_to_response(task)
    run_data = None
    steps_data = []
    gate_data = None
    gates_list = []

    if task.run_id:
        run = await db.get(Run, task.run_id)
        if run:
            run_data = {
                "id": run.id,
                "status": run.status,
                "current_step": run.current_step,
                "branch_name": run.branch_name,
                "started_at": run.started_at.isoformat() if run.started_at else None,
                "finished_at": run.finished_at.isoformat() if run.finished_at else None,
                "total_input_tokens": run.total_input_tokens,
                "total_output_tokens": run.total_output_tokens,
                "error": run.error,
            }

            # Load steps
            result = await db.execute(
                select(RunStep).where(RunStep.run_id == run.id).order_by(RunStep.started_at)
            )
            for step in result.scalars().all():
                steps_data.append({
                    "id": step.id,
                    "step_name": step.step_name,
                    "status": step.status,
                    "started_at": step.started_at.isoformat() if step.started_at else None,
                    "completed_at": step.completed_at.isoformat() if step.completed_at else None,
                    "duration_seconds": step.duration_seconds,
                    "tool_calls": step.tool_calls or [],
                    "reasoning": step.reasoning or [],
                    "tokens_in": step.tokens_in,
                    "tokens_out": step.tokens_out,
                    "error": step.error,
                })

            # Load pending gate
            gate_result = await db.execute(
                select(Gate).where(Gate.run_id == run.id, Gate.status == "pending")
            )
            gate = gate_result.scalar_one_or_none()
            if gate:
                gate_data = {
                    "id": gate.id,
                    "gate_type": gate.gate_type,
                    "step_name": gate.step_name,
                    "status": gate.status,
                    "payload": gate.payload,
                    "created_at": gate.created_at.isoformat() if gate.created_at else None,
                }

            # Load all gates (for step detail view)
            all_gates_result = await db.execute(
                select(Gate).where(Gate.run_id == run.id).order_by(Gate.created_at)
            )
            gates_list = [
                {
                    "id": g.id,
                    "gate_type": g.gate_type,
                    "step_name": g.step_name,
                    "status": g.status,
                    "payload": g.payload,
                    "created_at": g.created_at.isoformat() if g.created_at else None,
                    "resolved_at": g.resolved_at.isoformat() if g.resolved_at else None,
                }
                for g in all_gates_result.scalars().all()
            ]

    # Load logs
    logs_list = []
    if task.run_id:
        logs_result = await db.execute(
            select(TaskLog).where(TaskLog.task_id == task_id, TaskLog.run_id == task.run_id)
            .order_by(TaskLog.created_at)
        )
        logs_list = [
            {
                "id": log.id,
                "level": log.level,
                "message": log.message,
                "step_name": log.step_name,
                "details": log.details,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs_result.scalars().all()
        ]

    return TaskProgressResponse(
        task=task_data,
        run=run_data,
        steps=steps_data,
        pending_gate=gate_data,
        gates=gates_list if task.run_id else [],
        logs=logs_list,
    )


@router.post("/runs/{run_id}/gates/{gate_id}/approve", response_model=GateActionResponse)
async def approve_gate(
    run_id: str,
    gate_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve a pending gate to continue the agent workflow."""
    run = await db.get(Run, run_id)
    if not run or run.user_id != user.id:
        raise HTTPException(404, "Run not found")
    gate = await db.get(Gate, gate_id)
    if not gate or gate.run_id != run_id:
        raise HTTPException(404, "Gate not found")
    if gate.status != "pending":
        raise HTTPException(400, f"Gate is already '{gate.status}'")

    gate.status = "approved"
    gate.resolved_at = datetime.now(timezone.utc)
    gate.developer_response = "approved"
    await db.commit()
    return GateActionResponse(status="approved")


@router.post("/runs/{run_id}/gates/{gate_id}/reject", response_model=GateActionResponse)
async def reject_gate(
    run_id: str,
    gate_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reject a pending gate to stop the agent workflow."""
    run = await db.get(Run, run_id)
    if not run or run.user_id != user.id:
        raise HTTPException(404, "Run not found")
    gate = await db.get(Gate, gate_id)
    if not gate or gate.run_id != run_id:
        raise HTTPException(404, "Gate not found")
    if gate.status != "pending":
        raise HTTPException(400, f"Gate is already '{gate.status}'")

    gate.status = "rejected"
    gate.resolved_at = datetime.now(timezone.utc)
    gate.developer_response = "rejected"
    await db.commit()
    return GateActionResponse(status="rejected")


@router.post("/tasks/{task_id}/cancel")
async def cancel_task(
    task_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a running task."""
    task = await db.get(Task, task_id)
    if not task or task.user_id != user.id:
        raise HTTPException(404, "Task not found")
    if task.status in ("done", "backlog"):
        raise HTTPException(400, f"Task is '{task.status}', cannot cancel")

    task.status = "interrupted"
    if task.run_id:
        run = await db.get(Run, task.run_id)
        if run and run.status in ("running", "awaiting_gate"):
            run.status = "interrupted"
            run.finished_at = datetime.now(timezone.utc)
            run.error = "Cancelled by user"
    await db.commit()
    return {"status": "interrupted"}
