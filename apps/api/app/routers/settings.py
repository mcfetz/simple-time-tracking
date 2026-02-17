# ruff: noqa: B008

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User, UserSettings
from app.schemas import UpdateUserSettingsRequest, UserSettingsResponse
from app.security import get_current_user


router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/me", response_model=UserSettingsResponse)
def get_my_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.get(User, current_user.id)
    settings = user.settings if user else None
    if settings is None:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return UserSettingsResponse(
        daily_target_minutes=settings.daily_target_minutes,
        home_office_target_ratio=settings.home_office_target_ratio,
        overtime_start_date=settings.overtime_start_date.isoformat()
        if settings.overtime_start_date
        else None,
        push_work_minutes=settings.push_work_minutes,
        push_break_minutes=settings.push_break_minutes,
    )


@router.put("/me", response_model=UserSettingsResponse)
def update_my_settings(
    payload: UpdateUserSettingsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.get(User, current_user.id)
    settings = user.settings if user else None
    if settings is None:
        settings = UserSettings(user_id=current_user.id)
        db.add(settings)

    if payload.daily_target_minutes is not None:
        settings.daily_target_minutes = payload.daily_target_minutes

    if payload.home_office_target_ratio is not None:
        settings.home_office_target_ratio = payload.home_office_target_ratio

    if payload.overtime_start_date is not None:
        settings.overtime_start_date = payload.overtime_start_date

    if payload.push_work_minutes is not None:
        settings.push_work_minutes = payload.push_work_minutes

    if payload.push_break_minutes is not None:
        settings.push_break_minutes = payload.push_break_minutes

    db.commit()
    db.refresh(settings)

    return UserSettingsResponse(
        daily_target_minutes=settings.daily_target_minutes,
        home_office_target_ratio=settings.home_office_target_ratio,
        overtime_start_date=settings.overtime_start_date.isoformat()
        if settings.overtime_start_date
        else None,
        push_work_minutes=settings.push_work_minutes,
        push_break_minutes=settings.push_break_minutes,
    )
