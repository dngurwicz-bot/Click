from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


ReportFormat = Literal["pdf", "csv"]


class InsightsOption(BaseModel):
    value: str
    label: str


class InsightsReportCatalogItem(BaseModel):
    id: str
    title: str
    description: str
    audience: str
    available_formats: list[ReportFormat] = ["pdf", "csv"]
    supports_date_range: bool = False
    supports_status_filter: bool = False
    supports_module_filter: bool = False
    default_row_limit: int = 12
    is_available: bool = True
    availability_note: Optional[str] = None


class InsightsFilterOptions(BaseModel):
    tenant_statuses: list[InsightsOption] = []
    modules: list[InsightsOption] = []


class InsightsCatalogResponse(BaseModel):
    reports: list[InsightsReportCatalogItem]
    filter_options: InsightsFilterOptions


class InsightsReportFilters(BaseModel):
    tenant_statuses: list[str] = Field(default_factory=list)
    module_slugs: list[str] = Field(default_factory=list)
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    row_limit: int = 12
    include_summary: bool = True
    include_details: bool = True


class InsightsReportRequest(BaseModel):
    report_id: str
    title: Optional[str] = None
    filters: InsightsReportFilters = Field(default_factory=InsightsReportFilters)


class InsightsMetric(BaseModel):
    label: str
    value: str
    hint: Optional[str] = None


class InsightsSection(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    columns: list[str] = []
    rows: list[dict[str, str]] = []
    empty_message: Optional[str] = None


class InsightsReportResponse(BaseModel):
    report_id: str
    title: str
    subtitle: str
    generated_at: datetime
    applied_filters: list[InsightsMetric] = []
    summary: list[InsightsMetric] = []
    highlights: list[str] = []
    sections: list[InsightsSection] = []


class InsightsReportExportRequest(InsightsReportRequest):
    format: ReportFormat = "pdf"


class InsightsReportExportResponse(BaseModel):
    file_name: str
    mime_type: str
    content_base64: str
