# ruff: noqa: B008

from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AbsenceReason, User, UserSettings, utc_now
from app.schemas import (
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserPublic,
)
from app.security import (
    create_access_token,
    create_auth_session,
    create_refresh_token,
    get_current_user,
    get_valid_auth_session,
    hash_password,
    rotate_auth_session,
    verify_password,
)
from app.settings import settings


router = APIRouter(prefix="/auth", tags=["auth"])


def _set_refresh_cookie(*, response: Response, refresh_token: str) -> None:
    samesite = settings.cookie_samesite
    response.set_cookie(
        key="tt_refresh",
        value=refresh_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=samesite,
        max_age=settings.refresh_token_days * 24 * 60 * 60,
        path="/auth",
    )


@router.post("/register", response_model=AuthResponse)
def register(
    payload: RegisterRequest, response: Response, db: Session = Depends(get_db)
):
    email = payload.email.lower()
    existing = db.scalar(select(User).where(User.email == email))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email already exists"
        )

    user = User(email=email, password_hash=hash_password(payload.password))
    user.settings = UserSettings()

    db.add(user)
    db.commit()
    db.refresh(user)

    db.add_all(
        [
            AbsenceReason(user_id=user.id, name="Urlaub"),
            AbsenceReason(user_id=user.id, name="Krankheit"),
            AbsenceReason(user_id=user.id, name="Dienstreise"),
        ]
    )
    db.commit()

    refresh = create_refresh_token()
    create_auth_session(db=db, user_id=user.id, refresh_token=refresh)
    _set_refresh_cookie(response=response, refresh_token=refresh)

    token = TokenResponse(access_token=create_access_token(user_id=user.id))
    return AuthResponse(
        token=token,
        user=UserPublic(id=user.id, email=user.email, timezone=user.timezone),
    )


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    email = payload.email.lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )

    refresh = create_refresh_token()
    create_auth_session(db=db, user_id=user.id, refresh_token=refresh)
    _set_refresh_cookie(response=response, refresh_token=refresh)

    token = TokenResponse(access_token=create_access_token(user_id=user.id))
    return AuthResponse(
        token=token,
        user=UserPublic(id=user.id, email=user.email, timezone=user.timezone),
    )


@router.post("/refresh", response_model=AuthResponse)
def refresh(
    response: Response,
    refresh_cookie: str | None = Cookie(default=None, alias="tt_refresh"),
    db: Session = Depends(get_db),
):
    if refresh_cookie is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )

    auth_session = get_valid_auth_session(db=db, refresh_token=refresh_cookie)
    if auth_session is None:
        response.delete_cookie(key="tt_refresh", path="/auth")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )

    new_refresh = rotate_auth_session(db=db, auth_session=auth_session)
    _set_refresh_cookie(response=response, refresh_token=new_refresh)

    user = db.get(User, auth_session.user_id)
    if user is None:
        response.delete_cookie(key="tt_refresh", path="/auth")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )

    token = TokenResponse(access_token=create_access_token(user_id=user.id))
    return AuthResponse(
        token=token,
        user=UserPublic(id=user.id, email=user.email, timezone=user.timezone),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    refresh_cookie: str | None = Cookie(default=None, alias="tt_refresh"),
    db: Session = Depends(get_db),
):
    if refresh_cookie is not None:
        auth_session = get_valid_auth_session(db=db, refresh_token=refresh_cookie)
        if auth_session is not None:
            auth_session.revoked_at = utc_now()
            db.commit()

    response.delete_cookie(key="tt_refresh", path="/auth")


@router.get("/me", response_model=UserPublic)
def me(current_user: User = Depends(get_current_user)):
    return UserPublic(
        id=current_user.id,
        email=current_user.email,
        timezone=current_user.timezone,
    )
