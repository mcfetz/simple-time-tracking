from __future__ import annotations

from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="TT_", extra="ignore")

    env: str = "dev"
    base_url: str = "http://localhost:5173"

    sqlite_path: str = "./data/app.db"

    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60 * 24 * 30
    refresh_token_days: int = 30

    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"

    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:admin@example.com"

    smtp_host: str = ""
    smtp_port: int = 25
    smtp_from: str = ""
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_starttls: bool = False
    smtp_use_tls: bool = False

    public_app_url: str = ""


settings = Settings()
