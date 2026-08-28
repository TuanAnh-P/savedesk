"""Settings, from environment variables with defaults that run out of the box."""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# config.py -> app/ -> backend/ -> savedesk/
REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="SAVEDESK_", env_file=".env", extra="ignore"
    )

    csv_path: Path = REPO_ROOT / "data" / "WA_Fn-UseC_-Telco-Customer-Churn.csv"

    default_page_size: int = 25
    # Without a cap, a client can request the whole dataset in one response.
    max_page_size: int = 100

    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    log_level: str = "INFO"
    json_logs: bool = True


settings = Settings()
