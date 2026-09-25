import json
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy import String, DateTime, ForeignKey, Text, Boolean, Integer, Float, TypeDecorator
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


# ── JSON-as-Text column (works on SQLite + MS SQL + PostgreSQL) ──────────────

class JSONText(TypeDecorator):
    """Stores JSON as TEXT — compatible with all DB backends."""
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return json.dumps(value) if value is not None else None

    def process_result_value(self, value, dialect):
        return json.loads(value) if value is not None else None


# ── Helpers ──────────────────────────────────────────────────────────────────

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


# ── Auth ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), index=True)
    name: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(512), nullable=True)
    role: Mapped[str] = mapped_column(String(50), default="developer")  # free-text: admin, developer, architect, etc.
    github_username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    github_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    org_memberships: Mapped[List["OrgMember"]] = relationship(back_populates="user")
    sessions: Mapped[List["Session"]] = relationship(back_populates="user")


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    user: Mapped["User"] = relationship(back_populates="sessions")


# ── Org ──────────────────────────────────────────────────────────────────────

class Org(Base):
    __tablename__ = "orgs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    members: Mapped[List["OrgMember"]] = relationship(back_populates="org", cascade="all, delete-orphan")


class OrgMember(Base):
    __tablename__ = "org_members"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    org_id: Mapped[str] = mapped_column(ForeignKey("orgs.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

    org: Mapped["Org"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="org_memberships")


# ── Connections (per user) ───────────────────────────────────────────────────

class Connection(Base):
    __tablename__ = "connections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(30))
    auth_type: Mapped[str] = mapped_column(String(20))
    credentials_encrypted: Mapped[str] = mapped_column(Text)
    base_url: Mapped[str] = mapped_column(String(500), default="")
    extra_config: Mapped[dict] = mapped_column(JSONText, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="connected")
    label: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


# ── Skills (per user) ───────────────────────────────────────────────────────

class Skill(Base):
    __tablename__ = "skills"

    SKILL_TYPES = ("develop", "review", "plan")

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    skill_type: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text, default="")
    description: Mapped[str] = mapped_column(String(500), default="")
    repository: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


# ── Runs + Steps + Gates ─────────────────────────────────────────────────────

class Run(Base):
    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    task_id: Mapped[Optional[str]] = mapped_column(ForeignKey("tasks.id"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="running")
    current_step: Mapped[str] = mapped_column(String(30), default="")
    workspace_path: Mapped[str] = mapped_column(String(500), default="")
    branch_name: Mapped[str] = mapped_column(String(255), default="")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    pr_urls_json: Mapped[list] = mapped_column(JSONText, default=list)
    total_input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    model: Mapped[str] = mapped_column(String(50), default="")
    error: Mapped[str] = mapped_column(Text, default="")

    run_steps: Mapped[List["RunStep"]] = relationship(back_populates="run", cascade="all, delete-orphan")
    gates: Mapped[List["Gate"]] = relationship(back_populates="run", cascade="all, delete-orphan")


class RunStep(Base):
    __tablename__ = "run_steps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), index=True)
    step_name: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    tool_calls: Mapped[list] = mapped_column(JSONText, default=list)
    reasoning: Mapped[list] = mapped_column(JSONText, default=list)
    tokens_in: Mapped[int] = mapped_column(Integer, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, default=0)
    output: Mapped[dict] = mapped_column(JSONText, default=dict)
    error: Mapped[str] = mapped_column(Text, default="")

    run: Mapped["Run"] = relationship(back_populates="run_steps")


class Gate(Base):
    __tablename__ = "gates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), index=True)
    step_name: Mapped[str] = mapped_column(String(30))
    gate_type: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    payload: Mapped[dict] = mapped_column(JSONText, default=dict)
    developer_response: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    run: Mapped["Run"] = relationship(back_populates="gates")


# ── Tasks ────────────────────────────────────────────────────────────────────

class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    run_id: Mapped[Optional[str]] = mapped_column(ForeignKey("runs.id"), nullable=True, index=True)
    github_issue_number: Mapped[int] = mapped_column(Integer)
    github_url: Mapped[str] = mapped_column(String(500))
    title: Mapped[str] = mapped_column(String(500))
    body: Mapped[str] = mapped_column(Text, default="")
    repo_owner: Mapped[str] = mapped_column(String(255))
    repo_name: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(30), default="open")
    priority: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    labels: Mapped[list] = mapped_column(JSONText, default=list)
    story_points: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    due_date: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    github_created_at: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    pulled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
