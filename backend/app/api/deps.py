from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, List

from fastapi import HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.models import User, Session, ProjectMember

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = None
    if credentials:
        token = credentials.credentials
    if not token:
        token = request.headers.get("X-Session-Token")
    if not token:
        raise HTTPException(401, "Not authenticated")

    result = await db.execute(select(Session).where(Session.token == token))
    session = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    expires = session.expires_at if session.expires_at.tzinfo else session.expires_at.replace(tzinfo=timezone.utc)
    if not session or expires < now:
        raise HTTPException(401, "Session expired")

    user = await db.get(User, session.user_id)
    if not user:
        raise HTTPException(401, "User not found")

    return user


async def require_project_role(db: AsyncSession, project_id: str, user_id: str, roles: List[str]) -> ProjectMember:
    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member or member.role not in roles:
        raise HTTPException(403, f"Requires one of: {', '.join(roles)}")
    return member
