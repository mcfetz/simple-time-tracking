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
    access_token_minutes: int = 15
    refresh_token_days: int = 30

    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"


settings = Settings()
