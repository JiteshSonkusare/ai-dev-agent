import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return f"{salt}:{hashed.hex()}"


def verify_password(password: str, stored: str) -> bool:
    salt, hashed = stored.split(":")
    check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return check.hex() == hashed


def create_session_token() -> str:
    return secrets.token_urlsafe(32)


def token_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=settings.session_expire_hours)
