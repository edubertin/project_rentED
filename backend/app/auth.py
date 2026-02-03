import os
import secrets
from datetime import datetime, timedelta, timezone

from passlib.context import CryptContext


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def session_ttl_minutes() -> int:
    return int(os.getenv("SESSION_TTL_MINUTES", "120"))


def cookie_name() -> str:
    return os.getenv("SESSION_COOKIE_NAME", "rented_session")


def cookie_secure() -> bool:
    return os.getenv("COOKIE_SECURE", "false").lower() == "true"


def new_session_id() -> str:
    return secrets.token_urlsafe(32)


def session_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=session_ttl_minutes())
