from collections import defaultdict
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.models import User, Task
from app.api.deps import get_current_user

router = APIRouter()


class DashboardResponse(BaseModel):
    counts: dict          # status -> count
    by_date: list         # [{date, done, failed, pending, error, interrupted}]
    by_repo: list         # [{repo, count}]
    by_status: list       # [{status, count}]
    by_priority: list     # [{priority, count}]
    success_rate_trend: list  # [{date, rate}]


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    period: str = "month",  # day | week | month
    from_date: str = "",    # YYYY-MM-DD
    to_date: str = "",      # YYYY-MM-DD
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Fetch all processed tasks for this user
    result = await db.execute(
        select(Task).where(Task.user_id == user.id, Task.status != "open")
    )
    all_tasks = result.scalars().all()

    # Apply date filter
    tasks = []
    for t in all_tasks:
        dt = t.pulled_at
        if isinstance(dt, str):
            dt = datetime.fromisoformat(dt)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        date_str = dt.strftime("%Y-%m-%d")
        if from_date and date_str < from_date:
            continue
        if to_date and date_str > to_date:
            continue
        tasks.append(t)

    # ── Counts ──
    counts: dict = {"total": 0, "done": 0, "failed": 0, "pending": 0, "error": 0, "interrupted": 0}
    for t in tasks:
        counts["total"] += 1
        if t.status in counts:
            counts[t.status] += 1

    # ── By date (group by day/week/month) ──
    now = datetime.now(timezone.utc)
    date_buckets: dict = defaultdict(lambda: {"done": 0, "failed": 0, "pending": 0, "error": 0, "interrupted": 0})

    for t in tasks:
        dt = t.pulled_at if t.pulled_at else now
        if isinstance(dt, str):
            dt = datetime.fromisoformat(dt)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)

        if period == "day":
            key = dt.strftime("%Y-%m-%d")
        elif period == "week":
            # Monday of the week
            monday = dt - timedelta(days=dt.weekday())
            key = monday.strftime("%Y-%m-%d")
        else:  # month
            key = dt.strftime("%Y-%m")

        if t.status in date_buckets[key]:
            date_buckets[key][t.status] += 1

    by_date = sorted(
        [{"date": k, **v} for k, v in date_buckets.items()],
        key=lambda x: x["date"],
    )

    # ── By repo ──
    repo_counts: dict = defaultdict(int)
    for t in tasks:
        repo_counts[t.repo_name] += 1
    by_repo = sorted(
        [{"repo": k, "count": v} for k, v in repo_counts.items()],
        key=lambda x: -x["count"],
    )

    # ── By status ──
    status_counts: dict = defaultdict(int)
    for t in tasks:
        status_counts[t.status] += 1
    by_status = [{"status": k, "count": v} for k, v in status_counts.items()]

    # ── By priority ──
    priority_counts: dict = defaultdict(int)
    for t in tasks:
        p = t.priority or "unset"
        priority_counts[p] += 1
    by_priority = sorted(
        [{"priority": k, "count": v} for k, v in priority_counts.items()],
        key=lambda x: -x["count"],
    )

    # ── Success rate trend ──
    # Group by date, calculate success rate per bucket
    rate_buckets: dict = defaultdict(lambda: {"total": 0, "done": 0})
    for t in tasks:
        dt = t.pulled_at if t.pulled_at else now
        if isinstance(dt, str):
            dt = datetime.fromisoformat(dt)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        key = dt.strftime("%Y-%m-%d")
        rate_buckets[key]["total"] += 1
        if t.status == "done":
            rate_buckets[key]["done"] += 1

    success_rate_trend = sorted(
        [{"date": k, "rate": round((v["done"] / v["total"]) * 100) if v["total"] > 0 else 0}
         for k, v in rate_buckets.items()],
        key=lambda x: x["date"],
    )

    return DashboardResponse(
        counts=counts,
        by_date=by_date,
        by_repo=by_repo,
        by_status=by_status,
        by_priority=by_priority,
        success_rate_trend=success_rate_trend,
    )
