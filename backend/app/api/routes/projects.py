from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.api.deps import get_current_user
from app.models.models import Project, ProjectMember, OrgMember, User

router = APIRouter()


class CreateProjectRequest(BaseModel):
    name: str
    description: str = ""


class AddProjectMemberRequest(BaseModel):
    email: str
    role: str = "developer"


@router.post("/orgs/{org_id}/projects")
async def create_project(org_id: str, req: CreateProjectRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Verify user is org member
    result = await db.execute(
        select(OrgMember).where(OrgMember.org_id == org_id, OrgMember.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(403, "Not an org member")

    project = Project(org_id=org_id, name=req.name, description=req.description, created_by=user.id)
    db.add(project)
    await db.flush()

    member = ProjectMember(project_id=project.id, user_id=user.id, role="admin")
    db.add(member)
    await db.commit()

    return {"id": project.id, "name": project.name, "description": project.description}


@router.get("/orgs/{org_id}/projects")
async def list_projects(org_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Project)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(Project.org_id == org_id, ProjectMember.user_id == user.id)
    )
    projects = result.scalars().all()
    return [{"id": p.id, "name": p.name, "description": p.description} for p in projects]


@router.get("/projects/{project_id}")
async def get_project(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return {"id": project.id, "name": project.name, "description": project.description, "org_id": project.org_id}


@router.post("/projects/{project_id}/members")
async def add_project_member(project_id: str, req: AddProjectMemberRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Verify caller is project admin
    result = await db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == user.id)
    )
    caller = result.scalar_one_or_none()
    if not caller or caller.role != "admin":
        raise HTTPException(403, "Only project admins can add members")

    result = await db.execute(select(User).where(User.email == req.email))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "User not found")

    member = ProjectMember(project_id=project_id, user_id=target.id, role=req.role)
    db.add(member)
    await db.commit()
    return {"id": member.id, "user_id": target.id, "role": member.role}
