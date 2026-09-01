from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1 import schemas, crud
from app.api.v1.auth import router as auth_router, get_current_user
from app.api.v1.clients import router as clients_router
from app.api.v1.organization import router as organization_router
from app.api.v1.finance import router as finance_router
from app.api.v1.recouvrement import router as recouvrement_router
from app.api.v1.imports import router as imports_router
from app.api.v1.reports import router as reports_router
from app.api.v1.admin import router as admin_router
from app.api.v1.services import router as services_router
from app.db.session import get_db

router = APIRouter()

# Sous-routers — l'ordre d'inclusion détermine l'ordre d'enregistrement des routes
router.include_router(auth_router, prefix="/auth")
router.include_router(organization_router)
router.include_router(clients_router)
router.include_router(finance_router)
router.include_router(recouvrement_router)
router.include_router(imports_router)
router.include_router(reports_router)
router.include_router(admin_router)
router.include_router(services_router)


# ============================================================
# /users — IMPORTANT : les routes statiques (/me) DOIVENT précéder
# les routes paramétriques ({user_id}) pour éviter le shadowing.
# ============================================================

@router.get("/users/me", response_model=schemas.UserRead)
async def read_current_user(current_user=Depends(get_current_user)):
    return schemas.UserRead.from_orm(current_user)


@router.patch("/users/me", response_model=schemas.UserRead)
async def update_current_user(
    profile: schemas.UserProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    user = await crud.update_user_profile(db, current_user.id, profile)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.get("/users", response_model=List[schemas.UserRead])
async def read_users(
    status: str | None = None,
    role_id: UUID | None = None,
    page: int = 1,
    page_size: int = 25,
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * page_size
    return await crud.get_users(db, limit=page_size, offset=offset, status=status, role_id=role_id)


@router.get("/users/{user_id}", response_model=schemas.UserRead)
async def read_user(user_id: UUID, db: AsyncSession = Depends(get_db)):
    user = await crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.post("/users", response_model=schemas.UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(user_in: schemas.UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await crud.get_user_by_email(db, user_in.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    return await crud.create_user(db, user_in)


@router.patch("/users/{user_id}", response_model=schemas.UserRead)
async def update_user(
    user_id: UUID,
    user_in: schemas.UserUpdate,
    db: AsyncSession = Depends(get_db),
):
    user = await crud.update_user(db, user_id, user_in)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: UUID, db: AsyncSession = Depends(get_db)):
    success = await crud.deactivate_user(db, user_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return


@router.get("/users/{user_id}/permissions", response_model=List[str])
async def user_permissions(user_id: UUID, db: AsyncSession = Depends(get_db)):
    return await crud.get_user_permissions(db, user_id)