import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(env_path)


database_url = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5433/gblrecover",
)


class Settings:
    database_url: str = database_url


settings = Settings()
