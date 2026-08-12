from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.routes import router as api_router
from app.db.session import get_db

app = FastAPI(title="GBLRecover Backend", version="0.2.0")


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