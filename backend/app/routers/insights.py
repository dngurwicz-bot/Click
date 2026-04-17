from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_permission
from app.schemas.insights import (
    InsightsCatalogResponse,
    InsightsReportExportRequest,
    InsightsReportExportResponse,
    InsightsReportRequest,
    InsightsReportResponse,
)
from app.services.insights_reports import build_catalog, export_report, generate_report

router = APIRouter(prefix="/api/insights/reports", tags=["insights"])


@router.get("/catalog", response_model=InsightsCatalogResponse)
async def get_report_catalog(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("modules", "view")),
):
    return await build_catalog(db, current_user)


@router.post("/generate", response_model=InsightsReportResponse)
async def generate_insights_report(
    body: InsightsReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("modules", "view")),
):
    try:
        return await generate_report(db, body, current_user)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail={"error": str(exc), "code": "FORBIDDEN"}) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail={"error": str(exc), "code": "INVALID_REQUEST"}) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail={"error": str(exc), "code": "UNAVAILABLE"}) from exc


@router.post("/export", response_model=InsightsReportExportResponse)
async def export_insights_report(
    body: InsightsReportExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("modules", "view")),
):
    try:
        return await export_report(db, body, current_user)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail={"error": str(exc), "code": "FORBIDDEN"}) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail={"error": str(exc), "code": "INVALID_REQUEST"}) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail={"error": str(exc), "code": "UNAVAILABLE"}) from exc
