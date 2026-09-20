"""
Workflow executor — reads a WorkflowTemplate, executes steps in order,
handles looping (per-task steps), gates, and event streaming.
"""

from __future__ import annotations

import asyncio
from typing import Any, Callable, Awaitable, Optional

from app.engine.contracts import (
    ExecutionMode,
    RunContext,
    StepResult,
    StepType,
    WorkflowStep,
    STEP_CONTRACTS,
)
from app.engine.gate_handler import gate_handler
from app.engine.step_runner import run_step
from app.services.skills import SkillsService

EventCallback = Callable[[dict[str, Any]], Awaitable[None]]

DEFAULT_GATE_TIMEOUT = 86400.0  # 24 hours


async def execute_workflow(
    steps: list[dict],
    context: RunContext,
    skills_service: SkillsService,
    skills_path: str,
    skills_branch: str,
    emit: EventCallback,
    gate_timeout: float = DEFAULT_GATE_TIMEOUT,
) -> dict[str, Any]:
    """
    Execute a full workflow from a template's steps list.

    Args:
        steps: raw step dicts from WorkflowTemplate.steps
        context: shared run context (connections, state)
        skills_service: for fetching skill files from repo
        skills_path: base path in repo (e.g. "/skills")
        skills_branch: repo branch (e.g. "main")
        emit: callback for SSE events
        gate_timeout: seconds before gate auto-cancels

    Returns:
        Final result dict with pr_urls, tokens, status
    """
    workflow_steps = sorted(
        [WorkflowStep.from_dict(s) for s in steps],
        key=lambda s: s.order,
    )

    await emit({"type": "workflow_start", "run_id": context.run_id, "steps_count": len(workflow_steps)})

    results: list[StepResult] = []

    for step in workflow_steps:
        contract = STEP_CONTRACTS[step.type]
        execution_mode = contract["execution_mode"]

        if execution_mode == ExecutionMode.ONCE_PER_EPIC:
            result = await _run_single_step(
                step, context, skills_service, skills_path, skills_branch, emit
            )
            results.append(result)

            if result.status == "error":
                await emit({"type": "workflow_error", "run_id": context.run_id, "error": result.error})
                return _build_final_result(context, results, status="error", error=result.error)

        elif execution_mode == ExecutionMode.ONCE_PER_TASK:
            task_ids = context.task_ids if context.task_ids else [context.epic_key]

            await emit({
                "type": "step_loop_start",
                "step_order": step.order,
                "step_type": step.type.value,
                "task_count": len(task_ids),
            })

            for i, task_id in enumerate(task_ids):
                context.task_ids = context.task_ids or []
                if task_id not in context.task_ids:
                    context.task_ids.append(task_id)
                else:
                    idx = context.task_ids.index(task_id)
                    context.task_ids = context.task_ids[:idx + 1]

                await emit({
                    "type": "task_start",
                    "step_order": step.order,
                    "task_id": task_id,
                    "task_index": i + 1,
                    "task_total": len(task_ids),
                })

                result = await _run_single_step(
                    step, context, skills_service, skills_path, skills_branch, emit
                )
                results.append(result)

                await emit({
                    "type": "task_done",
                    "step_order": step.order,
                    "task_id": task_id,
                    "status": result.status,
                })

                if result.status == "error":
                    await emit({
                        "type": "task_error",
                        "step_order": step.order,
                        "task_id": task_id,
                        "error": result.error,
                    })

        if step.gate_after and not context.auto_approve:
            await emit({
                "type": "gate_waiting",
                "run_id": context.run_id,
                "step_order": step.order,
                "step_type": step.type.value,
            })

            try:
                decision = await gate_handler.wait_for_gate(
                    run_id=context.run_id,
                    step_order=step.order,
                    step_type=step.type.value,
                    skill_name=step.skill_path,
                    summary=f"Step {step.order} ({step.type.value}) completed. Approve to continue?",
                    timeout=gate_timeout,
                )
            except asyncio.TimeoutError:
                await emit({"type": "gate_timeout", "run_id": context.run_id, "step_order": step.order})
                return _build_final_result(context, results, status="timed_out")

            await emit({
                "type": "gate_resolved",
                "run_id": context.run_id,
                "step_order": step.order,
                "decision": decision,
            })

            if decision == "reject":
                return _build_final_result(context, results, status="cancelled")

    await emit({"type": "workflow_done", "run_id": context.run_id})
    return _build_final_result(context, results, status="done")


async def _run_single_step(
    step: WorkflowStep,
    context: RunContext,
    skills_service: SkillsService,
    skills_path: str,
    skills_branch: str,
    emit: EventCallback,
) -> StepResult:
    """Execute a single step instance."""
    return await run_step(
        step=step,
        context=context,
        skills_service=skills_service,
        skills_path=skills_path,
        skills_branch=skills_branch,
        emit=emit,
    )


def _build_final_result(
    context: RunContext,
    results: list[StepResult],
    status: str,
    error: Optional[str] = None,
) -> dict[str, Any]:
    """Build the final workflow result."""
    return {
        "status": status,
        "pr_urls": context.pr_urls,
        "task_ids": context.task_ids,
        "total_input_tokens": context.total_input_tokens,
        "total_output_tokens": context.total_output_tokens,
        "steps_completed": len([r for r in results if r.status == "completed"]),
        "steps_total": len(results),
        "error": error,
    }
