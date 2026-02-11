from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status

from app.models import ClockEvent


def as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def validate_event_fields(*, event_type: str, location: str | None) -> None:
    if event_type not in ("COME", "GO", "BREAK_START", "BREAK_END"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid event type",
        )

    if location is not None and location not in ("HOME", "OFFICE"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid location"
        )

    if event_type == "COME" and location is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Location required for COME",
        )

    if event_type != "COME" and location is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Location only allowed for COME",
        )


def validate_sequence(events: list[ClockEvent]) -> None:
    if not events:
        return

    for i, e in enumerate(events):
        validate_event_fields(event_type=e.type, location=e.location)

        if i == 0:
            if e.type != "COME":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="First event must be COME",
                )
            continue

        prev = events[i - 1]
        if as_utc(e.ts_utc) <= as_utc(prev.ts_utc):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Event timestamps must be strictly increasing",
            )

        if prev.type == "COME":
            if e.type in ("COME", "BREAK_END"):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT, detail="Invalid transition"
                )
        elif prev.type == "BREAK_START":
            if e.type not in ("BREAK_END", "GO"):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT, detail="Invalid transition"
                )
        elif prev.type == "BREAK_END":
            if e.type == "BREAK_END":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT, detail="Invalid transition"
                )
            if e.type == "COME":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT, detail="Already working"
                )
        elif prev.type == "GO":
            if e.type != "COME":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT, detail="Invalid transition"
                )
