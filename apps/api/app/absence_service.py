from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.models import Absence, AbsenceReason, User


def user_has_absence_on_date(
    db: Session, *, user_id: int, day_local: date
) -> Absence | None:
    stmt = (
        select(Absence)
        .where(Absence.user_id == user_id)
        .where(and_(Absence.start_date <= day_local, Absence.end_date >= day_local))
        .limit(1)
    )
    return db.scalar(stmt)


def local_date_from_utc(ts_utc: datetime, tz: str) -> date:
    from zoneinfo import ZoneInfo

    zone = ZoneInfo(tz)
    if ts_utc.tzinfo is None:
        ts_utc = ts_utc.replace(tzinfo=timezone.utc)
    else:
        ts_utc = ts_utc.astimezone(timezone.utc)
    return ts_utc.astimezone(zone).date()


def absence_with_reason(
    db: Session, *, absence: Absence
) -> tuple[Absence, AbsenceReason | None]:
    reason = db.get(AbsenceReason, absence.reason_id)
    return absence, reason
