from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ClockEvent, User
from app.schemas import DailyStatusResponse
from app.security import get_current_user
from app.time_calc import (
    as_utc,
    close_open_interval,
    gaps_between_sessions,
    max_continuous_break_minutes,
    minutes,
    required_break_continuous_minutes,
    required_break_total_minutes,
    seconds_between,
)


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _day_bounds_utc(now_utc: datetime, tz: str) -> tuple[datetime, datetime, str]:
    from zoneinfo import ZoneInfo

    zone = ZoneInfo(tz)
    now_local = now_utc.astimezone(zone)
    day_start_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    next_day_local = day_start_local + timedelta(days=1)

    start_utc = day_start_local.astimezone(timezone.utc)
    end_utc = next_day_local.astimezone(timezone.utc)
    return start_utc, end_utc, day_start_local.date().isoformat()


@router.get("/today", response_model=DailyStatusResponse)
def today(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    now_utc = datetime.now(timezone.utc)
    tz = current_user.timezone
    start_utc, end_utc, date_local = _day_bounds_utc(now_utc, tz)

    stmt = (
        select(ClockEvent)
        .where(ClockEvent.user_id == current_user.id)
        .where(ClockEvent.ts_utc >= start_utc)
        .where(ClockEvent.ts_utc < end_utc)
        .order_by(ClockEvent.ts_utc.asc())
    )
    events = list(db.scalars(stmt).all())

    worked_seconds = 0
    break_seconds = 0
    open_kind: str | None = None
    open_start: datetime | None = None

    last_type: str | None = None
    last_ts: datetime | None = None
    first_come_ts: datetime | None = None

    break_intervals: list[tuple[datetime, datetime]] = []

    for e in events:
        ts = as_utc(e.ts_utc)
        last_type = e.type
        last_ts = ts

        if e.type == "COME":
            if first_come_ts is None:
                first_come_ts = ts
            open_kind = "WORK"
            open_start = ts
            continue

        if e.type == "BREAK_START":
            if open_kind == "WORK" and open_start is not None:
                worked_seconds += seconds_between(open_start, ts)
            open_kind = "BREAK"
            open_start = ts
            continue

        if e.type == "BREAK_END":
            if open_kind == "BREAK" and open_start is not None:
                break_seconds += seconds_between(open_start, ts)
                break_intervals.append((open_start, ts))
            open_kind = "WORK"
            open_start = ts
            continue

        if e.type == "GO":
            if open_kind == "WORK" and open_start is not None:
                worked_seconds += seconds_between(open_start, ts)
            elif open_kind == "BREAK" and open_start is not None:
                break_seconds += seconds_between(open_start, ts)
                break_intervals.append((open_start, ts))
            open_kind = None
            open_start = None
            continue

    if open_kind == "WORK" and open_start is not None:
        s, e = close_open_interval(open_start, now_utc=now_utc, end_utc=end_utc)
        worked_seconds += seconds_between(s, e)
    elif open_kind == "BREAK" and open_start is not None:
        s, e = close_open_interval(open_start, now_utc=now_utc, end_utc=end_utc)
        break_seconds += seconds_between(s, e)
        if e > s:
            break_intervals.append((s, e))

    event_tuples = [(ev.type, as_utc(ev.ts_utc)) for ev in events]
    gaps = gaps_between_sessions(event_tuples, start_utc=start_utc, end_utc=end_utc)
    for s, e in gaps:
        break_seconds += seconds_between(s, e)
        break_intervals.append((s, e))

    worked_minutes = minutes(worked_seconds)
    break_minutes = minutes(break_seconds)

    target_minutes = (
        current_user.settings.daily_target_minutes if current_user.settings else 468
    )
    remaining_work = max(0, target_minutes - worked_minutes)

    required_break = required_break_total_minutes(worked_minutes)
    remaining_break = max(0, required_break - break_minutes)

    required_cont = required_break_continuous_minutes(worked_minutes)
    max_cont = max_continuous_break_minutes(break_intervals)
    remaining_cont = max(0, required_cont - max_cont)

    state = "OFF"
    if open_kind == "WORK":
        state = "WORKING"
    elif open_kind == "BREAK":
        state = "BREAK"

    max_daily_work_exceeded = worked_minutes > 10 * 60

    rest_period_minutes: int | None = None
    rest_period_violation = False
    if first_come_ts is not None:
        last_go_stmt = (
            select(ClockEvent)
            .where(ClockEvent.user_id == current_user.id)
            .where(ClockEvent.type == "GO")
            .where(ClockEvent.ts_utc < first_come_ts)
            .order_by(desc(ClockEvent.ts_utc))
            .limit(1)
        )
        last_go = db.scalar(last_go_stmt)
        if last_go is not None:
            rest_seconds = seconds_between(as_utc(last_go.ts_utc), first_come_ts)
            rest_period_minutes = minutes(rest_seconds)
            rest_period_violation = rest_period_minutes < 11 * 60

    return DailyStatusResponse(
        date_local=date_local,
        timezone=tz,
        state=state,
        worked_minutes=worked_minutes,
        target_minutes=target_minutes,
        remaining_work_minutes=remaining_work,
        break_minutes=break_minutes,
        required_break_minutes=required_break,
        remaining_break_minutes=remaining_break,
        required_continuous_break_minutes=required_cont,
        max_continuous_break_minutes=max_cont,
        remaining_continuous_break_minutes=remaining_cont,
        last_event_type=last_type,
        last_event_ts_utc=last_ts.isoformat() if last_ts else None,
        max_daily_work_exceeded=max_daily_work_exceeded,
        rest_period_minutes=rest_period_minutes,
        rest_period_violation=rest_period_violation,
    )
