from __future__ import annotations

from datetime import date
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class Geo(BaseModel):
    lat: float
    lng: float
    accuracy_m: float | None = None


class CreateClockEventRequest(BaseModel):
    type: str
    location: str | None = None
    geo: Geo | None = None
    ts_utc: datetime | None = None
    client_event_id: str | None = Field(default=None, max_length=64)


class UpdateClockEventRequest(BaseModel):
    ts_utc: datetime | None = None
    type: str | None = None
    location: str | None = None


class AbsenceReasonResponse(BaseModel):
    id: int
    name: str


class CreateAbsenceReasonRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)


class UpdateAbsenceReasonRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)


class AbsenceResponse(BaseModel):
    id: int
    start_date: str
    end_date: str
    reason: AbsenceReasonResponse


class DayNoteResponse(BaseModel):
    id: int
    date_local: str
    content: str
    updated_at: str


class UpsertDayNoteRequest(BaseModel):
    content: str = Field(max_length=4000)


class CreateAbsenceRequest(BaseModel):
    start_date: date
    end_date: date
    reason_id: int


class UpdateAbsenceRequest(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    reason_id: int | None = None


class ClockEventResponse(BaseModel):
    id: int
    ts_utc: str
    type: str
    location: str | None
    geo: Geo | None
    client_event_id: str | None


class DailyStatusResponse(BaseModel):
    date_local: str
    timezone: str

    state: str
    worked_minutes: int
    target_minutes: int
    remaining_work_minutes: int

    break_minutes: int
    required_break_minutes: int
    remaining_break_minutes: int

    required_continuous_break_minutes: int
    max_continuous_break_minutes: int
    remaining_continuous_break_minutes: int

    last_event_type: str | None
    last_event_ts_utc: str | None

    max_daily_work_exceeded: bool
    rest_period_minutes: int | None
    rest_period_violation: bool

    absence: AbsenceResponse | None = None

    overtime_start_date: str | None = None


class UserSettingsResponse(BaseModel):
    daily_target_minutes: int
    home_office_target_ratio: float
    overtime_start_date: str | None = None

    push_work_minutes: list[int] | None = None
    push_break_minutes: list[int] | None = None


class UpdateUserSettingsRequest(BaseModel):
    daily_target_minutes: int | None = Field(default=None, ge=0, le=24 * 60)
    home_office_target_ratio: float | None = Field(default=None, ge=0.0, le=1.0)
    overtime_start_date: date | None = None

    push_work_minutes: list[int] | None = None
    push_break_minutes: list[int] | None = None


class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionRequest(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys
    lang: str | None = None


class PushUnsubscribeRequest(BaseModel):
    endpoint: str


class PushTestRequest(BaseModel):
    endpoint: str


class VapidPublicKeyResponse(BaseModel):
    public_key: str


class ReportDay(BaseModel):
    date_local: str
    worked_minutes: int
    break_minutes: int
    required_break_minutes: int
    break_compliant_total: bool
    required_continuous_break_minutes: int
    max_continuous_break_minutes: int
    break_compliant_continuous: bool
    has_open_interval: bool
    home_minutes: int
    office_minutes: int

    max_daily_work_exceeded: bool
    rest_period_minutes: int | None
    rest_period_violation: bool

    absence: AbsenceResponse | None = None

    has_note: bool = False


class WeekReportResponse(BaseModel):
    week_start_local: str
    week_end_local_exclusive: str
    timezone: str

    total_worked_minutes: int
    total_break_minutes: int
    days: list[ReportDay]


class MonthReportResponse(BaseModel):
    month_start_local: str
    month_end_local_exclusive: str
    timezone: str

    total_worked_minutes: int
    total_break_minutes: int
    worked_days: int
    home_office_days: int
    home_office_ratio: float
    home_office_target_ratio: float
    days: list[ReportDay]


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=256)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: int
    email: EmailStr
    timezone: str


class TokenResponse(BaseModel):
    access_token: str


class PasswordResetRequest(BaseModel):
    email: str


class PasswordResetConfirmRequest(BaseModel):
    token: str
    new_password: str
    token_type: str = "bearer"


class AuthResponse(BaseModel):
    token: TokenResponse
    user: UserPublic
