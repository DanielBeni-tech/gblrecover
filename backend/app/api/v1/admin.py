"""Routes d'administration et qualité des données — section 3.11 de la spec.

Les endpoints `qualite-*`, `completude-contacts`, `doublons-potentiels`,
`comptes-orphelins`, `incoherences-facturation`, `ebill-adoption` projettent
des vues SQL définies dans database/views.sql.

L'endpoint `/admin/audit` lit la table `audit_events`.
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1 import crud, schemas
from app.api.v1.auth import get_current_user
from app.db.session import get_db

router = APIRouter()


@router.get("/admin/qualite-identification", response_model=List[schemas.ReportRow])
async def admin_qualite_identification(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await crud.admin_qualite_identification(db)


@router.get("/admin/completude-contacts", response_model=List[schemas.ReportRow])
async def admin_completude_contacts(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await crud.admin_completude_contacts(db)


@router.get("/admin/doublons-potentiels", response_model=List[schemas.ReportRow])
async def admin_doublons_potentiels(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await crud.admin_doublons_potentiels(db)


@router.get("/admin/comptes-orphelins", response_model=List[schemas.ReportRow])
async def admin_comptes_orphelins(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await crud.admin_comptes_orphelins(db)


@router.get("/admin/incoherences-facturation", response_model=List[schemas.ReportRow])
async def admin_incoherences_facturation(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await crud.admin_incoherences_facturation(db)


@router.get("/admin/ebill-adoption", response_model=List[schemas.ReportRow])
async def admin_ebill_adoption(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await crud.admin_ebill_adoption(db)


@router.get("/admin/audit", response_model=List[schemas.AuditEventRead])
async def admin_audit(
    user_id: Optional[UUID] = Query(None),
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    created_at__gte: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await crud.admin_audit_list(
        db,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        created_at_gte=created_at__gte,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/admin/data-cleanup",
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
)
async def admin_data_cleanup(
    payload: schemas.DataCleanupRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await crud.admin_data_cleanup(db, target=payload.target, dry_run=payload.dry_run)