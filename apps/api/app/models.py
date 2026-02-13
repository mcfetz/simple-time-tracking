from __future__ import annotations

from datetime import date, datetime, UTC

from sqlalchemy import Date, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


def utc_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    timezone: Mapped[str] = mapped_column(String(64), default="Europe/Berlin")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )

    settings: Mapped[UserSettings] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    sessions: Mapped[list[AuthSession]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    daily_target_minutes: Mapped[int] = mapped_column(Integer, default=468)
    home_office_target_ratio: Mapped[float] = mapped_column(Float, default=0.4)

    overtime_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    user: Mapped[User] = relationship(back_populates="settings")


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    refresh_token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped[User] = relationship(back_populates="sessions")


class ClockEventType(str):
    COME = "COME"
    GO = "GO"
    BREAK_START = "BREAK_START"
    BREAK_END = "BREAK_END"


class WorkLocation(str):
    HOME = "HOME"
    OFFICE = "OFFICE"


class ClockEvent(Base):
    __tablename__ = "clock_events"

    __table_args__ = (
        Index(
            "uq_clock_events_user_client_event_id",
            "user_id",
            "client_event_id",
            unique=True,
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    ts_utc: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    type: Mapped[str] = mapped_column(
        SAEnum(
            "COME",
            "GO",
            "BREAK_START",
            "BREAK_END",
            name="clock_event_type",
        )
    )
    location: Mapped[str | None] = mapped_column(
        SAEnum("HOME", "OFFICE", name="work_location"), nullable=True
    )

    geo_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    geo_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    geo_accuracy_m: Mapped[float | None] = mapped_column(Float, nullable=True)

    client_event_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    user: Mapped[User] = relationship()


class AbsenceReason(Base):
    __tablename__ = "absence_reasons"

    __table_args__ = (
        Index(
            "uq_absence_reasons_user_name",
            "user_id",
            "name",
            unique=True,
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )

    user: Mapped[User] = relationship()


class Absence(Base):
    __tablename__ = "absences"

    __table_args__ = (
        Index(
            "ix_absences_user_start_end",
            "user_id",
            "start_date",
            "end_date",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    reason_id: Mapped[int] = mapped_column(
        ForeignKey("absence_reasons.id", ondelete="RESTRICT"), index=True
    )

    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )

    user: Mapped[User] = relationship()


class DayNote(Base):
    __tablename__ = "day_notes"

    __table_args__ = (
        Index("uq_day_notes_user_date", "user_id", "date_local", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    date_local: Mapped[date] = mapped_column(Date, index=True)
    content: Mapped[str] = mapped_column(String(4000), default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )

    user: Mapped[User] = relationship()
