from urllib.parse import urlparse

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

_LOCAL_DB_HOSTS = {"localhost", "127.0.0.1", "db"}


def _async_database_url(url: str) -> str:
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def _connect_args(url: str) -> dict:
    host = (urlparse(url).hostname or "").lower()
    if host in _LOCAL_DB_HOSTS:
        return {"ssl": False}
    return {}


engine = create_async_engine(
    _async_database_url(settings.database_url),
    echo=False,
    connect_args=_connect_args(settings.database_url),
)
AsyncSessionLocal = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
