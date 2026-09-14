from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.time_calc import (
    as_utc,
    effective_worked_minutes,
    gaps_between_sessions,
    max_continuous_break_minutes,
    minutes,
    required_break_continuous_minutes,
    required_break_total_minutes,
    seconds_between,
)


@dataclass(frozen=True)
class DaySummary:
    date_local: str
    worked_minutes: int
    break_minutes: int
    required_break_minutes: int
    required_continuous_break_minutes: int
    max_continuous_break_minutes: int
    break_compliant_total: bool
    break_compliant_continuous: bool
    has_open_interval: bool
    home_minutes: int
    office_minutes: int

    max_daily_work_exceeded: bool
    rest_period_minutes: int | None
    rest_period_violation: bool


def iter_local_days(start_local: date, end_local_exclusive: date) -> list[date]:
    out: list[date] = []
    d = start_local
    while d < end_local_exclusive:
        out.append(d)
        d = d + timedelta(days=1)
    return out


def day_bounds_utc(day_local: date, tz: str) -> tuple[datetime, datetime]:

    zone = ZoneInfo(tz)
    start_local = datetime(day_local.year, day_local.month, day_local.day, tzinfo=zone)
    end_local = start_local + timedelta(days=1)
    return start_local.astimezone(UTC), end_local.astimezone(UTC)


def compute_day_summary(  # noqa: PLR0912, PLR0913, PLR0915
    *,
    day_local: date,
    tz: str,
    events: list[tuple[str, datetime, str | None]],
    now_utc: datetime,
    rest_period_minutes: int | None = None,
    rest_period_violation: bool = False,
) -> DaySummary:
    start_utc, end_utc = day_bounds_utc(day_local, tz)

    worked_seconds = 0
    break_seconds = 0
    home_seconds = 0
    office_seconds = 0

    open_kind: str | None = None
    open_start: datetime | None = None
    work_location: str | None = None
    break_intervals: list[tuple[datetime, datetime]] = []

    has_open_interval = False

    for t, ts_raw, location in events:
        ts = as_utc(ts_raw)

        if t == "COME":
            open_kind = "WORK"
            open_start = ts
            work_location = location
            continue

        if t == "BREAK_START":
            if open_kind == "WORK" and open_start is not None:
                seg_seconds = seconds_between(open_start, ts)
                worked_seconds += seg_seconds
                if work_location == "HOME":
                    home_seconds += seg_seconds
                elif work_location == "OFFICE":
                    office_seconds += seg_seconds
            open_kind = "BREAK"
            open_start = ts
            continue

        if t == "BREAK_END":
            if open_kind == "BREAK" and open_start is not None:
                seg_seconds = seconds_between(open_start, ts)
                break_seconds += seg_seconds
                break_intervals.append((open_start, ts))
            open_kind = "WORK"
            open_start = ts
            continue

        if t == "GO":
            if open_kind == "WORK" and open_start is not None:
                seg_seconds = seconds_between(open_start, ts)
                worked_seconds += seg_seconds
                if work_location == "HOME":
                    home_seconds += seg_seconds
                elif work_location == "OFFICE":
                    office_seconds += seg_seconds
            elif open_kind == "BREAK" and open_start is not None:
                seg_seconds = seconds_between(open_start, ts)
                break_seconds += seg_seconds
                break_intervals.append((open_start, ts))
            open_kind = None
            open_start = None
            work_location = None
            continue

    if open_kind == "WORK" and open_start is not None:
        has_open_interval = True
        seg_end = min(now_utc, end_utc)
        seg_seconds = seconds_between(open_start, seg_end)
        worked_seconds += seg_seconds
        if work_location == "HOME":
            home_seconds += seg_seconds
        elif work_location == "OFFICE":
            office_seconds += seg_seconds
    elif open_kind == "BREAK" and open_start is not None:
        has_open_interval = True
        seg_end = min(now_utc, end_utc)
        seg_seconds = seconds_between(open_start, seg_end)
        break_seconds += seg_seconds
        if seg_end > open_start:
            break_intervals.append((open_start, seg_end))

    event_pairs = [(t, as_utc(ts)) for (t, ts, _loc) in events]
    gaps = gaps_between_sessions(event_pairs, start_utc=start_utc, end_utc=end_utc)
    for s, e in gaps:
        seg_seconds = seconds_between(s, e)
        break_seconds += seg_seconds
        break_intervals.append((s, e))

    worked_minutes = minutes(worked_seconds)
    break_minutes = minutes(break_seconds)

    required_break = required_break_total_minutes(worked_minutes)
    required_cont = required_break_continuous_minutes(worked_minutes)
    max_cont = max_continuous_break_minutes(break_intervals)
    effective_worked = effective_worked_minutes(
        worked_minutes=worked_minutes, break_minutes=break_minutes, required_break_minutes=required_break
    )

    max_daily_work_exceeded = effective_worked > 10 * 60

    # distribute statutory deduction proportionally to HOME/OFFICE
    raw_home_m = minutes(home_seconds)
    raw_office_m = minutes(office_seconds)
    if effective_worked == worked_minutes or worked_minutes == 0:
        eff_home_m, eff_office_m = raw_home_m, raw_office_m
    else:
        deficit = worked_minutes - effective_worked
        total_raw_loc = raw_home_m + raw_office_m
        if total_raw_loc == 0:
            eff_home_m, eff_office_m = 0, 0
        else:
            home_deficit = round(deficit * raw_home_m / total_raw_loc)
            # guard rounding
            home_deficit = max(0, min(home_deficit, deficit, raw_home_m))
            office_deficit = deficit - home_deficit
            office_deficit = max(0, min(office_deficit, raw_office_m))
            # adjust if rounding leaves 1 minute off due to caps
            eff_home_m = max(0, raw_home_m - home_deficit)
            eff_office_m = max(0, raw_office_m - office_deficit)
            # if still off by 1 due to rounding, fix
            if eff_home_m + eff_office_m != effective_worked:
                diff = effective_worked - (eff_home_m + eff_office_m)
                if eff_home_m >= eff_office_m:
                    eff_home_m = max(0, eff_home_m + diff)
                else:
                    eff_office_m = max(0, eff_office_m + diff)

    return DaySummary(
        date_local=day_local.isoformat(),
        worked_minutes=effective_worked,
        break_minutes=break_minutes,
        required_break_minutes=required_break,
        required_continuous_break_minutes=required_cont,
        max_continuous_break_minutes=max_cont,
        break_compliant_total=break_minutes >= required_break,
        break_compliant_continuous=max_cont >= required_cont,
        has_open_interval=has_open_interval,
        home_minutes=eff_home_m,
        office_minutes=eff_office_m,
        max_daily_work_exceeded=max_daily_work_exceeded,
        rest_period_minutes=rest_period_minutes,
        rest_period_violation=rest_period_violation,
    )
