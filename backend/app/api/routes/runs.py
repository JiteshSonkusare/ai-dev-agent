"""Run management — start workflow runs, stream events, resume gates."""

from __future__ import annotations
from typing import Optional, List

import asyncio
import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.encryption import decrypt
from app.api.deps import get_current_user, require_project_role
from app.models.models import Connection, Project, Run, SkillsRepo, User, WorkflowTemplate
from app.engine.contracts import RunContext
from app.engine.executor import execute_workflow
from app.engine.gate_handler import gate_handler
from app.services.skills import SkillsService

router = APIRouter()

_run_queues: dict[str, asyncio.Queue] = {}


class StartRunRequest(BaseModel):
    epic_key: str
    workflow_template_id: Optional[str] = None
    auto_approve: bool = False


class ResumeRequest(BaseModel):
    decision: str  # approve | reject
    step_order: Optional[int] = None


@router.post("/projects/{project_id}/runs")
async def start_run(
    project_id: str,
    req: StartRunRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_project_role(db, project_id, user.id, ["admin", "architect", "developer"])

    # Resolve workflow template
    template = None
    if req.workflow_template_id:
        template = await db.get(WorkflowTemplate, req.workflow_template_id)
        if not template or template.project_id != project_id:
            raise HTTPException(404, "Workflow template not found")
    else:
        result = await db.execute(
            select(WorkflowTemplate).where(
                WorkflowTemplate.project_id == project_id,
                WorkflowTemplate.is_default == True,
            )
        )
        template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(400, "No workflow template specified and no default template configured")

    # Load project connections
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
    skills_repo = result.scalar_one_or_none()
    if not skills_repo:
        raise HTTPException(400, "No skills repo configured for this project")

    skills_conn = await db.get(Connection, skills_repo.connection_id)
    if not skills_conn:
        raise HTTPException(400, "Skills repo connection not found")

    # Create run record
    run = Run(
        project_id=project_id,
        triggered_by=user.id,
        epic_key=req.epic_key,
        auto_approve=req.auto_approve,
        status="running",
        model=claude_conn.extra_config.get("model", "claude-sonnet-4-6"),
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    # Build context
    context = RunContext(
        run_id=run.id,
        project_id=project_id,
        epic_key=req.epic_key,
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
            "repo_name": skills_repo.repo_name,
            "owner": skills_conn.extra_config.get("owner", ""),
        },
    )

    # Set up SSE queue and start workflow
    queue: asyncio.Queue = asyncio.Queue()
    _run_queues[run.id] = queue

    skills_service = SkillsService(
        connection_type=skills_conn.type,
        config={
            "base_url": skills_conn.base_url,
            "pat": decrypt(skills_conn.credentials_encrypted),
            "project_name": skills_conn.project_name,
            "repo_name": skills_repo.repo_name,
            "owner": skills_conn.extra_config.get("owner", ""),
        },
    )

    asyncio.create_task(_run_workflow(
        run_id=run.id,
        template_steps=template.steps,
        context=context,
        skills_service=skills_service,
        skills_path=skills_repo.skills_path,
        skills_branch=skills_repo.branch,
        queue=queue,
        db_url=str(db.get_bind().url) if db.get_bind() else "",
    ))

    return {
        "run_id": run.id,
        "epic_key": req.epic_key,
        "workflow": template.name,
        "status": "running",
    }


async def _run_workflow(
    run_id: str,
    template_steps: List[dict],
    context: RunContext,
    skills_service: SkillsService,
    skills_path: str,
    skills_branch: str,
    queue: asyncio.Queue,
    db_url: str,
):
    """Execute workflow and push events to the SSE queue."""

    async def emit(event: dict):
        event["run_id"] = run_id
        await queue.put(event)

    try:
        result = await execute_workflow(
            steps=template_steps,
            context=context,
            skills_service=skills_service,
            skills_path=skills_path,
            skills_branch=skills_branch,
            emit=emit,
        )

        await queue.put({
            "run_id": run_id,
            "type": "run_complete",
            "status": result["status"],
            "pr_urls": result["pr_urls"],
            "tokens": {
                "input": result["total_input_tokens"],
                "output": result["total_output_tokens"],
            },
        })

    except Exception as e:
        await queue.put({
            "run_id": run_id,
            "type": "run_error",
            "error": str(e),
        })

    finally:
        await queue.put({"run_id": run_id, "type": "stream_end"})


@router.get("/runs/{run_id}/stream")
async def stream_run(run_id: str, user: User = Depends(get_current_user)):
    queue = _run_queues.get(run_id)
    if not queue:
        raise HTTPException(404, "Run not found or already completed")

    async def event_generator():
        while True:
            event = await queue.get()
            yield f"data: {json.dumps(event)}\n\n"
            if event.get("type") in ("stream_end", "run_error"):
                _run_queues.pop(run_id, None)
                break

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/runs/{run_id}/resume")
async def resume_run(run_id: str, req: ResumeRequest, user: User = Depends(get_current_user)):
    if req.step_order is not None:
        resumed = gate_handler.resume(run_id, req.step_order, req.decision)
    else:
        resumed = gate_handler.resume_by_run(run_id, req.decision)

    if not resumed:
        raise HTTPException(404, "No active gate for this run")

    return {"status": "resumed", "decision": req.decision}


@router.get("/runs/{run_id}/gate")
async def get_gate(run_id: str, user: User = Depends(get_current_user)):
    """Check if a run has a pending gate."""
    pending = gate_handler.get_pending(run_id)
    if not pending:
        return {"has_gate": False}
    return {
        "has_gate": True,
        "step_order": pending.step_order,
        "step_type": pending.step_type,
        "skill_name": pending.skill_name,
        "summary": pending.summary,
    }


@router.get("/projects/{project_id}/runs")
async def list_runs(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_project_role(db, project_id, user.id, ["admin", "architect", "developer", "viewer"])

    result = await db.execute(
        select(Run).where(Run.project_id == project_id).order_by(Run.started_at.desc()).limit(50)
    )
    runs = result.scalars().all()
    return [
        {
            "id": r.id,
            "epic_key": r.epic_key,
            "status": r.status,
            "auto_approve": r.auto_approve,
            "model": r.model,
            "started_at": r.started_at.isoformat(),
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            "pr_urls": r.pr_urls_json,
            "tokens": {"input": r.total_input_tokens, "output": r.total_output_tokens},
            "error": r.error if r.error else None,
        }
        for r in runs
    ]


@router.get("/projects/{project_id}/dashboard")
async def project_dashboard(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Project dashboard with stats."""
    await require_project_role(db, project_id, user.id, ["admin", "architect", "developer", "viewer"])

    result = await db.execute(select(Run).where(Run.project_id == project_id))
    all_runs = result.scalars().all()

    total_runs = len(all_runs)
    completed = sum(1 for r in all_runs if r.status == "done")
    errors = sum(1 for r in all_runs if r.status == "error")
    total_input_tokens = sum(r.total_input_tokens for r in all_runs)
    total_output_tokens = sum(r.total_output_tokens for r in all_runs)

    recent = sorted(all_runs, key=lambda r: r.started_at, reverse=True)[:10]

    return {
        "stats": {
            "total_runs": total_runs,
            "completed": completed,
            "errors": errors,
            "success_rate": round(completed / total_runs * 100, 1) if total_runs > 0 else 0,
            "total_tokens": {"input": total_input_tokens, "output": total_output_tokens},
        },
        "recent_runs": [
            {
                "id": r.id,
                "epic_key": r.epic_key,
                "status": r.status,
                "started_at": r.started_at.isoformat(),
                "pr_urls": r.pr_urls_json,
            }
            for r in recent
        ],
    }
