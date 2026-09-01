import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parents[2] / ".env"
# Process env (Docker Compose, systemd, shell) must win over backend/.env,
# which targets localhost for a backend run on the host.
load_dotenv(env_path, override=False)


database_url = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5433/gblrecover",
)


class Settings:
    database_url: str = database_url


settings = Settings()
