from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.auth import hash_password, verify_password, create_session_token, token_expiry
from app.models.models import User, Session, Org, OrgMember, Project, ProjectMember
from app.api.deps import get_current_user

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    email: str
    name: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    user_id: str
    email: str
    name: str
    project_id: str


class UserProfileResponse(BaseModel):
    id: str
    email: str
    name: str
    github_username: Optional[str] = None
    github_email: Optional[str] = None
    project_id: Optional[str] = None
    created_at: str


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    github_username: Optional[str] = None
    github_email: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _get_user_project_id(db: AsyncSession, user_id: str) -> str:
    """Get the user's default project ID. Every user gets one on registration."""
    result = await db.execute(
        select(ProjectMember.project_id).where(ProjectMember.user_id == user_id).limit(1)
    )
    project_id = result.scalar_one_or_none()
    return project_id or ""


async def _create_default_org_and_project(db: AsyncSession, user: User) -> str:
    """Create a default org and project for a new user. Returns project_id."""
    slug = user.email.split("@")[0].lower().replace(".", "-").replace("+", "-")

    # Check slug uniqueness, append suffix if needed
    base_slug = slug
    counter = 1
    while True:
        existing = await db.execute(select(Org).where(Org.slug == slug))
        if not existing.scalar_one_or_none():
            break
        slug = f"{base_slug}-{counter}"
        counter += 1

    org = Org(name=f"{user.name}'s Workspace", slug=slug)
    db.add(org)
    await db.flush()

    org_member = OrgMember(org_id=org.id, user_id=user.id, role="org_admin")
    db.add(org_member)

    project = Project(org_id=org.id, name="Default Project", created_by=user.id)
    db.add(project)
    await db.flush()

    project_member = ProjectMember(project_id=project.id, user_id=user.id, role="admin")
    db.add(project_member)

    return project.id


# ── Auth endpoints ───────────────────────────────────────────────────────────


@router.post("/register", response_model=AuthResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Email already registered")

    user = User(email=req.email, name=req.name, password_hash=hash_password(req.password))
    db.add(user)
    await db.flush()

    # Auto-create default org + project
    project_id = await _create_default_org_and_project(db, user)

    token = create_session_token()
    session = Session(user_id=user.id, token=token, expires_at=token_expiry())
    db.add(session)

    await db.commit()
    return AuthResponse(token=token, user_id=user.id, email=user.email, name=user.name, project_id=project_id)


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user or not user.password_hash or not verify_password(req.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")

    project_id = await _get_user_project_id(db, user.id)

    token = create_session_token()
    session = Session(user_id=user.id, token=token, expires_at=token_expiry())
    db.add(session)
    await db.commit()
    return AuthResponse(token=token, user_id=user.id, email=user.email, name=user.name, project_id=project_id)


@router.post("/logout")
async def logout(token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Session).where(Session.token == token))
    session = result.scalar_one_or_none()
    if session:
        await db.delete(session)
        await db.commit()
    return {"status": "ok"}


# ── Profile endpoints ────────────────────────────────────────────────────────


@router.get("/me", response_model=UserProfileResponse)
async def get_me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project_id = await _get_user_project_id(db, user.id)
    return UserProfileResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        github_username=user.github_username,
        github_email=user.github_email,
        project_id=project_id,
        created_at=user.created_at.isoformat(),
    )


@router.put("/me/profile", response_model=UserProfileResponse)
async def update_profile(
    req: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if req.name is not None:
        user.name = req.name
    if req.github_username is not None:
        user.github_username = req.github_username
    if req.github_email is not None:
        user.github_email = req.github_email

    await db.commit()
    await db.refresh(user)

    project_id = await _get_user_project_id(db, user.id)
    return UserProfileResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        github_username=user.github_username,
        github_email=user.github_email,
        project_id=project_id,
        created_at=user.created_at.isoformat(),
    )


@router.post("/me/password")
async def change_password(
    req: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.password_hash or not verify_password(req.current_password, user.password_hash):
        raise HTTPException(400, "Current password is incorrect")

    if len(req.new_password) < 6:
        raise HTTPException(400, "New password must be at least 6 characters")

    user.password_hash = hash_password(req.new_password)
    await db.commit()
    return {"status": "ok"}
