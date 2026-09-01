"""Routes d'import Excel — section 3.9 de la spec."""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Header, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1 import crud, schemas
from app.api.v1.auth import get_current_user
from app.db.session import get_db

router = APIRouter()


@router.post(
    "/imports",
    response_model=schemas.ImportStartResponse)
async def start_import(
    file: UploadFile = File(...),
    entity_type: str = Form(...),
    x_idempotency_key: Optional[str] = Header(None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Démarre un import. Requiert l'en-tête X-Idempotency-Key."""
    if not x_idempotency_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Header X-Idempotency-Key required",
        )
    return await crud.start_import(
        db,
        filename=file.filename or "",
        file_checksum="",  # TODO: calculer en SHA-256
        entity_type=entity_type,
        created_by=current_user.id,
    )


@router.get("/imports", response_model=List[schemas.ImportBatchRead])
async def list_imports(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    return await crud.list_import_batches(db, page=page, page_size=page_size)


@router.get("/imports/templates")
async def download_template():
    """Télécharge un modèle Excel vide. Squelette : renvoie 501."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="TODO: generate Excel template — see §3.9",
    )


@router.get("/imports/{batch_id}", response_model=schemas.ImportBatchRead)
async def read_import(batch_id: UUID, db: AsyncSession = Depends(get_db)):
    obj = await crud.get_import_batch(db, batch_id)
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import not found")
    return obj


@router.get("/imports/{batch_id}/errors", response_model=List[schemas.ImportErrorRead])
async def list_import_errors(
    batch_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    return await crud.list_import_errors(db, batch_id, page=page, page_size=page_size)


@router.delete(
    "/imports/{batch_id}")
async def cancel_import(
    batch_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ok = await crud.cancel_import_batch(db, batch_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import not found")


@router.get("/imports/count")
async def count_imports(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return {"total": await crud.count_import_batches(db)}
