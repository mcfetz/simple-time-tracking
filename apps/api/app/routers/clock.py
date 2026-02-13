# ruff: noqa: B008

from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.clock_validation import validate_event_fields, validate_sequence
from app.db import get_db
from app.models import ClockEvent, User, utc_now
from app.schemas import (
    ClockEventResponse,
    CreateClockEventRequest,
    Geo,
    UpdateClockEventRequest,
)
from app.security import get_current_user

from ..absence_service import local_date_from_utc, user_has_absence_on_date

router = APIRouter(prefix="/clock", tags=["clock"])


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _validate_payload(
    payload: CreateClockEventRequest,
) -> tuple[str, str | None]:
    event_type = payload.type
    location = payload.location
    validate_event_fields(event_type=event_type, location=location)

    if payload.geo is not None and event_type != "COME":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Geo only allowed for COME",
        )

    return event_type, location


def _last_event(db: Session, user_id: int) -> ClockEvent | None:
    stmt = (
        select(ClockEvent)
        .where(ClockEvent.user_id == user_id)
        .order_by(desc(ClockEvent.ts_utc))
        .limit(1)
    )
    return db.scalar(stmt)


def _enforce_transition(last: ClockEvent | None, next_type: str) -> None:
    if last is None:
        if next_type != "COME":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="First event must be COME"
            )
        return

    last_type = last.type
    if last_type == "COME":
        if next_type in ("COME", "BREAK_END"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Invalid transition"
            )
        return

    if last_type == "BREAK_START":
        if next_type not in ("BREAK_END", "GO"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Invalid transition"
            )
        return

    if last_type == "BREAK_END":
        if next_type in ("BREAK_END",):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Invalid transition"
            )
        if next_type == "GO":
            return
        if next_type == "BREAK_START":
            return
        if next_type == "COME":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Already working"
            )

    if last_type == "GO" and next_type != "COME":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Invalid transition"
        )


def _load_user_events(db: Session, user_id: int) -> list[ClockEvent]:
    stmt = (
        select(ClockEvent)
        .where(ClockEvent.user_id == user_id)
        .order_by(ClockEvent.ts_utc.asc())
    )
    return list(db.scalars(stmt).all())


@router.post("/events", response_model=ClockEventResponse)
def create_event(
    payload: CreateClockEventRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event_type, location = _validate_payload(payload)

    last = _last_event(db, current_user.id)
    _enforce_transition(last, event_type)

    geo_lat = payload.geo.lat if payload.geo else None
    geo_lng = payload.geo.lng if payload.geo else None
    geo_acc = payload.geo.accuracy_m if payload.geo else None

    now = utc_now()
    client_ts = payload.ts_utc is not None
    if payload.ts_utc is not None:
        candidate = payload.ts_utc
        candidate = (
            candidate.replace(tzinfo=UTC)
            if candidate.tzinfo is None
            else candidate.astimezone(UTC)
        )

        if candidate > now + timedelta(minutes=5):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="ts_utc cannot be in the future",
            )

        if candidate < now - timedelta(days=7):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="ts_utc too old",
            )
        now = candidate
    if last is not None:
        last_ts = _as_utc(last.ts_utc)
        if now <= last_ts:
            if client_ts:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Event timestamp must be after last event",
                )
            now = last_ts + timedelta(microseconds=1)

    day_local = local_date_from_utc(now, current_user.timezone)
    absence = user_has_absence_on_date(db, user_id=current_user.id, day_local=day_local)
    if absence is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot create clock events on absence days",
        )

    event = ClockEvent(
        user_id=current_user.id,
        ts_utc=now,
        type=event_type,
        location=location,
        geo_lat=geo_lat,
        geo_lng=geo_lng,
        geo_accuracy_m=geo_acc,
        client_event_id=payload.client_event_id,
    )
    db.add(event)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if payload.client_event_id is None:
            raise

        stmt = (
            select(ClockEvent)
            .where(ClockEvent.user_id == current_user.id)
            .where(ClockEvent.client_event_id == payload.client_event_id)
            .limit(1)
        )
        existing = db.scalar(stmt)
        if existing is None:
            raise
        event = existing

    db.refresh(event)

    geo_out = None
    if event.geo_lat is not None and event.geo_lng is not None:
        geo_out = Geo(
            lat=event.geo_lat, lng=event.geo_lng, accuracy_m=event.geo_accuracy_m
        )

    return ClockEventResponse(
        id=event.id,
        ts_utc=_as_utc(event.ts_utc).isoformat(),
        type=event.type,
        location=event.location,
        geo=geo_out,
        client_event_id=event.client_event_id,
    )


@router.get("/events", response_model=list[ClockEventResponse])
def list_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 50,
    start_local: str | None = None,
    end_local_exclusive: str | None = None,
):

    stmt = select(ClockEvent).where(ClockEvent.user_id == current_user.id)

    if start_local is not None or end_local_exclusive is not None:
        if start_local is None or end_local_exclusive is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="start_local and end_local_exclusive must be provided together",
            )

        try:
            start_d = date.fromisoformat(start_local)
            end_d = date.fromisoformat(end_local_exclusive)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid date format; expected YYYY-MM-DD",
            ) from None

        if end_d <= start_d:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="end_local_exclusive must be after start_local",
            )

        zone = ZoneInfo(current_user.timezone)
        start_dt_local = datetime.combine(start_d, time.min).replace(tzinfo=zone)
        end_dt_local = datetime.combine(end_d, time.min).replace(tzinfo=zone)
        start_utc = start_dt_local.astimezone(UTC)
        end_utc = end_dt_local.astimezone(UTC)

        stmt = (
            stmt.where(ClockEvent.ts_utc >= start_utc)
            .where(ClockEvent.ts_utc < end_utc)
            .order_by(ClockEvent.ts_utc.asc())
        )
    else:
        limit = max(1, min(limit, 200))
        stmt = stmt.order_by(desc(ClockEvent.ts_utc)).limit(limit)

    events = list(db.scalars(stmt).all())

    out: list[ClockEventResponse] = []
    for e in events:
        geo_out = None
        if e.geo_lat is not None and e.geo_lng is not None:
            geo_out = Geo(lat=e.geo_lat, lng=e.geo_lng, accuracy_m=e.geo_accuracy_m)

        out.append(
            ClockEventResponse(
                id=e.id,
                ts_utc=_as_utc(e.ts_utc).isoformat(),
                type=e.type,
                location=e.location,
                geo=geo_out,
                client_event_id=e.client_event_id,
            )
        )
    return out


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = db.get(ClockEvent, event_id)
    if event is None or event.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    events = _load_user_events(db, current_user.id)
    new_events = [e for e in events if e.id != event_id]
    new_events.sort(key=lambda e: _as_utc(e.ts_utc))
    validate_sequence(new_events)

    db.delete(event)
    db.commit()


@router.put("/events/{event_id}", response_model=ClockEventResponse)
def update_event(
    event_id: int,
    payload: UpdateClockEventRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = db.get(ClockEvent, event_id)
    if event is None or event.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    new_type = payload.type if payload.type is not None else event.type
    if payload.type is not None and payload.type != "COME" and payload.location is None:
        new_location = None
    else:
        new_location = (
            payload.location if payload.location is not None else event.location
        )
    validate_event_fields(event_type=new_type, location=new_location)

    if payload.ts_utc is not None:
        candidate = payload.ts_utc
        candidate = (
            candidate.replace(tzinfo=UTC)
            if candidate.tzinfo is None
            else candidate.astimezone(UTC)
        )

        now = utc_now()
        if candidate > now + timedelta(minutes=5):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="ts_utc cannot be in the future",
            )
        if candidate < now - timedelta(days=365):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="ts_utc too old",
            )
        event.ts_utc = candidate

    if payload.type is not None:
        event.type = new_type
    if payload.location is not None:
        event.location = new_location

    day_local = local_date_from_utc(_as_utc(event.ts_utc), current_user.timezone)
    absence = user_has_absence_on_date(db, user_id=current_user.id, day_local=day_local)
    if absence is not None:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot update clock events on absence days",
        )

    events = _load_user_events(db, current_user.id)
    events.sort(key=lambda e: _as_utc(e.ts_utc))
    try:
        validate_sequence(events)
    except HTTPException:
        db.rollback()
        raise

    db.commit()
    db.refresh(event)

    geo_out = None
    if event.geo_lat is not None and event.geo_lng is not None:
        geo_out = Geo(
            lat=event.geo_lat, lng=event.geo_lng, accuracy_m=event.geo_accuracy_m
        )

    return ClockEventResponse(
        id=event.id,
        ts_utc=_as_utc(event.ts_utc).isoformat(),
        type=event.type,
        location=event.location,
        geo=geo_out,
        client_event_id=event.client_event_id,
    )
