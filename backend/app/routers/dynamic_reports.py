import base64
import csv
import io
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import CurrentUser, require_permission
from app.schemas.dynamic_reports import (
    DynamicReportSchemaResponse,
    DynamicReportQuery,
    DynamicReportResult,
)
from app.services.dynamic_reports import get_builder_schema, execute_dynamic_query

router = APIRouter(prefix="/api/insights/builder", tags=["insights", "dynamic_reports"])


@router.get("/schema", response_model=DynamicReportSchemaResponse)
async def get_schema(
    current_user: CurrentUser = Depends(require_permission("modules", "view")),
):
    return get_builder_schema()


@router.post("/execute", response_model=DynamicReportResult)
async def execute_query(
    body: DynamicReportQuery,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("modules", "view")),
):
    try:
        return await execute_dynamic_query(db, body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail={"error": str(exc), "code": "INVALID_REQUEST"}) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"error": str(exc), "code": "INTERNAL_ERROR"}) from exc


@router.post("/export")
async def export_query(
    body: DynamicReportQuery,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("modules", "view")),
):
    try:
        # Increase limit for export
        body.limit = 5000
        result = await execute_dynamic_query(db, body)
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        if result.columns:
            writer.writerow(result.columns)
            
            for row in result.rows:
                writer.writerow([row.get(col, "") for col in result.columns])
        
        raw_csv = output.getvalue()
        safe_name = f"custom_report_{body.entity}.csv"
        
        return {
            "file_name": safe_name,
            "mime_type": "text/csv; charset=utf-8",
            "content_base64": base64.b64encode(raw_csv.encode("utf-8-sig")).decode("ascii")
        }
    except ValueError as exc:
        raise HTTPException(status_code=422, detail={"error": str(exc), "code": "INVALID_REQUEST"}) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"error": str(exc), "code": "INTERNAL_ERROR"}) from exc
