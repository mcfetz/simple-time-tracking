from __future__ import annotations

import time
from datetime import UTC, date, datetime

from sqlalchemy import select

from app.db import SessionLocal
from app.models import PushNotificationLog, PushSubscription, User
from app.push_service import send_web_push
from app.reporting import compute_day_summary
from app.settings import settings


def _format_duration(*, minutes: int, lang: str) -> str:
    if minutes < 60:
        return (
            f"{minutes} minutes" if lang == "en" else f"{minutes} Minuten"
        )

    h = minutes // 60
    m = minutes % 60

    if lang == "en":
        if m == 0:
            return f"{h} hour" if h == 1 else f"{h} hours"
        h_part = f"{h} hour" if h == 1 else f"{h} hours"
        return f"{h_part}, {m} minute" if m == 1 else f"{h_part}, {m} minutes"

    if m == 0:
        return f"{h} Stunde" if h == 1 else f"{h} Stunden"
    h_part = f"{h} Stunde" if h == 1 else f"{h} Stunden"
    return f"{h_part}, {m} Minute" if m == 1 else f"{h_part}, {m} Minuten"


def _thresholds(value: list[int] | None) -> list[int]:
    if not value:
        return []
    out: list[int] = []
    for v in value:
        try:
            n = int(v)
        except Exception:
            continue
        if n <= 0:
            continue
        out.append(n)
    return sorted(set(out))


def _local_day(now_utc: datetime, tz: str) -> date:
    from zoneinfo import ZoneInfo

    return now_utc.astimezone(ZoneInfo(tz)).date()


def _compute_today_minutes(db, *, user: User, now_utc: datetime) -> tuple[date, int, int]:
    tz = user.timezone
    day_local = _local_day(now_utc, tz)

    from app.reporting import day_bounds_utc
    from app.models import ClockEvent

    start_utc, end_utc = day_bounds_utc(day_local, tz)
    stmt = (
        select(ClockEvent.type, ClockEvent.ts_utc, ClockEvent.location)
        .where(ClockEvent.user_id == user.id)
        .where(ClockEvent.ts_utc >= start_utc)
        .where(ClockEvent.ts_utc < end_utc)
        .order_by(ClockEvent.ts_utc.asc())
    )
    rows = list(db.execute(stmt).all())
    events = [(t, ts, loc) for (t, ts, loc) in rows]

    summary = compute_day_summary(day_local=day_local, tz=tz, events=events, now_utc=now_utc)
    return day_local, summary.worked_minutes, summary.break_minutes


def _send_due_for_subscription(
    db,
    *,
    subscription: PushSubscription,
    day_local: date,
    worked_minutes: int,
    break_minutes: int,
) -> None:
    settings_row = subscription.user.settings
    if settings_row is None:
        return

    work_thresholds = _thresholds(settings_row.push_work_minutes)
    break_thresholds = _thresholds(settings_row.push_break_minutes)

    due: list[tuple[str, int, int]] = []
    for m in work_thresholds:
        if worked_minutes >= m:
            due.append(("WORK", m, worked_minutes))
    for m in break_thresholds:
        if break_minutes >= m:
            due.append(("BREAK", m, break_minutes))

    if not due:
        return

    for kind, threshold, total_minutes in due:
        log = PushNotificationLog(
            subscription_id=subscription.id,
            date_local=day_local,
            kind=kind,
            threshold_minutes=threshold,
        )
        db.add(log)
        try:
            db.commit()
        except Exception:
            db.rollback()
            continue

        if kind == "WORK":
            title = "STT"
            amount = _format_duration(minutes=total_minutes, lang=subscription.lang)
            body = (
                f"You have worked {amount} so far."
                if subscription.lang == "en"
                else f"Du hast bis jetzt {amount} gearbeitet."
            )
        else:
            title = "STT"
            amount = _format_duration(minutes=total_minutes, lang=subscription.lang)
            body = (
                f"You have taken {amount} break so far."
                if subscription.lang == "en"
                else f"Du hast bis jetzt {amount} Pause gemacht."
            )

        payload = {
            "title": title,
            "body": body,
            "url": "/",
        }

        try:
            send_web_push(
                endpoint=subscription.endpoint,
                p256dh=subscription.p256dh,
                auth=subscription.auth,
                vapid_public_key=settings.vapid_public_key,
                vapid_private_key=settings.vapid_private_key,
                vapid_subject=settings.vapid_subject,
                payload=payload,
            )
        except Exception as e:
            status = getattr(getattr(e, "response", None), "status_code", None) or getattr(getattr(e, "response", None), "status", None)
            if status in (404, 410):
                sub = db.get(PushSubscription, subscription.id)
                if sub is not None:
                    db.delete(sub)
                    db.commit()


def tick_once() -> None:
    now_utc = datetime.now(UTC)
    with SessionLocal() as db:
        users = list(db.scalars(select(User)).all())
        for user in users:
            if user.settings is None:
                continue
            if not (user.settings.push_work_minutes or user.settings.push_break_minutes):
                continue

            subs = list(
                db.scalars(
                    select(PushSubscription).where(PushSubscription.user_id == user.id)
                ).all()
            )
            if not subs:
                continue

            day_local, worked_minutes, break_minutes = _compute_today_minutes(
                db, user=user, now_utc=now_utc
            )
            for sub in subs:
                _send_due_for_subscription(
                    db,
                    subscription=sub,
                    day_local=day_local,
                    worked_minutes=worked_minutes,
                    break_minutes=break_minutes,
                )


def main() -> None:
    while True:
        start = time.time()
        tick_once()
        elapsed = time.time() - start
        sleep_s = max(1.0, 60.0 - elapsed)
        time.sleep(sleep_s)


if __name__ == "__main__":
    main()
