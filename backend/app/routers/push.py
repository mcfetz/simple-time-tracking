# ruff: noqa: B008

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import PushSubscription, User
from app.schemas import (
    PushSubscriptionRequest,
    PushTestRequest,
    PushUnsubscribeRequest,
    VapidPublicKeyResponse,
)
from app.security import get_current_user
from app.settings import settings
from app.push_service import send_web_push

router = APIRouter(prefix="/push", tags=["push"])


@router.get("/vapid-public-key", response_model=VapidPublicKeyResponse)
def vapid_public_key() -> VapidPublicKeyResponse:
    return VapidPublicKeyResponse(public_key=settings.vapid_public_key)


@router.post("/subscribe")
def subscribe(
    payload: PushSubscriptionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    lang = (payload.lang or "en").strip() or "en"
    lang = "de" if lang.lower().startswith("de") else "en"

    existing = db.scalar(
        select(PushSubscription)
        .where(PushSubscription.endpoint == payload.endpoint)
        .limit(1)
    )
    if existing is not None:
        existing.user_id = current_user.id
        existing.p256dh = payload.keys.p256dh
        existing.auth = payload.keys.auth
        existing.lang = lang
        existing.last_seen_at = datetime.now(UTC)
        db.commit()
        return {"status": "ok"}

    sub = PushSubscription(
        user_id=current_user.id,
        endpoint=payload.endpoint,
        p256dh=payload.keys.p256dh,
        auth=payload.keys.auth,
        lang=lang,
        last_seen_at=datetime.now(UTC),
    )
    db.add(sub)
    db.commit()
    return {"status": "ok"}


@router.delete("/subscribe")
def unsubscribe(
    payload: PushUnsubscribeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    sub = db.scalar(
        select(PushSubscription)
        .where(PushSubscription.user_id == current_user.id)
        .where(PushSubscription.endpoint == payload.endpoint)
        .limit(1)
    )
    if sub is not None:
        db.delete(sub)
        db.commit()
    return {"status": "ok"}


@router.post("/test")
def test_push(
    payload: PushTestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    sub = db.scalar(
        select(PushSubscription)
        .where(PushSubscription.user_id == current_user.id)
        .where(PushSubscription.endpoint == payload.endpoint)
        .limit(1)
    )
    if sub is None:
        return {"status": "not_subscribed"}

    title = "STT"
    body = (
        "This is a test notification."
        if sub.lang == "en"
        else "Das ist eine Test-Benachrichtigung."
    )

    send_web_push(
        endpoint=sub.endpoint,
        p256dh=sub.p256dh,
        auth=sub.auth,
        vapid_public_key=settings.vapid_public_key,
        vapid_private_key=settings.vapid_private_key,
        vapid_subject=settings.vapid_subject,
        payload={"title": title, "body": body, "url": "/settings"},
    )

    return {"status": "ok"}
