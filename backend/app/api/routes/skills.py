"""Skills repo configuration and skill discovery endpoints."""

from __future__ import annotations
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.encryption import decrypt
from app.api.deps import get_current_user, require_project_role
from app.models.models import Connection, SkillsRepo, User
from app.services.skills import SkillsService
from app.engine.skill_loader import load_skill, _parse_frontmatter

router = APIRouter()


class SkillsRepoCreate(BaseModel):
    connection_id: str
    repo_name: str
    branch: str = "main"
    skills_path: str = "/skills"
    rules_path: str = "/rules"


class SkillsRepoResponse(BaseModel):
    id: str
    connection_id: str
    repo_name: str
    branch: str
    skills_path: str
    rules_path: str
    last_synced_at: Optional[str]


class SkillInfo(BaseModel):
    path: str
    name: str
    description: str
    model: str


@router.post("/projects/{project_id}/skills-repos", response_model=SkillsRepoResponse)
async def create_skills_repo(
    project_id: str,
    req: SkillsRepoCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_project_role(db, project_id, user.id, ["admin", "architect"])

    conn = await db.get(Connection, req.connection_id)
    if not conn or conn.project_id != project_id:
        raise HTTPException(404, "Connection not found")

    repo = SkillsRepo(
        project_id=project_id,
        connection_id=req.connection_id,
        repo_name=req.repo_name,
        branch=req.branch,
        skills_path=req.skills_path,
        rules_path=req.rules_path,
    )
    db.add(repo)
    await db.commit()
    await db.refresh(repo)

    return SkillsRepoResponse(
        id=repo.id,
        connection_id=repo.connection_id,
        repo_name=repo.repo_name,
        branch=repo.branch,
        skills_path=repo.skills_path,
        rules_path=repo.rules_path,
        last_synced_at=repo.last_synced_at.isoformat() if repo.last_synced_at else None,
    )


@router.get("/projects/{project_id}/skills-repos")
async def list_skills_repos(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_project_role(db, project_id, user.id, ["admin", "architect", "developer", "viewer"])

    result = await db.execute(select(SkillsRepo).where(SkillsRepo.project_id == project_id))
    repos = result.scalars().all()
    return [
        {
            "id": r.id,
            "connection_id": r.connection_id,
            "repo_name": r.repo_name,
            "branch": r.branch,
            "skills_path": r.skills_path,
            "rules_path": r.rules_path,
            "last_synced_at": r.last_synced_at.isoformat() if r.last_synced_at else None,
        }
        for r in repos
    ]


@router.delete("/projects/{project_id}/skills-repos/{repo_id}")
async def delete_skills_repo(
    project_id: str,
    repo_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_project_role(db, project_id, user.id, ["admin", "architect"])

    repo = await db.get(SkillsRepo, repo_id)
    if not repo or repo.project_id != project_id:
        raise HTTPException(404, "Skills repo not found")

    await db.delete(repo)
    await db.commit()
    return {"status": "deleted"}


@router.get("/projects/{project_id}/skills-repos/{repo_id}/skills")
async def discover_skills(
    project_id: str,
    repo_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Discover available skills in the repo.
    Lists skill folders by attempting to fetch SKILL.md from known paths.
    For full directory listing, the frontend can pass skill_paths param.
    """
    await require_project_role(db, project_id, user.id, ["admin", "architect", "developer"])

    repo = await db.get(SkillsRepo, repo_id)
    if not repo or repo.project_id != project_id:
        raise HTTPException(404, "Skills repo not found")

    conn = await db.get(Connection, repo.connection_id)
    if not conn:
        raise HTTPException(404, "Connection not found")

    svc = _build_skills_service(conn)
    skills: List[dict] = []

    # Try common skill folder names — in production, this would use repo tree API
    # For now, the architect provides known skill paths via the skills_repo config
    # or we attempt discovery via a manifest
    try:
        manifest_content = await svc.fetch_file(f"{repo.skills_path}/manifest.json", repo.branch)
        import json
        manifest = json.loads(manifest_content)
        skill_folders = manifest.get("skills", [])
    except Exception:
        skill_folders = []

    for folder in skill_folders:
        try:
            skill_md = await svc.fetch_file(f"{repo.skills_path}/{folder}/SKILL.md", repo.branch)
            fm = _parse_frontmatter(skill_md)
            skills.append({
                "path": folder,
                "name": fm.get("name", folder),
                "description": fm.get("description", ""),
                "model": fm.get("model", "claude-sonnet-4-6"),
            })
        except Exception:
            pass

    return {"skills": skills}


@router.get("/projects/{project_id}/skills-repos/{repo_id}/skills/{skill_path:path}")
async def preview_skill(
    project_id: str,
    repo_id: str,
    skill_path: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Preview a specific skill — returns frontmatter, phases, and gate info."""
    await require_project_role(db, project_id, user.id, ["admin", "architect", "developer"])

    repo = await db.get(SkillsRepo, repo_id)
    if not repo or repo.project_id != project_id:
        raise HTTPException(404, "Skills repo not found")

    conn = await db.get(Connection, repo.connection_id)
    if not conn:
        raise HTTPException(404, "Connection not found")

    svc = _build_skills_service(conn)

    try:
        skill_md = await svc.fetch_file(f"{repo.skills_path}/{skill_path}/SKILL.md", repo.branch)
    except Exception:
        raise HTTPException(404, f"Skill '{skill_path}' not found in repo")

    fm = _parse_frontmatter(skill_md)

    return {
        "path": skill_path,
        "name": fm.get("name", skill_path),
        "description": fm.get("description", ""),
        "model": fm.get("model", "claude-sonnet-4-6"),
        "user_invocable": fm.get("user-invocable", "false") == "true",
        "skill_md_preview": skill_md[:2000],
    }


def _build_skills_service(conn: Connection) -> SkillsService:
    """Build a SkillsService from a connection record."""
    return SkillsService(
        connection_type=conn.type,
        config={
            "base_url": conn.base_url,
            "pat": decrypt(conn.credentials_encrypted),
            "project_name": conn.project_name,
            "repo_name": conn.extra_config.get("repo_name", ""),
            "owner": conn.extra_config.get("owner", ""),
        },
    )
