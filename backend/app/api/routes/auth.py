from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.auth import hash_password, verify_password, create_session_token, token_expiry
from app.models.models import User, Session, Org, OrgMember
from app.api.deps import get_current_user

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    name: str
    password: str
    org_name: str = ""  # only for first user


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    user_id: str
    email: str
    name: str
    role: str


class UserProfileResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    github_username: Optional[str] = None
    github_email: Optional[str] = None
    created_at: str


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    github_username: Optional[str] = None
    github_email: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class CreateUserRequest(BaseModel):
    email: str
    name: str
    password: str
    role: str = "developer"


class UserListResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    github_username: Optional[str] = None
    created_at: str


# ── Auth endpoints ───────────────────────────────────────────────────────────


@router.get("/can-register")
async def can_register(db: AsyncSession = Depends(get_db)):
    """Check if first-user registration is available."""
    count = await db.execute(select(func.count()).select_from(User))
    return {"can_register": count.scalar() == 0}


@router.post("/register", response_model=AuthResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """First user registration — creates org and becomes admin. Disabled after first user."""
    # Check if any users exist
    count = await db.execute(select(func.count()).select_from(User))
    user_count = count.scalar()

    if user_count > 0:
        raise HTTPException(400, "Registration disabled. Ask your admin to create an account for you.")

    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Email already registered")

    # Create first user as admin
    user = User(email=req.email, name=req.name, password_hash=hash_password(req.password), role="admin")
    db.add(user)
    await db.flush()

    # Create org
    org_name = req.org_name or f"{req.name}'s Organization"
    slug = req.email.split("@")[0].lower().replace(".", "-").replace("+", "-")
    org = Org(name=org_name, slug=slug)
    db.add(org)
    await db.flush()

    org_member = OrgMember(org_id=org.id, user_id=user.id)
    db.add(org_member)

    token = create_session_token()
    session = Session(user_id=user.id, token=token, expires_at=token_expiry())
    db.add(session)

    await db.commit()
    return AuthResponse(token=token, user_id=user.id, email=user.email, name=user.name, role=user.role)


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user or not user.password_hash or not verify_password(req.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")

    token = create_session_token()
    session = Session(user_id=user.id, token=token, expires_at=token_expiry())
    db.add(session)
    await db.commit()
    return AuthResponse(token=token, user_id=user.id, email=user.email, name=user.name, role=user.role)


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
async def get_me(user: User = Depends(get_current_user)):
    return UserProfileResponse(
        id=user.id, email=user.email, name=user.name, role=user.role,
        github_username=user.github_username, github_email=user.github_email,
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
    return UserProfileResponse(
        id=user.id, email=user.email, name=user.name, role=user.role,
        github_username=user.github_username, github_email=user.github_email,
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


# ── Admin: User Management ───────────────────────────────────────────────────


@router.post("/admin/users", response_model=UserListResponse)
async def create_user(
    req: CreateUserRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin creates a new user and adds them to the org."""
    if user.role != "admin":
        raise HTTPException(403, "Only admins can create users")

    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Email already registered")

    if len(req.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    new_user = User(
        email=req.email, name=req.name, role=req.role,
        password_hash=hash_password(req.password),
    )
    db.add(new_user)
    await db.flush()

    # Add to admin's org
    org_member_result = await db.execute(
        select(OrgMember.org_id).where(OrgMember.user_id == user.id).limit(1)
    )
    org_id = org_member_result.scalar_one_or_none()
    if org_id:
        db.add(OrgMember(org_id=org_id, user_id=new_user.id))

    await db.commit()
    return UserListResponse(
        id=new_user.id, email=new_user.email, name=new_user.name,
        role=new_user.role, github_username=new_user.github_username,
        created_at=new_user.created_at.isoformat(),
    )


@router.get("/admin/users", response_model=List[UserListResponse])
async def list_users(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin lists all users in the org."""
    if user.role != "admin":
        raise HTTPException(403, "Only admins can manage users")

    # Get admin's org
    org_result = await db.execute(
        select(OrgMember.org_id).where(OrgMember.user_id == user.id).limit(1)
    )
    org_id = org_result.scalar_one_or_none()
    if not org_id:
        return []

    # Get all users in org
    result = await db.execute(
        select(User).join(OrgMember, OrgMember.user_id == User.id).where(OrgMember.org_id == org_id)
    )
    users = result.scalars().all()
    return [
        UserListResponse(
            id=u.id, email=u.email, name=u.name, role=u.role,
            github_username=u.github_username,
            created_at=u.created_at.isoformat(),
        )
        for u in users
    ]


@router.delete("/admin/users/{user_id}")
async def delete_user(
    user_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin deletes a user."""
    if user.role != "admin":
        raise HTTPException(403, "Only admins can manage users")
    if user_id == user.id:
        raise HTTPException(400, "Cannot delete yourself")

    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(404, "User not found")

    await db.delete(target)
    await db.commit()
    return {"status": "ok"}
