import logging
import os

from fastapi import Depends, FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.routes import router as api_router
from app.db.session import get_db

logger = logging.getLogger("gblrecover")

app = FastAPI(title="GBLRecover Backend", version="0.2.0")

# Origines autorisées par défaut (dev local : Vite sur 5173 / 4173).
# En production, surcharger via la variable d'env `CORS_ORIGINS` (CSV) :
#   CORS_ORIGINS="https://app.example.com,https://admin.example.com"
_default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
]
_env_origins = os.getenv("CORS_ORIGINS", "").strip()
_allowed_origins = (
    [o.strip() for o in _env_origins.split(",") if o.strip()]
    if _env_origins
    else _default_origins
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "X-Request-ID",
        "X-Idempotency-Key",
    ],
    expose_headers=["X-Request-ID"],
    max_age=600,
)


# Filet de sécurité global : si une exception non gérée survient dans une route,
# on renvoie une réponse JSON au lieu du « Internal Server Error » brut. Cela
# garantit que la réponse passe par la pile de middlewares (et donc par
# CORSMiddleware) plutôt que d'être interrompue par le serveur ASGI.
@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "Erreur interne du serveur.",
                "request_id": request.headers.get("X-Request-ID"),
            }
        },
    )


@app.get("/status")
async def status():
    return JSONResponse({"status": "ok", "version": "0.2.0"})


@app.get("/health/db")
async def health_db(db: AsyncSession = Depends(get_db)):
    """Vrai check de la base de données : exécute `SELECT 1`."""
    try:
        await db.execute(text("SELECT 1"))
        return JSONResponse({"db": "ok"})
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={"db": "error", "detail": str(exc)},
        )


app.include_router(api_router, prefix="/api/v1")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)