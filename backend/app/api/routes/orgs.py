from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.api.deps import get_current_user
from app.models.models import Org, OrgMember, Project, ProjectMember, User

router = APIRouter()


class CreateOrgRequest(BaseModel):
    name: str
    slug: str


class AddMemberRequest(BaseModel):
    email: str
    role: str = "member"


@router.post("")
async def create_org(req: CreateOrgRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    org = Org(name=req.name, slug=req.slug)
    db.add(org)
    await db.flush()

    member = OrgMember(org_id=org.id, user_id=user.id, role="org_admin")
    db.add(member)

    # Auto-create default project
    project = Project(org_id=org.id, name=f"{req.name} - Default", description="Default project", created_by=user.id)
    db.add(project)
    await db.flush()

    proj_member = ProjectMember(project_id=project.id, user_id=user.id, role="admin")
    db.add(proj_member)

    await db.commit()

    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "default_project_id": project.id,
    }


@router.get("/{org_id}")
async def get_org(org_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    org = await db.get(Org, org_id)
    if not org:
        raise HTTPException(404, "Org not found")
    return {"id": org.id, "name": org.name, "slug": org.slug}


@router.post("/{org_id}/members")
async def add_member(org_id: str, req: AddMemberRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Verify caller is org_admin
    result = await db.execute(
        select(OrgMember).where(OrgMember.org_id == org_id, OrgMember.user_id == user.id)
    )
    caller = result.scalar_one_or_none()
    if not caller or caller.role != "org_admin":
        raise HTTPException(403, "Only org admins can add members")

    # Find target user
    result = await db.execute(select(User).where(User.email == req.email))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "User not found")

    member = OrgMember(org_id=org_id, user_id=target.id, role=req.role)
    db.add(member)
    await db.commit()
    return {"id": member.id, "user_id": target.id, "role": member.role}


@router.delete("/{org_id}/members/{member_id}")
async def remove_member(org_id: str, member_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(OrgMember).where(OrgMember.org_id == org_id, OrgMember.user_id == user.id)
    )
    caller = result.scalar_one_or_none()
    if not caller or caller.role != "org_admin":
        raise HTTPException(403, "Only org admins can remove members")

    member = await db.get(OrgMember, member_id)
    if not member or member.org_id != org_id:
        raise HTTPException(404, "Member not found")

    await db.delete(member)
    await db.commit()
    return {"status": "removed"}
