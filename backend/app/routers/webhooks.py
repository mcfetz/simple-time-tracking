# ruff: noqa: B008
from __future__ import annotations

import logging
import secrets
from datetime import UTC, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.absence_service import local_date_from_utc, user_has_absence_on_date
from app.clock_validation import validate_event_fields
from app.db import get_db
from app.models import ClockEvent, PushSubscription, User, WebhookToken, utc_now
from app.push_service import send_web_push
from app.reporting import compute_day_summary, day_bounds_utc
from app.schemas import ClockEventResponse, Geo, WebhookTokenResponse
from app.security import get_current_user
from app.settings import settings


logger = logging.getLogger(__name__)


router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _generate_token() -> str:
    return secrets.token_urlsafe(32)


def _as_utc(value):
    from datetime import UTC as _UTC

    if value.tzinfo is None:
        return value.replace(tzinfo=_UTC)
    return value.astimezone(_UTC)


def _last_event(db: Session, user_id: int) -> ClockEvent | None:
    stmt = select(ClockEvent).where(ClockEvent.user_id == user_id).order_by(desc(ClockEvent.ts_utc)).limit(1)
    return db.scalar(stmt)


def _create_event_for_user(
    db: Session, user: User, event_type: str, location: str | None, offset: int | None = None
) -> ClockEvent:
    validate_event_fields(event_type=event_type, location=location)

    now = utc_now()
    if offset is not None:
        now = now + timedelta(minutes=offset)
        if now > utc_now() + timedelta(minutes=5):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="offset results in future timestamp",
            )
        if now < utc_now() - timedelta(days=7):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="offset too far in the past",
            )
    last = _last_event(db, user.id)
    if last is not None:
        last_ts = _as_utc(last.ts_utc)
        if now <= last_ts:
            if offset is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Event timestamp must be after last event",
                )
            now = last_ts + timedelta(microseconds=1)

    day_local = local_date_from_utc(now, user.timezone)
    absence = user_has_absence_on_date(db, user_id=user.id, day_local=day_local)
    if absence is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot create clock events on absence days",
        )

    event = ClockEvent(
        user_id=user.id,
        ts_utc=now,
        type=event_type,
        location=location,
        client_event_id=None,
        source="webhook",
    )
    db.add(event)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(event)
    return event


def _to_response(event: ClockEvent) -> ClockEventResponse:
    geo_out = None
    if event.geo_lat is not None and event.geo_lng is not None:
        geo_out = Geo(lat=event.geo_lat, lng=event.geo_lng, accuracy_m=event.geo_accuracy_m)
    return ClockEventResponse(
        id=event.id,
        ts_utc=_as_utc(event.ts_utc).isoformat(),
        type=event.type,
        location=event.location,
        geo=geo_out,
        client_event_id=event.client_event_id,
        source=event.source,
    )


def _lookup_user_by_token(db: Session, token: str) -> tuple[User, WebhookToken]:
    row = db.scalar(select(WebhookToken).where(WebhookToken.token == token))
    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook token")
    user = db.get(User, row.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook token")
    return user, row


# --- authenticated CRUD ---


@router.get("/token", response_model=WebhookTokenResponse)
def get_webhook_token(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.scalar(select(WebhookToken).where(WebhookToken.user_id == current_user.id))
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No webhook token")
    return WebhookTokenResponse(
        token=row.token,
        created_at=_as_utc(row.created_at).isoformat(),
        last_used_at=_as_utc(row.last_used_at).isoformat() if row.last_used_at else None,
    )


@router.post("/token", response_model=WebhookTokenResponse, status_code=status.HTTP_201_CREATED)
def create_webhook_token(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.scalar(select(WebhookToken).where(WebhookToken.user_id == current_user.id))
    new_token = _generate_token()
    now = utc_now()
    if row is not None:
        row.token = new_token
        row.created_at = now
        row.last_used_at = None
        db.commit()
        db.refresh(row)
        return WebhookTokenResponse(
            token=row.token,
            created_at=_as_utc(row.created_at).isoformat(),
            last_used_at=None,
        )
    row = WebhookToken(user_id=current_user.id, token=new_token, created_at=now)
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Token already exists")
    db.refresh(row)
    return WebhookTokenResponse(
        token=row.token,
        created_at=_as_utc(row.created_at).isoformat(),
        last_used_at=None,
    )


@router.delete("/token", status_code=status.HTTP_204_NO_CONTENT)
def delete_webhook_token(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.scalar(select(WebhookToken).where(WebhookToken.user_id == current_user.id))
    if row is None:
        return
    db.delete(row)
    db.commit()


def _handle_webhook_come(db: Session, token: str, location: str | None, offset: int | None = None) -> ClockEventResponse:
    user, row = _lookup_user_by_token(db, token)
    if location is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="location query param required (HOME or OFFICE)"
        )
    loc = location.strip().upper()
    if loc not in ("HOME", "OFFICE"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid location")
    event = _create_event_for_user(db, user, "COME", loc, offset=offset)
    resp = _to_response(event)
    row.last_used_at = _as_utc(event.ts_utc)
    db.commit()
    _trigger_webhook_push(db, user)
    return resp


def _handle_webhook_go(db: Session, token: str, offset: int | None = None) -> ClockEventResponse:
    user, row = _lookup_user_by_token(db, token)
    event = _create_event_for_user(db, user, "GO", None, offset=offset)
    resp = _to_response(event)
    row.last_used_at = _as_utc(event.ts_utc)
    db.commit()
    _trigger_webhook_push(db, user, go_event=event)
    return resp


def _trigger_webhook_push(db: Session, user: User, go_event: ClockEvent | None = None) -> None:
    if not (settings.vapid_public_key and settings.vapid_private_key):
        return
    subs = list(db.scalars(select(PushSubscription).where(PushSubscription.user_id == user.id)).all())
    if not subs:
        return

    if go_event is not None:
        day_local = local_date_from_utc(_as_utc(go_event.ts_utc), user.timezone)
        start_utc, end_utc = day_bounds_utc(day_local, user.timezone)
        rows = list(
            db.execute(
                select(ClockEvent.type, ClockEvent.ts_utc, ClockEvent.location)
                .where(ClockEvent.user_id == user.id)
                .where(ClockEvent.ts_utc >= start_utc)
                .where(ClockEvent.ts_utc < end_utc)
                .order_by(ClockEvent.ts_utc.asc())
            ).all()
        )
        events = [(t, ts, loc) for (t, ts, loc) in rows]
        summary = compute_day_summary(day_local=day_local, tz=user.timezone, events=events, now_utc=_as_utc(go_event.ts_utc))
        wm = summary.worked_minutes
        hours = wm // 60
        mins = wm % 60
        dur = f"{hours}h {mins}min" if hours else f"{mins}min"
        day_str = day_local.isoformat()

    for sub in subs:
        if go_event is not None:
            if sub.lang == "de":
                body = f"Gehen gebucht ({day_str}). Tages-Saldo: {dur}."
            else:
                body = f"Clock-out booked ({day_str}). Daily total: {dur}."
        else:
            if sub.lang == "de":
                body = "Kommen gebucht."
            else:
                body = "Clock-in booked."
        payload = {"title": "STT", "body": body, "url": "/"}
        try:
            send_web_push(
                endpoint=sub.endpoint,
                p256dh=sub.p256dh,
                auth=sub.auth,
                vapid_public_key=settings.vapid_public_key,
                vapid_private_key=settings.vapid_private_key,
                vapid_subject=settings.vapid_subject,
                payload=payload,
            )
        except Exception as e:
            status_code = getattr(getattr(e, "response", None), "status_code", None) or getattr(getattr(e, "response", None), "status", None)
            if status_code in (404, 410):
                persisted = db.get(PushSubscription, sub.id)
                if persisted is not None:
                    db.delete(persisted)
                    db.commit()
            logger.warning("webhook push failed for user %s: %s", user.id, e)


# --- public webhook triggers (no auth; GET+POST) ---


@router.get("/{token}/come", response_model=ClockEventResponse)
def webhook_come_get(
    token: str,
    location: str | None = Query(default=None, description="HOME or OFFICE"),
    offset: int | None = Query(default=None, description="Offset in minutes relative to now"),
    db: Session = Depends(get_db),
):
    return _handle_webhook_come(db, token, location, offset=offset)


@router.post("/{token}/come", response_model=ClockEventResponse)
def webhook_come_post(
    token: str,
    location: str | None = Query(default=None, description="HOME or OFFICE"),
    offset: int | None = Query(default=None, description="Offset in minutes relative to now"),
    db: Session = Depends(get_db),
):
    return _handle_webhook_come(db, token, location, offset=offset)


@router.get("/{token}/go", response_model=ClockEventResponse)
def webhook_go_get(
    token: str,
    offset: int | None = Query(default=None, description="Offset in minutes relative to now"),
    db: Session = Depends(get_db),
):
    return _handle_webhook_go(db, token, offset=offset)


@router.post("/{token}/go", response_model=ClockEventResponse)
def webhook_go_post(
    token: str,
    offset: int | None = Query(default=None, description="Offset in minutes relative to now"),
    db: Session = Depends(get_db),
):
    return _handle_webhook_go(db, token, offset=offset)
