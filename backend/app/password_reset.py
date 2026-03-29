from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta


def generate_reset_token() -> str:
    return secrets.token_urlsafe(48)


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def expires_at(minutes: int = 60) -> datetime:
    return datetime.now(UTC) + timedelta(minutes=minutes)
