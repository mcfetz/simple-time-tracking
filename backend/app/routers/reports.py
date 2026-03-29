# ruff: noqa: B008

from __future__ import annotations

from datetime import date, datetime, timedelta, UTC

from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Absence, AbsenceReason, ClockEvent, DayNote, User
from app.reporting import compute_day_summary, day_bounds_utc, iter_local_days
from app.schemas import (
    AbsenceReasonResponse,
    AbsenceResponse,
    MonthReportResponse,
    ReportDay,
    WeekReportResponse,
)
from app.security import get_current_user


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


router = APIRouter(prefix="/reports", tags=["reports"])


def _week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


@router.get("/week", response_model=WeekReportResponse)
def week_report(  # noqa: PLR0915
    start: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tz = current_user.timezone
    zone = ZoneInfo(tz)
    today_local = datetime.now(UTC).astimezone(zone).date()
    week_start = (
        _week_start(today_local) if start is None else date.fromisoformat(start)
    )
    week_start = _week_start(week_start)
    week_end = week_start + timedelta(days=7)

    if week_end < week_start:
        raise HTTPException(status_code=422, detail="Invalid date")

    start_utc, _end_utc_day = day_bounds_utc(week_start, tz)
    end_utc, _end_utc_day2 = day_bounds_utc(week_end, tz)

    stmt = (
        select(ClockEvent)
        .where(ClockEvent.user_id == current_user.id)
        .where(and_(ClockEvent.ts_utc >= start_utc, ClockEvent.ts_utc < end_utc))
        .order_by(ClockEvent.ts_utc.asc())
    )
    events = list(db.scalars(stmt).all())

    abs_stmt = (
        select(Absence)
        .where(Absence.user_id == current_user.id)
        .where(Absence.start_date < week_end)
        .where(Absence.end_date >= week_start)
    )
    absences = list(db.scalars(abs_stmt).all())

    note_stmt = (
        select(DayNote.date_local)
        .where(DayNote.user_id == current_user.id)
        .where(and_(DayNote.date_local >= week_start, DayNote.date_local < week_end))
    )
    note_days = {d.isoformat() for d in db.execute(note_stmt).scalars().all()}
    reason_ids = {a.reason_id for a in absences}
    reasons: dict[int, AbsenceReason] = {}
    if reason_ids:
        for r in db.scalars(
            select(AbsenceReason).where(AbsenceReason.id.in_(reason_ids))
        ).all():
            reasons[r.id] = r

    first_come_ts: dict[str, datetime] = {}
    last_go_ts: dict[str, datetime] = {}
    for e in events:
        ts = _as_utc(e.ts_utc)
        local_key = ts.astimezone(zone).date().isoformat()
        if e.type == "COME":
            existing = first_come_ts.get(local_key)
            first_come_ts[local_key] = ts if existing is None else min(existing, ts)
        elif e.type == "GO":
            existing = last_go_ts.get(local_key)
            last_go_ts[local_key] = ts if existing is None else max(existing, ts)

    by_day: dict[str, list[tuple[str, datetime, str | None]]] = {}
    for e in events:
        local_date = e.ts_utc.astimezone(zone).date()
        key = local_date.isoformat()
        by_day.setdefault(key, []).append((e.type, e.ts_utc, e.location))

    now_utc = datetime.now(UTC)
    days: list[ReportDay] = []
    total_worked = 0
    total_break = 0
    for d in iter_local_days(week_start, week_end):
        prev_day = (d - timedelta(days=1)).isoformat()
        last_go_prev = last_go_ts.get(prev_day)
        first_come_today = first_come_ts.get(d.isoformat())

        rest_minutes: int | None = None
        rest_violation = False
        if last_go_prev is not None and first_come_today is not None:
            rest_seconds = int((first_come_today - last_go_prev).total_seconds())
            rest_minutes = max(0, rest_seconds // 60)
            rest_violation = rest_minutes < 11 * 60

        summary = compute_day_summary(
            day_local=d,
            tz=tz,
            events=by_day.get(d.isoformat(), []),
            now_utc=now_utc,
            rest_period_minutes=rest_minutes,
            rest_period_violation=rest_violation,
        )

        absence_out: AbsenceResponse | None = None
        for a in absences:
            if a.start_date <= d <= a.end_date:
                r = reasons.get(a.reason_id)
                if r is not None:
                    absence_out = AbsenceResponse(
                        id=a.id,
                        start_date=a.start_date.isoformat(),
                        end_date=a.end_date.isoformat(),
                        reason=AbsenceReasonResponse(id=r.id, name=r.name),
                    )
                break
        days.append(
            ReportDay(
                date_local=summary.date_local,
                worked_minutes=summary.worked_minutes,
                break_minutes=summary.break_minutes,
                required_break_minutes=summary.required_break_minutes,
                break_compliant_total=summary.break_compliant_total,
                required_continuous_break_minutes=summary.required_continuous_break_minutes,
                max_continuous_break_minutes=summary.max_continuous_break_minutes,
                break_compliant_continuous=summary.break_compliant_continuous,
                has_open_interval=summary.has_open_interval,
                home_minutes=summary.home_minutes,
                office_minutes=summary.office_minutes,
                max_daily_work_exceeded=summary.max_daily_work_exceeded,
                rest_period_minutes=summary.rest_period_minutes,
                rest_period_violation=summary.rest_period_violation,
                absence=absence_out,
                has_note=summary.date_local in note_days,
            )
        )
        total_worked += summary.worked_minutes
        total_break += summary.break_minutes

    return WeekReportResponse(
        week_start_local=week_start.isoformat(),
        week_end_local_exclusive=week_end.isoformat(),
        timezone=tz,
        total_worked_minutes=total_worked,
        total_break_minutes=total_break,
        days=days,
    )


@router.get("/month", response_model=MonthReportResponse)
def month_report(  # noqa: PLR0912, PLR0915
    month: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tz = current_user.timezone
    zone = ZoneInfo(tz)

    today_local = datetime.now(UTC).astimezone(zone).date()
    if month is None:
        year = today_local.year
        mon = today_local.month
    else:
        parts = month.split("-")
        if len(parts) != 2:  # noqa: PLR2004
            raise HTTPException(status_code=422, detail="Invalid month")
        year = int(parts[0])
        mon = int(parts[1])
        if mon < 1 or mon > 12:  # noqa: PLR2004
            raise HTTPException(status_code=422, detail="Invalid month")

    month_start = date(year, mon, 1)
    month_end = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)  # noqa: PLR2004

    start_utc, _ = day_bounds_utc(month_start, tz)
    end_utc, _ = day_bounds_utc(month_end, tz)

    stmt = (
        select(ClockEvent)
        .where(ClockEvent.user_id == current_user.id)
        .where(and_(ClockEvent.ts_utc >= start_utc, ClockEvent.ts_utc < end_utc))
        .order_by(ClockEvent.ts_utc.asc())
    )
    events = list(db.scalars(stmt).all())

    abs_stmt = (
        select(Absence)
        .where(Absence.user_id == current_user.id)
        .where(Absence.start_date < month_end)
        .where(Absence.end_date >= month_start)
    )
    absences = list(db.scalars(abs_stmt).all())

    note_stmt = (
        select(DayNote.date_local)
        .where(DayNote.user_id == current_user.id)
        .where(and_(DayNote.date_local >= month_start, DayNote.date_local < month_end))
    )
    note_days = {d.isoformat() for d in db.execute(note_stmt).scalars().all()}
    reason_ids = {a.reason_id for a in absences}
    reasons: dict[int, AbsenceReason] = {}
    if reason_ids:
        for r in db.scalars(
            select(AbsenceReason).where(AbsenceReason.id.in_(reason_ids))
        ).all():
            reasons[r.id] = r

    first_come_ts: dict[str, datetime] = {}
    last_go_ts: dict[str, datetime] = {}
    for e in events:
        ts = _as_utc(e.ts_utc)
        local_key = ts.astimezone(zone).date().isoformat()
        if e.type == "COME":
            existing = first_come_ts.get(local_key)
            first_come_ts[local_key] = ts if existing is None else min(existing, ts)
        elif e.type == "GO":
            existing = last_go_ts.get(local_key)
            last_go_ts[local_key] = ts if existing is None else max(existing, ts)

    by_day: dict[str, list[tuple[str, datetime, str | None]]] = {}
    for e in events:
        local_date = e.ts_utc.astimezone(zone).date()
        key = local_date.isoformat()
        by_day.setdefault(key, []).append((e.type, e.ts_utc, e.location))

    now_utc = datetime.now(UTC)
    days: list[ReportDay] = []
    total_worked = 0
    total_break = 0
    worked_days = 0
    home_office_days = 0

    for d in iter_local_days(month_start, month_end):
        prev_day = (d - timedelta(days=1)).isoformat()
        last_go_prev = last_go_ts.get(prev_day)
        first_come_today = first_come_ts.get(d.isoformat())

        rest_minutes: int | None = None
        rest_violation = False
        if last_go_prev is not None and first_come_today is not None:
            rest_seconds = int((first_come_today - last_go_prev).total_seconds())
            rest_minutes = max(0, rest_seconds // 60)
            rest_violation = rest_minutes < 11 * 60

        summary = compute_day_summary(
            day_local=d,
            tz=tz,
            events=by_day.get(d.isoformat(), []),
            now_utc=now_utc,
            rest_period_minutes=rest_minutes,
            rest_period_violation=rest_violation,
        )

        absence_out: AbsenceResponse | None = None
        for a in absences:
            if a.start_date <= d <= a.end_date:
                r = reasons.get(a.reason_id)
                if r is not None:
                    absence_out = AbsenceResponse(
                        id=a.id,
                        start_date=a.start_date.isoformat(),
                        end_date=a.end_date.isoformat(),
                        reason=AbsenceReasonResponse(id=r.id, name=r.name),
                    )
                break
        days.append(
            ReportDay(
                date_local=summary.date_local,
                worked_minutes=summary.worked_minutes,
                break_minutes=summary.break_minutes,
                required_break_minutes=summary.required_break_minutes,
                break_compliant_total=summary.break_compliant_total,
                required_continuous_break_minutes=summary.required_continuous_break_minutes,
                max_continuous_break_minutes=summary.max_continuous_break_minutes,
                break_compliant_continuous=summary.break_compliant_continuous,
                has_open_interval=summary.has_open_interval,
                home_minutes=summary.home_minutes,
                office_minutes=summary.office_minutes,
                max_daily_work_exceeded=summary.max_daily_work_exceeded,
                rest_period_minutes=summary.rest_period_minutes,
                rest_period_violation=summary.rest_period_violation,
                absence=absence_out,
                has_note=summary.date_local in note_days,
            )
        )
        total_worked += summary.worked_minutes
        total_break += summary.break_minutes
        if summary.worked_minutes > 0:
            worked_days += 1
            if summary.home_minutes > summary.office_minutes:
                home_office_days += 1

    ratio = (home_office_days / worked_days) if worked_days > 0 else 0.0
    target_ratio = (
        current_user.settings.home_office_target_ratio if current_user.settings else 0.4
    )

    return MonthReportResponse(
        month_start_local=month_start.isoformat(),
        month_end_local_exclusive=month_end.isoformat(),
        timezone=tz,
        total_worked_minutes=total_worked,
        total_break_minutes=total_break,
        worked_days=worked_days,
        home_office_days=home_office_days,
        home_office_ratio=ratio,
        home_office_target_ratio=target_ratio,
        days=days,
    )
