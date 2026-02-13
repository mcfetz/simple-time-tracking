from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, UTC


@dataclass(frozen=True)
class Interval:
    start_utc: datetime
    end_utc: datetime
    kind: str


def as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def seconds_between(start_utc: datetime, end_utc: datetime) -> int:
    s = int((end_utc - start_utc).total_seconds())
    return max(0, s)


def minutes(seconds: int) -> int:
    return seconds // 60


def required_break_total_minutes(net_work_minutes: int) -> int:
    if net_work_minutes > 9 * 60:
        return 45
    if net_work_minutes > 6 * 60:
        return 30
    return 0


def required_break_continuous_minutes(net_work_minutes: int) -> int:
    return 30 if required_break_total_minutes(net_work_minutes) > 0 else 0


def max_continuous_break_minutes(
    break_intervals: list[tuple[datetime, datetime]],
) -> int:
    if not break_intervals:
        return 0
    max_s = 0
    for start, end in break_intervals:
        max_s = max(max_s, seconds_between(start, end))
    return minutes(max_s)


def gaps_between_sessions(
    events: list[tuple[str, datetime]],
    *,
    start_utc: datetime,
    end_utc: datetime,
) -> list[tuple[datetime, datetime]]:
    gaps: list[tuple[datetime, datetime]] = []
    for i in range(len(events) - 1):
        t1, ts1 = events[i]
        t2, ts2 = events[i + 1]
        if t1 != "GO" or t2 != "COME":
            continue
        s = max(start_utc, ts1)
        e = min(end_utc, ts2)
        if e > s:
            gaps.append((s, e))
    return gaps


def close_open_interval(
    start_utc: datetime, *, now_utc: datetime, end_utc: datetime
) -> tuple[datetime, datetime]:
    e = min(now_utc, end_utc)
    if e <= start_utc:
        return start_utc, start_utc
    return start_utc, e


def bump_after(last_ts_utc: datetime, now_utc: datetime) -> datetime:
    last_ts_utc = as_utc(last_ts_utc)
    if now_utc > last_ts_utc:
        return now_utc
    return last_ts_utc + timedelta(microseconds=1)
