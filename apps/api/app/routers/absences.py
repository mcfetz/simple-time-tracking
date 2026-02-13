# ruff: noqa: B008

from __future__ import annotations

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, desc, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Absence, AbsenceReason, ClockEvent, User
from app.schemas import (
    AbsenceReasonResponse,
    AbsenceResponse,
    CreateAbsenceReasonRequest,
    CreateAbsenceRequest,
    UpdateAbsenceReasonRequest,
    UpdateAbsenceRequest,
)
from app.security import get_current_user

router = APIRouter(prefix="/absences", tags=["absences"])


def _date_range_overlap(a_start: date, a_end: date, b_start: date, b_end: date) -> bool:
    return a_start <= b_end and b_start <= a_end


def _assert_valid_range(start_date: date, end_date: date) -> None:
    if end_date < start_date:
        raise HTTPException(status_code=422, detail="end_date must be >= start_date")


def _user_has_clock_events_in_range(
    db: Session, user_id: int, tz: str, start_date: date, end_date: date
) -> bool:

    zone = ZoneInfo(tz)
    start_dt_local = datetime(
        start_date.year, start_date.month, start_date.day, tzinfo=zone
    )
    end_dt_local = datetime(end_date.year, end_date.month, end_date.day, tzinfo=zone)
    end_dt_local = end_dt_local.replace(
        hour=23, minute=59, second=59, microsecond=999999
    )
    start_utc = start_dt_local.astimezone(UTC)
    end_utc = end_dt_local.astimezone(UTC)

    stmt = (
        select(ClockEvent.id)
        .where(ClockEvent.user_id == user_id)
        .where(and_(ClockEvent.ts_utc >= start_utc, ClockEvent.ts_utc <= end_utc))
        .limit(1)
    )
    return db.scalar(stmt) is not None


@router.get("/reasons", response_model=list[AbsenceReasonResponse])
def list_reasons(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(AbsenceReason)
        .where(AbsenceReason.user_id == current_user.id)
        .order_by(AbsenceReason.name.asc())
    )
    reasons = list(db.scalars(stmt).all())
    return [AbsenceReasonResponse(id=r.id, name=r.name) for r in reasons]


@router.post("/reasons", response_model=AbsenceReasonResponse)
def create_reason(
    payload: CreateAbsenceReasonRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="name required")

    existing = db.scalar(
        select(AbsenceReason).where(
            and_(AbsenceReason.user_id == current_user.id, AbsenceReason.name == name)
        )
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="reason already exists")

    reason = AbsenceReason(user_id=current_user.id, name=name)
    db.add(reason)
    db.commit()
    db.refresh(reason)
    return AbsenceReasonResponse(id=reason.id, name=reason.name)


@router.put("/reasons/{reason_id}", response_model=AbsenceReasonResponse)
def update_reason(
    reason_id: int,
    payload: UpdateAbsenceReasonRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reason = db.get(AbsenceReason, reason_id)
    if reason is None or reason.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")

    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="name required")

    conflict = db.scalar(
        select(AbsenceReason).where(
            and_(AbsenceReason.user_id == current_user.id, AbsenceReason.name == name)
        )
    )
    if conflict is not None and conflict.id != reason_id:
        raise HTTPException(status_code=409, detail="reason already exists")

    reason.name = name
    db.commit()
    db.refresh(reason)
    return AbsenceReasonResponse(id=reason.id, name=reason.name)


@router.delete("/reasons/{reason_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reason(
    reason_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reason = db.get(AbsenceReason, reason_id)
    if reason is None or reason.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")

    in_use = db.scalar(
        select(Absence.id).where(Absence.reason_id == reason_id).limit(1)
    )
    if in_use is not None:
        raise HTTPException(status_code=409, detail="reason in use")

    db.delete(reason)
    db.commit()


@router.get("", response_model=list[AbsenceResponse])
def list_absences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 200,
):
    limit = max(1, min(limit, 500))
    stmt = (
        select(Absence)
        .where(Absence.user_id == current_user.id)
        .order_by(desc(Absence.start_date), desc(Absence.end_date))
        .limit(limit)
    )
    absences = list(db.scalars(stmt).all())
    reason_ids = {a.reason_id for a in absences}
    reasons = {}
    if reason_ids:
        r_stmt = select(AbsenceReason).where(AbsenceReason.id.in_(reason_ids))
        for r in db.scalars(r_stmt).all():
            reasons[r.id] = r

    out: list[AbsenceResponse] = []
    for a in absences:
        r = reasons.get(a.reason_id)
        if r is None:
            continue
        out.append(
            AbsenceResponse(
                id=a.id,
                start_date=a.start_date.isoformat(),
                end_date=a.end_date.isoformat(),
                reason=AbsenceReasonResponse(id=r.id, name=r.name),
            )
        )
    return out


@router.post("", response_model=AbsenceResponse)
def create_absence(
    payload: CreateAbsenceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_valid_range(payload.start_date, payload.end_date)

    reason = db.get(AbsenceReason, payload.reason_id)
    if reason is None or reason.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="reason not found")

    existing = list(
        db.scalars(select(Absence).where(Absence.user_id == current_user.id)).all()
    )
    for a in existing:
        if _date_range_overlap(
            a.start_date, a.end_date, payload.start_date, payload.end_date
        ):
            raise HTTPException(status_code=409, detail="absence overlaps existing")

    if _user_has_clock_events_in_range(
        db,
        current_user.id,
        current_user.timezone,
        payload.start_date,
        payload.end_date,
    ):
        raise HTTPException(status_code=409, detail="clock events exist in range")

    absence = Absence(
        user_id=current_user.id,
        reason_id=payload.reason_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    db.add(absence)
    db.commit()
    db.refresh(absence)

    return AbsenceResponse(
        id=absence.id,
        start_date=absence.start_date.isoformat(),
        end_date=absence.end_date.isoformat(),
        reason=AbsenceReasonResponse(id=reason.id, name=reason.name),
    )


@router.delete("/{absence_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_absence(
    absence_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    absence = db.get(Absence, absence_id)
    if absence is None or absence.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(absence)
    db.commit()


@router.put("/{absence_id}", response_model=AbsenceResponse)
def update_absence(
    absence_id: int,
    payload: UpdateAbsenceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    absence = db.get(Absence, absence_id)
    if absence is None or absence.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")

    start_date = (
        payload.start_date if payload.start_date is not None else absence.start_date
    )
    end_date = payload.end_date if payload.end_date is not None else absence.end_date
    reason_id = (
        payload.reason_id if payload.reason_id is not None else absence.reason_id
    )
    _assert_valid_range(start_date, end_date)

    reason = db.get(AbsenceReason, reason_id)
    if reason is None or reason.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="reason not found")

    existing = list(
        db.scalars(select(Absence).where(Absence.user_id == current_user.id)).all()
    )
    for a in existing:
        if a.id == absence_id:
            continue
        if _date_range_overlap(a.start_date, a.end_date, start_date, end_date):
            raise HTTPException(status_code=409, detail="absence overlaps existing")

    if _user_has_clock_events_in_range(
        db,
        current_user.id,
        current_user.timezone,
        start_date,
        end_date,
    ):
        raise HTTPException(status_code=409, detail="clock events exist in range")

    absence.start_date = start_date
    absence.end_date = end_date
    absence.reason_id = reason_id

    db.commit()
    db.refresh(absence)

    return AbsenceResponse(
        id=absence.id,
        start_date=absence.start_date.isoformat(),
        end_date=absence.end_date.isoformat(),
        reason=AbsenceReasonResponse(id=reason.id, name=reason.name),
    )
