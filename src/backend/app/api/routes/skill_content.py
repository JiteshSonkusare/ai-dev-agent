from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.models import User, Skill
from app.api.deps import get_current_user

router = APIRouter()

VALID_SKILL_TYPES = ("develop", "review", "plan")


class CreateSkillRequest(BaseModel):
    name: str
    skill_type: str
    content: str
    description: str = ""
    repository: Optional[str] = None

    @field_validator("skill_type")
    @classmethod
    def validate_skill_type(cls, v: str) -> str:
        if v not in VALID_SKILL_TYPES:
            raise ValueError(f"skill_type must be one of: {', '.join(VALID_SKILL_TYPES)}")
        return v


class UpdateSkillRequest(BaseModel):
    name: Optional[str] = None
    skill_type: Optional[str] = None
    content: Optional[str] = None
    description: Optional[str] = None
    repository: Optional[str] = None
    is_active: Optional[bool] = None


class SkillResponse(BaseModel):
    id: str
    name: str
    skill_type: str
    content: str
    description: str
    repository: Optional[str] = None
    is_active: bool
    created_at: str
    updated_at: str


def _to_response(s: Skill) -> SkillResponse:
    return SkillResponse(
        id=s.id, name=s.name, skill_type=s.skill_type, content=s.content,
        description=s.description, repository=s.repository, is_active=s.is_active,
        created_at=s.created_at.isoformat(), updated_at=s.updated_at.isoformat(),
    )


@router.get("/skills", response_model=List[SkillResponse])
async def list_skills(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Skill).where(Skill.user_id == user.id).order_by(Skill.skill_type, Skill.repository)
    )
    return [_to_response(s) for s in result.scalars().all()]


@router.post("/skills", response_model=SkillResponse)
async def create_skill(
    req: CreateSkillRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo_val = req.repository.strip() if req.repository else None
    query = select(Skill).where(
        Skill.user_id == user.id, Skill.skill_type == req.skill_type, Skill.is_active == True,
    )
    if repo_val:
        query = query.where(Skill.repository == repo_val)
    else:
        query = query.where(Skill.repository == None)

    existing = await db.execute(query)
    if existing.scalar_one_or_none():
        scope = f"repository '{repo_val}'" if repo_val else "default (all repos)"
        raise HTTPException(400, f"An active {req.skill_type} skill already exists for {scope}.")

    skill = Skill(
        user_id=user.id, name=req.name, skill_type=req.skill_type,
        content=req.content, description=req.description, repository=repo_val,
    )
    db.add(skill)
    await db.commit()
    await db.refresh(skill)
    return _to_response(skill)


@router.put("/skills/{skill_id}", response_model=SkillResponse)
async def update_skill(
    skill_id: str,
    req: UpdateSkillRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    skill = await db.get(Skill, skill_id)
    if not skill or skill.user_id != user.id:
        raise HTTPException(404, "Skill not found")

    if req.name is not None: skill.name = req.name
    if req.skill_type is not None: skill.skill_type = req.skill_type
    if req.content is not None: skill.content = req.content
    if req.description is not None: skill.description = req.description
    if req.repository is not None: skill.repository = req.repository.strip() if req.repository else None
    if req.is_active is not None: skill.is_active = req.is_active

    from datetime import datetime, timezone
    skill.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(skill)
    return _to_response(skill)


@router.delete("/skills/{skill_id}")
async def delete_skill(
    skill_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    skill = await db.get(Skill, skill_id)
    if not skill or skill.user_id != user.id:
        raise HTTPException(404, "Skill not found")
    await db.delete(skill)
    await db.commit()
    return {"status": "ok"}
