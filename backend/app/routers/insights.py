import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_permission
from app.schemas.reporting import (
    ReportCatalogResponse,
    ReportDatasetsResponse,
    ReportExportRequest,
    ReportExportResponse,
    ReportQueryRequest,
    ReportResult,
    SavedReportViewCreate,
    SavedReportViewOut,
    SavedReportViewUpdate,
)
from app.services.reporting import (
    create_saved_report,
    execute_report_query,
    export_report,
    get_catalog,
    get_datasets,
    list_saved_reports,
    run_saved_report,
    update_saved_report,
)

router = APIRouter(prefix="/api/insights/reports", tags=["insights"])


@router.get("/catalog", response_model=ReportCatalogResponse)
async def get_report_catalog(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("reports", "view")),
):
    return await get_catalog(db)


@router.get("/datasets", response_model=ReportDatasetsResponse)
async def get_report_datasets(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("reports", "view")),
):
    return await get_datasets(db)


@router.post("/query", response_model=ReportResult)
async def query_report(
    body: ReportQueryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("reports", "view")),
):
    try:
        return await execute_report_query(db, body)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail={"error": str(exc), "code": "FORBIDDEN"}) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail={"error": str(exc), "code": "INVALID_REQUEST"}) from exc


@router.post("/export", response_model=ReportExportResponse)
async def export_query(
    body: ReportExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("reports", "view")),
):
    try:
        return await export_report(db, body)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail={"error": str(exc), "code": "FORBIDDEN"}) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail={"error": str(exc), "code": "INVALID_REQUEST"}) from exc


@router.get("/saved", response_model=list[SavedReportViewOut])
async def get_saved_reports(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("reports", "view")),
):
    return await list_saved_reports(db, current_user)


@router.post("/saved", response_model=SavedReportViewOut)
async def create_report_view(
    body: SavedReportViewCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("reports", "edit")),
):
    try:
        return await create_saved_report(db, body, current_user)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail={"error": str(exc), "code": "INVALID_REQUEST"}) from exc


@router.put("/saved/{report_id}", response_model=SavedReportViewOut)
async def update_report_view(
    report_id: uuid.UUID,
    body: SavedReportViewUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("reports", "edit")),
):
    try:
        return await update_saved_report(db, report_id, body, current_user)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail={"error": str(exc), "code": "FORBIDDEN"}) from exc
    except ValueError as exc:
        status_code = 404 if "not found" in str(exc).lower() else 422
        raise HTTPException(status_code=status_code, detail={"error": str(exc), "code": "INVALID_REQUEST"}) from exc


@router.post("/saved/{report_id}/run", response_model=ReportResult)
async def run_report_view(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("reports", "view")),
):
    try:
        return await run_saved_report(db, report_id, current_user)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail={"error": str(exc), "code": "FORBIDDEN"}) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"error": str(exc), "code": "NOT_FOUND"}) from exc
