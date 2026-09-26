"""Write agent progress to the database."""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import async_session
from app.models.models import Run, RunStep, Gate, TaskLog


async def _get_session() -> AsyncSession:
    return async_session()


async def create_run_step(run_id: str, step_name: str) -> str:
    """Create a new RunStep record. Returns the step ID."""
    async with await _get_session() as db:
        step = RunStep(
            run_id=run_id,
            step_name=step_name,
            status="running",
            started_at=datetime.now(timezone.utc),
        )
        db.add(step)
        await db.commit()
        return step.id


async def update_step(run_id: str, step_name: str, **kwargs) -> None:
    """Update a RunStep by run_id + step_name."""
    async with await _get_session() as db:
        result = await db.execute(
            select(RunStep).where(RunStep.run_id == run_id, RunStep.step_name == step_name)
        )
        step = result.scalar_one_or_none()
        if not step:
            return
        for key, value in kwargs.items():
            setattr(step, key, value)
        await db.commit()


async def complete_step(run_id: str, step_name: str, status: str = "completed", error: str = "") -> None:
    """Mark a step as completed/failed with duration."""
    async with await _get_session() as db:
        result = await db.execute(
            select(RunStep).where(RunStep.run_id == run_id, RunStep.step_name == step_name)
        )
        step = result.scalar_one_or_none()
        if not step:
            return
        now = datetime.now(timezone.utc)
        step.status = status
        step.completed_at = now
        step.error = error
        if step.started_at:
            started = step.started_at
            if started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            step.duration_seconds = (now - started).total_seconds()
        await db.commit()


async def append_tool_call(run_id: str, step_name: str, tool_call: dict) -> None:
    """Append a tool call record to a RunStep."""
    async with await _get_session() as db:
        result = await db.execute(
            select(RunStep).where(RunStep.run_id == run_id, RunStep.step_name == step_name)
        )
        step = result.scalar_one_or_none()
        if not step:
            return
        calls = list(step.tool_calls or [])
        calls.append(tool_call)
        step.tool_calls = calls
        await db.commit()


async def append_reasoning(run_id: str, step_name: str, reasoning: dict) -> None:
    """Append a reasoning entry to a RunStep."""
    async with await _get_session() as db:
        result = await db.execute(
            select(RunStep).where(RunStep.run_id == run_id, RunStep.step_name == step_name)
        )
        step = result.scalar_one_or_none()
        if not step:
            return
        entries = list(step.reasoning or [])
        entries.append(reasoning)
        step.reasoning = entries
        await db.commit()


async def update_step_tokens(run_id: str, step_name: str, tokens_in: int, tokens_out: int) -> None:
    """Increment token counts on a RunStep."""
    async with await _get_session() as db:
        result = await db.execute(
            select(RunStep).where(RunStep.run_id == run_id, RunStep.step_name == step_name)
        )
        step = result.scalar_one_or_none()
        if not step:
            return
        step.tokens_in = (step.tokens_in or 0) + tokens_in
        step.tokens_out = (step.tokens_out or 0) + tokens_out
        await db.commit()


async def update_run(run_id: str, **kwargs) -> None:
    """Update Run record fields."""
    async with await _get_session() as db:
        run = await db.get(Run, run_id)
        if not run:
            return
        for key, value in kwargs.items():
            setattr(run, key, value)
        await db.commit()


async def create_gate(run_id: str, step_name: str, gate_type: str, payload: dict) -> str:
    """Create a Gate record. Returns gate ID."""
    async with await _get_session() as db:
        gate = Gate(
            run_id=run_id,
            step_name=step_name,
            gate_type=gate_type,
            payload=payload,
        )
        db.add(gate)
        await db.commit()
        return gate.id


async def check_gate_status(gate_id: str) -> str:
    """Check if a gate has been approved/rejected. Returns status string."""
    async with await _get_session() as db:
        gate = await db.get(Gate, gate_id)
        return gate.status if gate else "unknown"


# ── Task Logs ───────────────────────────────────────────────────────────────


async def add_task_log(
    task_id: str, run_id: str, level: str, message: str,
    step_name: str = None, details: dict = None,
) -> None:
    """Write a log entry for a task run."""
    async with await _get_session() as db:
        log = TaskLog(
            task_id=task_id,
            run_id=run_id,
            level=level,
            message=message,
            step_name=step_name,
            details=details,
        )
        db.add(log)
        await db.commit()


async def get_task_logs(task_id: str, run_id: str = None, step_name: str = None) -> list:
    """Read log entries for a task, optionally filtered by run_id and step_name."""
    async with await _get_session() as db:
        query = select(TaskLog).where(TaskLog.task_id == task_id)
        if run_id:
            query = query.where(TaskLog.run_id == run_id)
        if step_name:
            query = query.where(TaskLog.step_name == step_name)
        query = query.order_by(TaskLog.created_at)
        result = await db.execute(query)
        logs = result.scalars().all()
        return [
            {
                "id": log.id,
                "level": log.level,
                "message": log.message,
                "step_name": log.step_name,
                "details": log.details,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ]
