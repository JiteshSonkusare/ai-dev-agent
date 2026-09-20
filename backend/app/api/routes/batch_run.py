"""Batch Run — run multiple epics in parallel with multiplexed SSE stream."""

from __future__ import annotations

import asyncio
import json
import uuid
from typing import Optional, List, Dict

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.encryption import decrypt
from app.api.deps import get_current_user, require_project_role
from app.models.models import Connection, Run, SkillsRepo, User, WorkflowTemplate
from app.engine.contracts import RunContext
from app.engine.executor import execute_workflow
from app.engine.gate_handler import gate_handler
from app.services.skills import SkillsService

router = APIRouter()

_batches: Dict[str, dict] = {}
_batch_queues: Dict[str, asyncio.Queue] = {}
_batch_gate_events: Dict[str, asyncio.Event] = {}
_batch_gate_decisions: Dict[str, str] = {}


class BatchRunRequest(BaseModel):
    epics: List[str]
    repo_path: Optional[str] = None
    auto_approve: bool = False
    workflow_template_id: Optional[str] = None
    project_id: Optional[str] = None


class ResumeRequest(BaseModel):
    decision: str


async def _push_batch(batch_id: str, run_id: str, event: dict) -> None:
    if batch_id in _batch_queues:
        await _batch_queues[batch_id].put({"run_id": run_id, **event})


async def _run_epic_flow(
    batch_id: str,
    run_id: str,
    epic_key: str,
    context: RunContext,
    skills_service: SkillsService,
    skills_path: str,
    skills_branch: str,
    template_steps: List[dict],
):
    """Run a single epic's workflow, pushing events to the batch queue."""

    async def emit(event: dict):
        mapped = _map_engine_event_to_batch(event, run_id)
        if mapped:
            await _push_batch(batch_id, run_id, mapped)

    try:
        result = await execute_workflow(
            steps=template_steps,
            context=context,
            skills_service=skills_service,
            skills_path=skills_path,
            skills_branch=skills_branch,
            emit=emit,
        )

        await _push_batch(batch_id, run_id, {
            "type": "run_done",
            "pr_urls": [{"task_key": t, "pr_url": u} for t, u in zip(context.task_ids, context.pr_urls)],
        })

    except Exception as e:
        await _push_batch(batch_id, run_id, {
            "type": "run_error",
            "error": str(e),
        })


def _map_engine_event_to_batch(event: dict, run_id: str) -> Optional[dict]:
    """Map engine executor events to batch SSE events."""
    etype = event.get("type")
    if etype == "workflow_start":
        return None
    elif etype == "step_start":
        return {
            "type": "step_start",
            "step_id": f"{event.get('step_type', 'step')}_{event.get('step_order', 0)}",
            "step_type": event.get("step_type", "plan"),
            "label": event.get("label", f"Step {event.get('step_order', 0)}"),
            "task_key": event.get("task_id"),
        }
    elif etype == "step_done":
        return {
            "type": "step_done",
            "step_id": f"{event.get('step_type', 'step')}_{event.get('step_order', 0)}",
            "summary": event.get("summary", {}),
            "duration_s": event.get("duration_s"),
            "input_tokens": event.get("input_tokens", 0),
            "output_tokens": event.get("output_tokens", 0),
        }
    elif etype == "gate_waiting":
        return {
            "type": "step_gate",
            "step_id": f"{event.get('step_type', 'step')}_{event.get('step_order', 0)}",
            "gate": {"message": f"Step {event.get('step_order')} requires approval"},
        }
    elif etype == "gate_resolved":
        return None
    elif etype == "task_start":
        return {
            "type": "step_start",
            "step_id": f"dev_{event.get('task_id', '')}",
            "step_type": "dev",
            "label": f"Dev — {event.get('task_id', '')}",
            "task_key": event.get("task_id"),
        }
    elif etype == "task_done":
        return {
            "type": "step_done",
            "step_id": f"dev_{event.get('task_id', '')}",
            "summary": {},
        }
    elif etype in ("workflow_done", "workflow_error"):
        return None
    return None


async def _run_batch(
    batch_id: str,
    runs: List[dict],
    template_steps: List[dict],
    contexts: List[RunContext],
    skills_service: SkillsService,
    skills_path: str,
    skills_branch: str,
):
    """Spawn all epic flows concurrently and signal batch_done when all finish."""
    tasks = [
        asyncio.create_task(
            _run_epic_flow(
                batch_id=batch_id,
                run_id=r["run_id"],
                epic_key=r["epic_key"],
                context=ctx,
                skills_service=skills_service,
                skills_path=skills_path,
                skills_branch=skills_branch,
                template_steps=template_steps,
            )
        )
        for r, ctx in zip(runs, contexts)
    ]
    await asyncio.gather(*tasks, return_exceptions=True)
    await _batch_queues[batch_id].put({"type": "batch_done"})


@router.post("/batch-run")
async def start_batch(
    req: BatchRunRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not req.epics:
        raise HTTPException(400, "At least one epic key required")

    project_id = req.project_id
    if not project_id:
        project_id = "default"

    batch_id = str(uuid.uuid4())
    queue: asyncio.Queue = asyncio.Queue()
    _batch_queues[batch_id] = queue

    runs = [{"run_id": str(uuid.uuid4()), "epic_key": e.strip().upper()} for e in req.epics]

    # Try to resolve workflow template and connections
    template_steps: List[dict] = []
    contexts: List[RunContext] = []
    skills_service: Optional[SkillsService] = None
    skills_path = "/skills"
    skills_branch = "main"

    try:
        # Resolve workflow template
        template = None
        if req.workflow_template_id:
            template = await db.get(WorkflowTemplate, req.workflow_template_id)
        else:
            result = await db.execute(
                select(WorkflowTemplate).where(
                    WorkflowTemplate.project_id == project_id,
                    WorkflowTemplate.is_default == True,
                )
            )
            template = result.scalar_one_or_none()

        if not template:
            raise HTTPException(400, "No workflow template configured")

        template_steps = template.steps

        # Load connections
        result = await db.execute(select(Connection).where(Connection.project_id == project_id))
        connections = result.scalars().all()

        claude_conn = next((c for c in connections if c.type == "claude_api"), None)
        tracker_conn = next((c for c in connections if c.type in ("atlassian", "azure_devops_boards")), None)
        repo_conn = next((c for c in connections if c.type in ("azure_devops", "github")), None)

        if not claude_conn:
            raise HTTPException(400, "No Claude API connection configured")
        if not tracker_conn:
            raise HTTPException(400, "No issue tracker connection configured")
        if not repo_conn:
            raise HTTPException(400, "No code repository connection configured")

        # Load skills repo
        result = await db.execute(select(SkillsRepo).where(SkillsRepo.project_id == project_id))
        skills_repo_record = result.scalar_one_or_none()
        if not skills_repo_record:
            raise HTTPException(400, "No skills repo configured")

        skills_conn = await db.get(Connection, skills_repo_record.connection_id)
        if not skills_conn:
            raise HTTPException(400, "Skills repo connection not found")

        skills_path = skills_repo_record.skills_path
        skills_branch = skills_repo_record.branch

        skills_service = SkillsService(
            connection_type=skills_conn.type,
            config={
                "base_url": skills_conn.base_url,
                "pat": decrypt(skills_conn.credentials_encrypted),
                "project_name": skills_conn.project_name,
                "repo_name": skills_repo_record.repo_name,
                "owner": skills_conn.extra_config.get("owner", ""),
            },
        )

        # Build a RunContext per epic
        for r in runs:
            ctx = RunContext(
                run_id=r["run_id"],
                project_id=project_id,
                epic_key=r["epic_key"],
                auto_approve=req.auto_approve,
                claude_api_key=decrypt(claude_conn.credentials_encrypted),
                claude_model=claude_conn.extra_config.get("model", "claude-sonnet-4-6"),
                issue_tracker_type=tracker_conn.type,
                issue_tracker_config={
                    "base_url": tracker_conn.base_url,
                    "email": tracker_conn.extra_config.get("email", ""),
                    "api_token": decrypt(tracker_conn.credentials_encrypted),
                    "project_name": tracker_conn.project_name,
                },
                code_repo_type=repo_conn.type,
                code_repo_config={
                    "base_url": repo_conn.base_url,
                    "pat": decrypt(repo_conn.credentials_encrypted),
                    "project_name": repo_conn.project_name,
                    "repo_name": repo_conn.extra_config.get("repo_name", ""),
                    "owner": repo_conn.extra_config.get("owner", ""),
                },
                skills_repo_config={
                    "connection_type": skills_conn.type,
                    "base_url": skills_conn.base_url,
                    "pat": decrypt(skills_conn.credentials_encrypted),
                    "project_name": skills_conn.project_name,
                    "repo_name": skills_repo_record.repo_name,
                    "owner": skills_conn.extra_config.get("owner", ""),
                },
            )
            contexts.append(ctx)

    except HTTPException:
        _batch_queues.pop(batch_id, None)
        raise

    _batches[batch_id] = {
        "batch_id": batch_id,
        "status": "running",
        "runs": runs,
        "auto_approve": req.auto_approve,
    }

    asyncio.create_task(_run_batch(
        batch_id=batch_id,
        runs=runs,
        template_steps=template_steps,
        contexts=contexts,
        skills_service=skills_service,
        skills_path=skills_path,
        skills_branch=skills_branch,
    ))

    return {"batch_id": batch_id, "runs": runs}


@router.get("/batch-run/{batch_id}/stream")
async def stream_batch(batch_id: str, user: User = Depends(get_current_user)):
    queue = _batch_queues.get(batch_id)
    if not queue:
        raise HTTPException(404, "Batch not found or already completed")

    async def event_generator():
        while True:
            event = await queue.get()
            yield f"data: {json.dumps(event)}\n\n"
            if event.get("type") == "batch_done":
                _batch_queues.pop(batch_id, None)
                _batches.pop(batch_id, None)
                break

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/batch-run/{batch_id}/runs/{run_id}/resume")
async def resume_batch_run(
    batch_id: str,
    run_id: str,
    req: ResumeRequest,
    user: User = Depends(get_current_user),
):
    resumed = gate_handler.resume_by_run(run_id, req.decision)
    if not resumed:
        raise HTTPException(404, "No active gate for this run")
    return {"status": "resumed", "decision": req.decision}


@router.get("/batch-run/{batch_id}")
async def get_batch_status(batch_id: str, user: User = Depends(get_current_user)):
    batch = _batches.get(batch_id)
    if not batch:
        raise HTTPException(404, "Batch not found")
    return batch
