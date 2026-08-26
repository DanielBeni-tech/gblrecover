import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(env_path, override=True)


database_url = os.getenv(
    "DATABASE_URL",
    "sqlite+aiosqlite:///./gblrecover.db",
)


class Settings:
    database_url: str = database_url


settings = Settings()
