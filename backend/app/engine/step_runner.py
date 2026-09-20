"""
Step runner — executes a single workflow step by loading the mapped skill
and sending it to Claude with the appropriate context.
"""

from __future__ import annotations

import asyncio
from typing import Any, Callable, Awaitable

from app.engine.contracts import (
    ExecutionMode,
    RunContext,
    SkillBundle,
    StepResult,
    StepType,
    WorkflowStep,
    STEP_CONTRACTS,
)
from app.engine.skill_loader import load_skill
from app.services.claude import ClaudeService
from app.services.skills import SkillsService

MAX_RETRIES = 3

EventCallback = Callable[[dict[str, Any]], Awaitable[None]]


async def run_step(
    step: WorkflowStep,
    context: RunContext,
    skills_service: SkillsService,
    skills_path: str,
    skills_branch: str,
    emit: EventCallback,
) -> StepResult:
    """
    Execute a single workflow step.
    For per-task steps, this is called once per task by the executor.
    """
    contract = STEP_CONTRACTS[step.type]

    await emit({
        "type": "step_start",
        "step_order": step.order,
        "step_type": step.type.value,
        "skill_path": step.skill_path,
    })

    try:
        skill = await load_skill(skills_service, skills_path, step.skill_path, skills_branch)
    except Exception as e:
        return StepResult(
            step_order=step.order,
            step_type=step.type,
            status="error",
            error=f"Failed to load skill '{step.skill_path}': {e}",
        )

    model = step.model_override or skill.model or context.claude_model
    claude = ClaudeService(api_key=context.claude_api_key, model=model)

    await emit({
        "type": "skill_loaded",
        "step_order": step.order,
        "skill_name": skill.name,
        "model": model,
        "references_count": len(skill.references),
    })

    result = await _execute_skill(step, context, skill, claude, emit)

    await emit({
        "type": "step_done",
        "step_order": step.order,
        "step_type": step.type.value,
        "status": result.status,
        "tokens": result.tokens_used,
    })

    return result


async def _execute_skill(
    step: WorkflowStep,
    context: RunContext,
    skill: SkillBundle,
    claude: ClaudeService,
    emit: EventCallback,
) -> StepResult:
    """
    Execute the skill against Claude.
    Builds user prompt from context, sends to Claude with skill as system prompt.
    """
    system_prompt = skill.system_prompt
    user_prompt = _build_user_prompt(step.type, context)

    total_input = 0
    total_output = 0
    messages: list[dict] = [{"role": "user", "content": user_prompt}]

    try:
        text, usage = await claude.generate_with_history(
            system=system_prompt,
            messages=messages,
            max_tokens=16000,
        )
        total_input += usage["input_tokens"]
        total_output += usage["output_tokens"]

        output = _parse_step_output(step.type, text, context)

        context.total_input_tokens += total_input
        context.total_output_tokens += total_output

        return StepResult(
            step_order=step.order,
            step_type=step.type,
            status="completed",
            output=output,
            tokens_used={"input": total_input, "output": total_output},
        )

    except Exception as e:
        return StepResult(
            step_order=step.order,
            step_type=step.type,
            status="error",
            error=str(e),
            tokens_used={"input": total_input, "output": total_output},
        )


def _build_user_prompt(step_type: StepType, context: RunContext) -> str:
    """Build the user message for Claude based on step type and context."""
    if step_type == StepType.PLAN:
        return (
            f"Epic/Story: {context.epic_key}\n"
            f"Issue Tracker: {context.issue_tracker_type}\n"
            f"Config: {context.issue_tracker_config}\n\n"
            f"Execute the planning workflow for this epic. "
            f"Read the epic, detect application types, propose tasks, and create them."
        )

    elif step_type == StepType.DEV:
        current_task = context.task_ids[-1] if context.task_ids else context.epic_key
        return (
            f"Task Ticket: {current_task}\n"
            f"Issue Tracker: {context.issue_tracker_type}\n"
            f"Code Repo: {context.code_repo_type}\n"
            f"Repo Config: {context.code_repo_config}\n\n"
            f"Execute the development workflow for this ticket. "
            f"Read the ticket, generate plan, implement code, verify build, "
            f"run architecture review, and create a PR."
        )

    elif step_type == StepType.REVIEW:
        last_pr = context.pr_urls[-1] if context.pr_urls else "N/A"
        current_task = context.task_ids[-1] if context.task_ids else context.epic_key
        return (
            f"Task: {current_task}\n"
            f"PR URL: {last_pr}\n"
            f"Code Repo: {context.code_repo_type}\n"
            f"Repo Config: {context.code_repo_config}\n\n"
            f"Review the code in this PR for architecture compliance, "
            f"security issues, and coding standards. Return APPROVED or CHANGES_REQUIRED."
        )

    elif step_type == StepType.TEST:
        current_task = context.task_ids[-1] if context.task_ids else context.epic_key
        return (
            f"Task: {current_task}\n"
            f"Code Repo: {context.code_repo_type}\n"
            f"Repo Config: {context.code_repo_config}\n\n"
            f"Run the test suite for this code. Report PASS or FAIL with details."
        )

    return f"Execute workflow step for: {context.epic_key}"


def _parse_step_output(step_type: StepType, response: str, context: RunContext) -> dict[str, Any]:
    """Parse Claude's response into structured output based on step type."""
    if step_type == StepType.PLAN:
        import re
        ticket_pattern = re.compile(r"[A-Z]+-\d+")
        task_ids = ticket_pattern.findall(response)
        unique_tasks = [t for t in dict.fromkeys(task_ids) if t != context.epic_key]
        context.task_ids = unique_tasks
        return {"task_ids": unique_tasks, "raw_response": response}

    elif step_type == StepType.DEV:
        import re
        pr_pattern = re.compile(r"https?://[^\s]+/pullrequest/\d+|https?://github\.com/[^\s]+/pull/\d+")
        pr_urls = pr_pattern.findall(response)
        if pr_urls:
            context.pr_urls.extend(pr_urls)
        return {"pr_urls": pr_urls, "raw_response": response}

    elif step_type == StepType.REVIEW:
        approved = "APPROVED" in response.upper() and "CHANGES_REQUIRED" not in response.upper()
        return {"decision": "approved" if approved else "changes_required", "raw_response": response}

    elif step_type == StepType.TEST:
        passed = "PASS" in response.upper() and "FAIL" not in response.upper()
        return {"result": "pass" if passed else "fail", "raw_response": response}

    return {"raw_response": response}
