"""Workflow template CRUD — architect builds flows by selecting step types and mapping skills."""

from __future__ import annotations
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.api.deps import get_current_user, require_project_role
from app.models.models import WorkflowTemplate, User
from app.engine.contracts import StepType, STEP_CONTRACTS

router = APIRouter()

VALID_STEP_TYPES = [t.value for t in StepType]


class WorkflowStepSchema(BaseModel):
    order: int
    type: str
    skill_path: str
    gate_after: bool = False
    model_override: Optional[str] = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in VALID_STEP_TYPES:
            raise ValueError(f"Invalid step type '{v}'. Must be one of: {VALID_STEP_TYPES}")
        return v


class WorkflowCreate(BaseModel):
    name: str
    steps: List[WorkflowStepSchema]
    gate_policy: str = "review_plan"
    is_default: bool = False

    @field_validator("steps")
    @classmethod
    def validate_steps(cls, v: List[WorkflowStepSchema]) -> List[WorkflowStepSchema]:
        if not v:
            raise ValueError("Workflow must have at least one step")
        orders = [s.order for s in v]
        if len(orders) != len(set(orders)):
            raise ValueError("Step orders must be unique")
        return v


class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    steps: Optional[List[WorkflowStepSchema]] = None
    gate_policy: Optional[str] = None
    is_default: Optional[bool] = None


class WorkflowResponse(BaseModel):
    id: str
    name: str
    steps: List[dict]
    gate_policy: str
    is_default: bool


@router.post("/projects/{project_id}/workflow-templates", response_model=WorkflowResponse)
async def create_workflow(
    project_id: str,
    req: WorkflowCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_project_role(db, project_id, user.id, ["admin", "architect"])

    if req.is_default:
        await _clear_default(db, project_id)

    template = WorkflowTemplate(
        project_id=project_id,
        name=req.name,
        steps=[s.model_dump() for s in req.steps],
        gate_policy=req.gate_policy,
        is_default=req.is_default,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)

    return WorkflowResponse(
        id=template.id,
        name=template.name,
        steps=template.steps,
        gate_policy=template.gate_policy,
        is_default=template.is_default,
    )


@router.get("/projects/{project_id}/workflow-templates")
async def list_workflows(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_project_role(db, project_id, user.id, ["admin", "architect", "developer", "viewer"])

    result = await db.execute(
        select(WorkflowTemplate).where(WorkflowTemplate.project_id == project_id)
    )
    templates = result.scalars().all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "steps": t.steps,
            "gate_policy": t.gate_policy,
            "is_default": t.is_default,
        }
        for t in templates
    ]


@router.get("/projects/{project_id}/workflow-templates/{template_id}", response_model=WorkflowResponse)
async def get_workflow(
    project_id: str,
    template_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_project_role(db, project_id, user.id, ["admin", "architect", "developer", "viewer"])

    template = await db.get(WorkflowTemplate, template_id)
    if not template or template.project_id != project_id:
        raise HTTPException(404, "Workflow template not found")

    return WorkflowResponse(
        id=template.id,
        name=template.name,
        steps=template.steps,
        gate_policy=template.gate_policy,
        is_default=template.is_default,
    )


@router.patch("/projects/{project_id}/workflow-templates/{template_id}", response_model=WorkflowResponse)
async def update_workflow(
    project_id: str,
    template_id: str,
    req: WorkflowUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_project_role(db, project_id, user.id, ["admin", "architect"])

    template = await db.get(WorkflowTemplate, template_id)
    if not template or template.project_id != project_id:
        raise HTTPException(404, "Workflow template not found")

    if req.name is not None:
        template.name = req.name
    if req.steps is not None:
        template.steps = [s.model_dump() for s in req.steps]
    if req.gate_policy is not None:
        template.gate_policy = req.gate_policy
    if req.is_default is not None:
        if req.is_default:
            await _clear_default(db, project_id)
        template.is_default = req.is_default

    await db.commit()
    await db.refresh(template)

    return WorkflowResponse(
        id=template.id,
        name=template.name,
        steps=template.steps,
        gate_policy=template.gate_policy,
        is_default=template.is_default,
    )


@router.delete("/projects/{project_id}/workflow-templates/{template_id}")
async def delete_workflow(
    project_id: str,
    template_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_project_role(db, project_id, user.id, ["admin", "architect"])

    template = await db.get(WorkflowTemplate, template_id)
    if not template or template.project_id != project_id:
        raise HTTPException(404, "Workflow template not found")

    await db.delete(template)
    await db.commit()
    return {"status": "deleted"}


@router.get("/projects/{project_id}/workflow-templates/step-types")
async def get_step_types(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns available step types and their contracts for the workflow builder UI."""
    await require_project_role(db, project_id, user.id, ["admin", "architect", "developer"])

    return {
        "step_types": [
            {
                "type": st.value,
                "execution_mode": contract["execution_mode"].value,
                "input": contract["input"],
                "output": contract["output"],
                "description": contract["description"],
            }
            for st, contract in STEP_CONTRACTS.items()
        ]
    }


async def _clear_default(db: AsyncSession, project_id: str) -> None:
    """Unset is_default on all existing templates for this project."""
    result = await db.execute(
        select(WorkflowTemplate).where(
            WorkflowTemplate.project_id == project_id,
            WorkflowTemplate.is_default == True,
        )
    )
    for t in result.scalars().all():
        t.is_default = False
