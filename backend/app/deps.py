from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import cookie_name
from app.db import SessionLocal
from app.models import Session as UserSession
from app.models import User


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    session_id = request.cookies.get(cookie_name())
    if not session_id:
        raise HTTPException(status_code=401, detail="not_authenticated")
    session = db.execute(
        select(UserSession).where(UserSession.id == session_id)
    ).scalar_one_or_none()
    if session is None or session.revoked_at is not None:
        raise HTTPException(status_code=401, detail="session_invalid")
    if session.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="session_expired")
    user = db.get(User, session.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="user_not_found")
    return user


def get_optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    session_id = request.cookies.get(cookie_name())
    if not session_id:
        return None
    session = db.execute(
        select(UserSession).where(UserSession.id == session_id)
    ).scalar_one_or_none()
    if session is None or session.revoked_at is not None:
        return None
    if session.expires_at < datetime.now(timezone.utc):
        return None
    return db.get(User, session.user_id)


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="forbidden")
    return user
