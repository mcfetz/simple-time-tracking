from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import DayNote, User, utc_now
from app.schemas import DayNoteResponse, UpsertDayNoteRequest
from app.security import get_current_user


router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("/{date_local}", response_model=DayNoteResponse | None)
def get_note(
    date_local: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(DayNote)
        .where(DayNote.user_id == current_user.id)
        .where(DayNote.date_local == date_local)
        .limit(1)
    )
    note = db.scalar(stmt)
    if note is None:
        return None

    return DayNoteResponse(
        id=note.id,
        date_local=note.date_local.isoformat(),
        content=note.content,
        updated_at=note.updated_at.isoformat(),
    )


@router.put("/{date_local}", response_model=DayNoteResponse)
def upsert_note(
    date_local: date,
    payload: UpsertDayNoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.content.strip() == "":
        raise HTTPException(status_code=422, detail="content must not be empty")

    stmt = (
        select(DayNote)
        .where(DayNote.user_id == current_user.id)
        .where(DayNote.date_local == date_local)
        .limit(1)
    )
    note = db.scalar(stmt)
    if note is None:
        note = DayNote(
            user_id=current_user.id,
            date_local=date_local,
            content=payload.content,
            updated_at=utc_now(),
        )
        db.add(note)
    else:
        note.content = payload.content
        note.updated_at = utc_now()

    db.commit()
    db.refresh(note)

    return DayNoteResponse(
        id=note.id,
        date_local=note.date_local.isoformat(),
        content=note.content,
        updated_at=note.updated_at.isoformat(),
    )


@router.delete("/{date_local}", status_code=204)
def delete_note(
    date_local: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(DayNote)
        .where(DayNote.user_id == current_user.id)
        .where(DayNote.date_local == date_local)
        .limit(1)
    )
    note = db.scalar(stmt)
    if note is None:
        return Response(status_code=204)

    db.delete(note)
    db.commit()
    return Response(status_code=204)


@router.get("", response_model=list[str])
def list_note_days(
    start: date,
    end_exclusive: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if end_exclusive <= start:
        raise HTTPException(status_code=422, detail="end_exclusive must be > start")

    stmt = (
        select(DayNote.date_local)
        .where(DayNote.user_id == current_user.id)
        .where(and_(DayNote.date_local >= start, DayNote.date_local < end_exclusive))
        .order_by(DayNote.date_local)
    )
    rows = db.execute(stmt).scalars().all()
    return [d.isoformat() for d in rows]
