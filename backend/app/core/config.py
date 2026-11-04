"""環境設定的唯一讀取點；.env.example 列出全部變數。"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AwareDatetime, Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]
MIN_JWT_SECRET_BYTES = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=REPO_ROOT / ".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        extra="ignore",
        hide_input_in_errors=True,
    )

    app_env: Literal["development", "test", "production"] = "development"
    app_fixed_now: AwareDatetime | None = None

    database_url: str
    test_database_url: str | None = None

    jwt_secret: SecretStr = Field(default=SecretStr(""), validate_default=True)
    jwt_expire_hours: int = Field(default=12, gt=0)
    auth_cookie_name: str = "foodflow_session"
    auth_cookie_secure: bool = False

    @field_validator("jwt_secret")
    @classmethod
    def _require_strong_jwt_secret(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value().encode()) < MIN_JWT_SECRET_BYTES:
            raise ValueError(
                f"JWT_SECRET 未設定或短於 {MIN_JWT_SECRET_BYTES} bytes，後端拒絕啟動；"
                "請依 .env.example 的說明產生"
            )
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
