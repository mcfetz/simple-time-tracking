# ruff: noqa: B008

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, UTC

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AuthSession, User, utc_now
from app.settings import settings


http_bearer = HTTPBearer(auto_error=False)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _password_bytes(password: str) -> bytes:
    raw = password.encode("utf-8")
    if len(raw) > 72:  # noqa: PLR2004
        return hashlib.sha256(raw).digest()
    return raw


def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(_password_bytes(password), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(_password_bytes(password), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(*, user_id: int, token_version: int) -> str:
    now = datetime.now(UTC)
    exp = now + timedelta(minutes=settings.access_token_minutes)
    payload = {
        "sub": str(user_id),
        "tv": token_version,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(
        payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )


def create_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def refresh_token_hash(refresh_token: str) -> str:
    return hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()


def create_auth_session(
    *, db: Session, user_id: int, refresh_token: str
) -> AuthSession:
    expires_at = utc_now() + timedelta(days=settings.refresh_token_days)
    session = AuthSession(
        user_id=user_id,
        refresh_token_hash=refresh_token_hash(refresh_token),
        expires_at=expires_at,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def decode_access_token(token: str) -> tuple[int, int]:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token",
        ) from exc

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token",
        )

    token_version_raw = payload.get("tv")
    if token_version_raw is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token",
        )

    try:
        return int(sub), int(token_version_raw)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token",
        ) from exc


def get_current_user(
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(http_bearer),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    user_id, token_version = decode_access_token(credentials.credentials)
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    if user.token_version != token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return user


def get_valid_auth_session(*, db: Session, refresh_token: str) -> AuthSession | None:
    token_hash = refresh_token_hash(refresh_token)
    stmt = select(AuthSession).where(AuthSession.refresh_token_hash == token_hash)
    auth_session = db.scalar(stmt)
    if auth_session is None:
        return None
    if auth_session.revoked_at is not None:
        return None
    if _as_utc(auth_session.expires_at) <= utc_now():
        return None
    return auth_session


def rotate_auth_session(*, db: Session, auth_session: AuthSession) -> str:
    auth_session.revoked_at = utc_now()
    auth_session.last_used_at = utc_now()

    new_refresh = create_refresh_token()
    new_session = AuthSession(
        user_id=auth_session.user_id,
        refresh_token_hash=refresh_token_hash(new_refresh),
        created_at=utc_now(),
        last_used_at=utc_now(),
        expires_at=utc_now() + timedelta(days=settings.refresh_token_days),
    )
    db.add(new_session)
    db.commit()
    return new_refresh
