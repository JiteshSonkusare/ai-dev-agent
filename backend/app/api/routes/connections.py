from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.encryption import encrypt, decrypt
from app.api.deps import get_current_user, require_project_role
from app.models.models import Connection, User

router = APIRouter()


class CreateConnectionRequest(BaseModel):
    type: str  # atlassian | azure_devops | github | azure_devops_boards | claude_api
    auth_type: str  # pat | oauth | api_key
    credentials: str  # raw secret — will be encrypted
    base_url: str = ""
    project_name: str = ""
    extra_config: dict = {}
    label: str = ""


@router.post("/projects/{project_id}/connections")
async def create_connection(
    project_id: str,
    req: CreateConnectionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_project_role(db, project_id, user.id, ["admin", "architect"])

    conn = Connection(
        project_id=project_id,
        type=req.type,
        auth_type=req.auth_type,
        credentials_encrypted=encrypt(req.credentials),
        base_url=req.base_url,
        project_name=req.project_name,
        extra_config=req.extra_config,
        label=req.label or f"{req.type} connection",
        status="connected",
    )
    db.add(conn)
    await db.commit()
    return {"id": conn.id, "type": conn.type, "label": conn.label, "status": conn.status}


@router.get("/projects/{project_id}/connections")
async def list_connections(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_project_role(db, project_id, user.id, ["admin", "architect", "developer", "viewer"])

    result = await db.execute(select(Connection).where(Connection.project_id == project_id))
    conns = result.scalars().all()
    return [
        {"id": c.id, "type": c.type, "auth_type": c.auth_type, "base_url": c.base_url, "label": c.label, "status": c.status}
        for c in conns
    ]


@router.delete("/projects/{project_id}/connections/{conn_id}")
async def delete_connection(
    project_id: str,
    conn_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_project_role(db, project_id, user.id, ["admin", "architect"])

    conn = await db.get(Connection, conn_id)
    if not conn or conn.project_id != project_id:
        raise HTTPException(404, "Connection not found")

    await db.delete(conn)
    await db.commit()
    return {"status": "deleted"}


@router.get("/projects/{project_id}/connections/{conn_id}/test")
async def test_connection(
    project_id: str,
    conn_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_project_role(db, project_id, user.id, ["admin", "architect"])

    conn = await db.get(Connection, conn_id)
    if not conn or conn.project_id != project_id:
        raise HTTPException(404, "Connection not found")

    credentials = decrypt(conn.credentials_encrypted)

    # Test based on type
    try:
        if conn.type == "atlassian":
            from app.services.jira import JiraService
            svc = JiraService(base_url=conn.base_url, email=conn.extra_config.get("email", ""), api_token=credentials)
            await svc.get_issue("TEST-1")  # will 404 but proves auth works
        elif conn.type == "claude_api":
            from app.services.claude import ClaudeService
            svc = ClaudeService(api_key=credentials, model=conn.extra_config.get("model", "claude-sonnet-4-6"))
            await svc.generate(system="test", prompt="Say hello", max_tokens=10)
        # Add more types as needed
        conn.status = "connected"
    except Exception as e:
        conn.status = "error"
        await db.commit()
        return {"status": "error", "detail": str(e)}

    await db.commit()
    return {"status": "connected"}
