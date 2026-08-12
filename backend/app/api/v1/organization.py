from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1 import crud, schemas
from app.api.v1.auth import get_current_user
from app.db.session import get_db

router = APIRouter()


@router.get("/centres", response_model=list[schemas.CentreRead])
async def read_centres(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_centres(db, page=page, page_size=page_size)


@router.get("/centres/{centre_id}", response_model=schemas.CentreRead)
async def read_centre(centre_id: str, db: AsyncSession = Depends(get_db)):
    centre = await crud.get_centre(db, centre_id)
    if not centre:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Centre not found")
    return centre


@router.post("/centres", response_model=schemas.CentreRead, status_code=status.HTTP_201_CREATED)
async def create_centre(centre_in: schemas.CentreCreate, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await crud.create_centre(db, centre_in)


@router.patch("/centres/{centre_id}", response_model=schemas.CentreRead)
async def update_centre(centre_id: str, centre_in: schemas.CentreUpdate, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    centre = await crud.update_centre(db, centre_id, centre_in)
    if not centre:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Centre not found")
    return centre


@router.get("/agencies", response_model=list[schemas.AgencyRead])
async def read_agencies(
    centre_id: Optional[str] = Query(None, alias="centre_id"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_agencies(db, centre_id=centre_id, page=page, page_size=page_size)


@router.get("/agencies/{agency_id}", response_model=schemas.AgencyRead)
async def read_agency(agency_id: str, db: AsyncSession = Depends(get_db)):
    agency = await crud.get_agency(db, agency_id)
    if not agency:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agency not found")
    return agency


@router.post("/agencies", response_model=schemas.AgencyRead, status_code=status.HTTP_201_CREATED)
async def create_agency(agency_in: schemas.AgencyCreate, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await crud.create_agency(db, agency_in)


@router.patch("/agencies/{agency_id}", response_model=schemas.AgencyRead)
async def update_agency(agency_id: str, agency_in: schemas.AgencyUpdate, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    agency = await crud.update_agency(db, agency_id, agency_in)
    if not agency:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agency not found")
    return agency


@router.get("/managers", response_model=list[schemas.ManagerRead])
async def read_managers(
    agency_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_managers(db, agency_id=agency_id, status=status, page=page, page_size=page_size)


@router.get("/managers/{manager_id}", response_model=schemas.ManagerRead)
async def read_manager(manager_id: str, db: AsyncSession = Depends(get_db)):
    manager = await crud.get_manager(db, manager_id)
    if not manager:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manager not found")
    return manager


@router.post("/managers", response_model=schemas.ManagerRead, status_code=status.HTTP_201_CREATED)
async def create_manager(manager_in: schemas.ManagerCreate, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await crud.create_manager(db, manager_in)


@router.patch("/managers/{manager_id}", response_model=schemas.ManagerRead)
async def update_manager(manager_id: str, manager_in: schemas.ManagerUpdate, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    manager = await crud.update_manager(db, manager_id, manager_in)
    if not manager:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manager not found")
    return manager


@router.get("/organizations/hierarchy", response_model=schemas.OrganizationHierarchy)
async def read_organization_hierarchy(db: AsyncSession = Depends(get_db)):
    return await crud.get_organization_hierarchy(db)
