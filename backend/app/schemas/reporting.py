from datetime import date, datetime
from typing import Any, Literal, Optional
import uuid

from pydantic import BaseModel, Field


ReportFieldType = Literal["string", "number", "date", "datetime", "uuid", "boolean"]
ReportFilterOperator = Literal[
    "equals",
    "not_equals",
    "contains",
    "greater_than",
    "greater_or_equal",
    "less_than",
    "less_or_equal",
    "is_null",
    "is_not_null",
    "in",
    "not_in",
]
ReportMetricOperation = Literal["count", "sum", "avg", "count_distinct"]
ReportViewMode = Literal["detail", "summary"]
ReportVisibility = Literal["personal", "shared"]
ReportFormat = Literal["csv", "pdf"]


class ReportFieldDefinition(BaseModel):
    id: str
    label: str
    type: ReportFieldType
    operators: list[ReportFilterOperator]
    groupable: bool = False
    category: Optional[str] = None
    description: Optional[str] = None


class ReportMetricDefinition(BaseModel):
    operation: ReportMetricOperation
    field: Optional[str] = None
    label: str


class ReportDatasetDefinition(BaseModel):
    id: str
    label: str
    description: str
    fields: list[ReportFieldDefinition]
    default_columns: list[str]
    groupable_fields: list[str] = []
    metrics: list[ReportMetricDefinition] = []


class ReportFilter(BaseModel):
    field: str
    operator: ReportFilterOperator
    value: Any = None


class ReportSort(BaseModel):
    field: str
    direction: Literal["asc", "desc"] = "asc"


class ReportMetricRequest(BaseModel):
    operation: ReportMetricOperation
    field: Optional[str] = None
    label: Optional[str] = None


class ReportDefinition(BaseModel):
    dataset: str
    columns: list[str] = Field(default_factory=list)
    filters: list[ReportFilter] = Field(default_factory=list)
    sort: list[ReportSort] = Field(default_factory=list)
    as_of_date: Optional[date] = None
    group_by: list[str] = Field(default_factory=list)
    metrics: list[ReportMetricRequest] = Field(default_factory=list)
    limit: int = 50
    offset: int = 0
    view_mode: ReportViewMode = "detail"


class ReportMetricValue(BaseModel):
    label: str
    value: str


class ReportResult(BaseModel):
    columns: list[str]
    rows: list[dict[str, Any]]
    total: int
    summary: list[ReportMetricValue] = Field(default_factory=list)
    applied_definition: ReportDefinition


class ReportCatalogItem(BaseModel):
    id: str
    title: str
    description: str
    dataset: str
    available_formats: list[ReportFormat] = Field(default_factory=lambda: ["csv", "pdf"])
    definition: ReportDefinition


class ReportFilterOption(BaseModel):
    value: str
    label: str


class ReportFilterOptions(BaseModel):
    tenant_statuses: list[ReportFilterOption] = Field(default_factory=list)
    modules: list[ReportFilterOption] = Field(default_factory=list)


class ReportCatalogResponse(BaseModel):
    reports: list[ReportCatalogItem]
    filter_options: ReportFilterOptions


class ReportDatasetsResponse(BaseModel):
    datasets: list[ReportDatasetDefinition]
    filter_options: ReportFilterOptions


class ReportQueryRequest(BaseModel):
    title: Optional[str] = None
    definition: ReportDefinition


class ReportExportRequest(BaseModel):
    title: Optional[str] = None
    format: ReportFormat = "csv"
    definition: ReportDefinition


class ReportExportResponse(BaseModel):
    file_name: str
    mime_type: str
    content_base64: str


class SavedReportViewCreate(BaseModel):
    name: str
    description: Optional[str] = None
    visibility: ReportVisibility = "personal"
    definition: ReportDefinition


class SavedReportViewUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    visibility: Optional[ReportVisibility] = None
    definition: Optional[ReportDefinition] = None


class SavedReportViewOut(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    dataset: str
    visibility: ReportVisibility
    owner_id: uuid.UUID
    owner_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    definition: ReportDefinition

    model_config = {"from_attributes": True}
