from __future__ import annotations

from fastapi import HTTPException, status
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

