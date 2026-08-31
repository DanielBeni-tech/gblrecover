"""Routes de reporting et dashboards — section 3.10 de la spec.

Tous les endpoints projettent des vues SQL définies dans database/views.sql.
Le mapping est générique (ReportRow) — chaque colonne de la vue devient une
propriété du JSON de réponse.
"""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1 import crud, schemas
from app.api.v1.auth import get_current_user
from app.db.session import get_db

router = APIRouter()


@router.get("/dashboards/summary", response_model=List[schemas.ReportRow])
async def dashboard_summary(
    centres: str | None = Query(None, description="Comma-separated centre names"),
    agences: str | None = Query(None, description="Comma-separated agency IDs"),
    mois: str | None = Query(None, description="Month date YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    c = [x.strip() for x in centres.split(",")] if centres else None
    a = [x.strip() for x in agences.split(",")] if agences else None
    return await crud.dashboard_summary(db, centres=c, agences=a, mois=mois)


@router.get("/dashboards/aging", response_model=List[schemas.ReportRow])
async def dashboard_aging(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await crud.dashboard_aging(db)


@router.get("/dashboards/trend", response_model=List[schemas.ReportRow])
async def dashboard_trend(
    centres: str | None = Query(None, description="Comma-separated centre names"),
    agences: str | None = Query(None, description="Comma-separated agency IDs"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    c = [x.strip() for x in centres.split(",")] if centres else None
    a = [x.strip() for x in agences.split(",")] if agences else None
    return await crud.dashboard_trend(db, centres=c, agences=a)


@router.get("/dashboards/activity", response_model=List[schemas.ReportRow])
async def dashboard_activity(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await crud.dashboard_activity(db)


@router.get("/reports/centres-agences", response_model=List[schemas.ReportRow])
async def reports_centres_agences(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await crud.reports_centres_agences(db)


@router.get("/reports/gestionnaires", response_model=List[schemas.ReportRow])
async def reports_gestionnaires(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await crud.reports_gestionnaires(db)


@router.get("/reports/gestionnaires/{manager_id}", response_model=List[schemas.ReportRow])
async def reports_gestionnaire(
    manager_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await crud.reports_gestionnaire(db, manager_id)


@router.get("/reports/marches", response_model=List[schemas.ReportRow])
async def reports_marches(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await crud.reports_marches(db)


@router.get("/reports/evolution-mensuelle", response_model=List[schemas.ReportRow])
async def reports_evolution_mensuelle(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await crud.reports_evolution_mensuelle(db)


@router.get("/reports/top-dette", response_model=List[schemas.ReportRow])
async def reports_top_dette(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await crud.reports_top_dette(db)


@router.get("/reports/fragilite", response_model=List[schemas.ReportRow])
async def reports_fragilite(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await crud.reports_fragilite(db)


@router.get("/reports/spirale-negative", response_model=List[schemas.ReportRow])
async def reports_spirale_negative(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await crud.reports_spirale_negative(db)


@router.get("/reports/zombies", response_model=List[schemas.ReportRow])
async def reports_zombies(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await crud.reports_zombies(db)


@router.get(
    "/reports/export/csv",
)
async def export_report_csv(
    report: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Exporte un rapport en CSV. Squelette — implémentation en attente."""
    raise NotImplementedError("TODO: implement CSV export — see §3.10")


# ============================================================
# Analyse de la dette — aging analytics
# ============================================================

@router.get("/dashboards/aging-by-centre", response_model=List[schemas.ReportRow])
async def aging_by_centre(
    centre: str | None = Query(None),
    agence: str | None = Query(None),
    marche: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await crud.debt_aging_by_centre(db, centre=centre, agence=agence, marche=marche)


@router.get("/dashboards/aging-by-agence", response_model=List[schemas.ReportRow])
async def aging_by_agence(
    centre: str | None = Query(None),
    marche: str | None = Query(None),
    limit: int = Query(10),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await crud.debt_aging_by_agence(db, centre=centre, marche=marche, limit=limit)


@router.get("/dashboards/aging-trend", response_model=List[schemas.ReportRow])
async def aging_trend(
    centre: str | None = Query(None),
    agence: str | None = Query(None),
    marche: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await crud.debt_aging_trend(db, centre=centre, agence=agence, marche=marche)


# ============================================================
# Analytics décisionnels
# ============================================================

@router.get("/dashboards/top-indebted", response_model=List[schemas.ReportRow])
async def dashboard_top_indebted(
    centres: str | None = Query(None, description="Comma-separated centre names"),
    agences: str | None = Query(None, description="Comma-separated agency IDs"),
    mois: str | None = Query(None, description="Month date YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    c = [x.strip() for x in centres.split(",")] if centres else None
    a = [x.strip() for x in agences.split(",")] if agences else None
    return await crud.top_indebted_clients(db, centres=c, agences=a, mois=mois, limit=20)


@router.get("/dashboards/camtel-debts", response_model=List[schemas.ReportRow])
async def dashboard_camtel_debts(
    centres: str | None = Query(None, description="Comma-separated centre names"),
    agences: str | None = Query(None, description="Comma-separated agency IDs"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    c = [x.strip() for x in centres.split(",")] if centres else None
    a = [x.strip() for x in agences.split(",")] if agences else None
    return await crud.top_camtel_debts(db, centres=c, agences=a, limit=20)


@router.get("/dashboards/available-months", response_model=List[schemas.ReportRow])
async def dashboard_available_months(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Retourne la liste des mois disponibles dans les factures."""
    return await crud.get_available_months(db)
