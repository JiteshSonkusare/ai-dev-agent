from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, List

from fastapi import HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.models import User, Session

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
    expires = session.expires_at if session and session.expires_at.tzinfo else (session.expires_at.replace(tzinfo=timezone.utc) if session else now)
    if not session or expires < now:
        raise HTTPException(401, "Session expired")

    user = await db.get(User, session.user_id)
    if not user:
        raise HTTPException(401, "User not found")

    return user
