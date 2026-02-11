from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ClockEvent, User
from app.reporting import compute_day_summary, day_bounds_utc, iter_local_days
from app.schemas import MonthReportResponse, ReportDay, WeekReportResponse
from app.security import get_current_user


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


router = APIRouter(prefix="/reports", tags=["reports"])


def _week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


@router.get("/week", response_model=WeekReportResponse)
def week_report(
    start: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tz = current_user.timezone
    zone = ZoneInfo(tz)
    today_local = datetime.now(timezone.utc).astimezone(zone).date()
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

    now_utc = datetime.now(timezone.utc)
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
def month_report(
    month: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tz = current_user.timezone
    zone = ZoneInfo(tz)

    today_local = datetime.now(timezone.utc).astimezone(zone).date()
    if month is None:
        year = today_local.year
        mon = today_local.month
    else:
        parts = month.split("-")
        if len(parts) != 2:
            raise HTTPException(status_code=422, detail="Invalid month")
        year = int(parts[0])
        mon = int(parts[1])
        if mon < 1 or mon > 12:
            raise HTTPException(status_code=422, detail="Invalid month")

    month_start = date(year, mon, 1)
    if mon == 12:
        month_end = date(year + 1, 1, 1)
    else:
        month_end = date(year, mon + 1, 1)

    start_utc, _ = day_bounds_utc(month_start, tz)
    end_utc, _ = day_bounds_utc(month_end, tz)

    stmt = (
        select(ClockEvent)
        .where(ClockEvent.user_id == current_user.id)
        .where(and_(ClockEvent.ts_utc >= start_utc, ClockEvent.ts_utc < end_utc))
        .order_by(ClockEvent.ts_utc.asc())
    )
    events = list(db.scalars(stmt).all())

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

    now_utc = datetime.now(timezone.utc)
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
