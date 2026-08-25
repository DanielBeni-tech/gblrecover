"""Routes pour les services — section 3.12 de la spec."""
from typing import List

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1 import crud, schemas
from app.db.session import get_db

router = APIRouter()


@router.get("/services", response_model=List[schemas.ServiceRead])
async def list_services(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    return await crud.list_services(db, page=page, page_size=page_size)


@router.get(
    "/services/{type_service}",
    response_model=schemas.ServiceRead,
)
async def read_service(type_service: str, db: AsyncSession = Depends(get_db)):
    return await crud.get_service(db, type_service)