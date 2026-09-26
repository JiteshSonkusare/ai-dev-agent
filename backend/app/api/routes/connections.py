from typing import List
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.encryption import encrypt, decrypt
from app.models.models import User, Connection
from app.api.deps import get_current_user

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class GitHubConnectionRequest(BaseModel):
    url: str       # e.g. https://github.com/JiteshSonkusare or https://dnb.ghe.com/ContactCenter
    token: str     # GitHub PAT


class ClaudeConnectionRequest(BaseModel):
    api_key: str
    model: str = "claude-sonnet-4-6"
    base_url: str = ""  # Corporate gateway URL, e.g. https://gateway.raicode.no


class ConnectionInfo(BaseModel):
    id: str
    type: str
    auth_type: str
    base_url: str
    extra_config: dict
    status: str
    label: str


# ── Helpers ──────────────────────────────────────────────────────────────────

def _parse_github_url(url: str) -> dict:
    """Parse GitHub URL to extract owner and API base URL."""
    trimmed = url.strip().rstrip("/")
    if not trimmed.startswith("http"):
        trimmed = f"https://{trimmed}"

    parsed = urlparse(trimmed)
    owner = parsed.path.strip("/").split("/")[0] if parsed.path.strip("/") else ""
    is_enterprise = parsed.hostname != "github.com"
    base_url = f"{parsed.scheme}://{parsed.hostname}/api/v3" if is_enterprise else "https://api.github.com"

    return {"owner": owner, "base_url": base_url}


def _to_info(conn: Connection) -> ConnectionInfo:
    return ConnectionInfo(
        id=conn.id, type=conn.type, auth_type=conn.auth_type,
        base_url=conn.base_url, extra_config=conn.extra_config or {},
        status=conn.status, label=conn.label,
    )


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/connections/github", response_model=ConnectionInfo)
async def create_github_connection(
    req: GitHubConnectionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or replace GitHub connection. Backend parses URL to extract owner + API base."""
    if not req.token.strip():
        raise HTTPException(400, "GitHub PAT token is required")
    if not req.url.strip():
        raise HTTPException(400, "GitHub URL is required")

    parsed = _parse_github_url(req.url)
    if not parsed["owner"]:
        raise HTTPException(400, "Could not extract owner from URL. Use format: https://github.com/username")

    # Delete existing GitHub connection for this user
    existing = await db.execute(
        select(Connection).where(Connection.user_id == user.id, Connection.type == "github")
    )
    for old in existing.scalars().all():
        await db.delete(old)

    conn = Connection(
        user_id=user.id,
        type="github",
        auth_type="pat",
        credentials_encrypted=encrypt(req.token.strip()),
        base_url=parsed["base_url"],
        extra_config={"owner": parsed["owner"]},
        label="GitHub",
    )
    db.add(conn)
    await db.commit()
    await db.refresh(conn)
    return _to_info(conn)


@router.post("/connections/claude", response_model=ConnectionInfo)
async def create_claude_connection(
    req: ClaudeConnectionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or replace Claude API connection."""
    if not req.api_key.strip():
        raise HTTPException(400, "Claude API key is required")

    # Delete existing Claude connection for this user
    existing = await db.execute(
        select(Connection).where(Connection.user_id == user.id, Connection.type == "claude_api")
    )
    for old in existing.scalars().all():
        await db.delete(old)

    conn = Connection(
        user_id=user.id,
        type="claude_api",
        auth_type="api_key",
        credentials_encrypted=encrypt(req.api_key.strip()),
        base_url=req.base_url.strip(),
        extra_config={"model": req.model},
        label="Claude API",
    )
    db.add(conn)
    await db.commit()
    await db.refresh(conn)
    return _to_info(conn)


@router.get("/connections", response_model=List[ConnectionInfo])
async def list_connections(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Connection).where(Connection.user_id == user.id))
    return [_to_info(c) for c in result.scalars().all()]


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
            client_kwargs = {"api_key": creds}
            if conn.base_url:
                client_kwargs["base_url"] = conn.base_url
            client = anthropic.AsyncAnthropic(**client_kwargs)
            model = (conn.extra_config or {}).get("model", "claude-haiku-4-5-20251001")
            await client.messages.create(
                model=model, max_tokens=10,
                messages=[{"role": "user", "content": "hi"}],
            )
        elif conn.type == "github":
            import httpx
            base = conn.base_url or "https://api.github.com"
            async with httpx.AsyncClient() as http:
                resp = await http.get(f"{base}/user", headers={"Authorization": f"token {creds}"})
                if resp.status_code != 200:
                    status = "error"
                    detail = f"HTTP {resp.status_code}"
    except Exception as e:
        status = "error"
        detail = str(e)[:200]

    conn.status = status
    await db.commit()
    return {"status": status, "detail": detail}
