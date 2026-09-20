from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.encryption import encrypt, decrypt
from app.models.models import User, Connection
from app.api.deps import get_current_user

router = APIRouter()


class CreateConnectionPayload(BaseModel):
    type: str
    auth_type: str
    credentials: str
    base_url: str = ""
    extra_config: dict = {}
    label: str = ""


class ConnectionInfo(BaseModel):
    id: str
    type: str
    auth_type: str
    base_url: str
    extra_config: dict
    status: str
    label: str


@router.post("/connections", response_model=ConnectionInfo)
async def create_connection(
    payload: CreateConnectionPayload,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conn = Connection(
        user_id=user.id,
        type=payload.type,
        auth_type=payload.auth_type,
        credentials_encrypted=encrypt(payload.credentials),
        base_url=payload.base_url,
        extra_config=payload.extra_config,
        label=payload.label or payload.type,
    )
    db.add(conn)
    await db.commit()
    await db.refresh(conn)
    return ConnectionInfo(
        id=conn.id, type=conn.type, auth_type=conn.auth_type,
        base_url=conn.base_url, extra_config=conn.extra_config or {},
        status=conn.status, label=conn.label,
    )


@router.get("/connections", response_model=List[ConnectionInfo])
async def list_connections(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Connection).where(Connection.user_id == user.id)
    )
    return [
        ConnectionInfo(
            id=c.id, type=c.type, auth_type=c.auth_type,
            base_url=c.base_url, extra_config=c.extra_config or {},
            status=c.status, label=c.label,
        )
        for c in result.scalars().all()
    ]


@router.delete("/connections/{conn_id}")
async def delete_connection(
    conn_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conn = await db.get(Connection, conn_id)
    if not conn or conn.user_id != user.id:
        raise HTTPException(404, "Connection not found")
    await db.delete(conn)
    await db.commit()
    return {"status": "ok"}


@router.get("/connections/{conn_id}/test")
async def test_connection(
    conn_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conn = await db.get(Connection, conn_id)
    if not conn or conn.user_id != user.id:
        raise HTTPException(404, "Connection not found")

    creds = decrypt(conn.credentials_encrypted)
    status = "connected"
    detail = ""

    try:
        if conn.type == "claude_api":
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=creds)
            await client.messages.create(
                model="claude-haiku-4-5-20251001", max_tokens=10,
                messages=[{"role": "user", "content": "hi"}],
            )
        elif conn.type == "github":
            import httpx
            async with httpx.AsyncClient() as http:
                resp = await http.get("https://api.github.com/user",
                                      headers={"Authorization": f"token {creds}"})
                if resp.status_code != 200:
                    status = "error"
                    detail = f"HTTP {resp.status_code}"
    except Exception as e:
        status = "error"
        detail = str(e)[:200]

    conn.status = status
    await db.commit()
    return {"status": status, "detail": detail}
