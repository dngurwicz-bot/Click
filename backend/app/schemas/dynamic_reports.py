from typing import Any, Literal, Optional
from pydantic import BaseModel, Field


class FieldDefinition(BaseModel):
    id: str
    label: str
    type: Literal["string", "number", "boolean", "date", "datetime", "uuid"]
    operators: list[str]


class EntityDefinition(BaseModel):
    id: str
    label: str
    description: Optional[str] = None
    fields: list[FieldDefinition]


class DynamicReportSchemaResponse(BaseModel):
    entities: list[EntityDefinition]


class FilterRule(BaseModel):
    field: str
    operator: Literal["equals", "not_equals", "contains", "greater_than", "less_than", "is_null", "is_not_null", "in", "not_in"]
    value: Any


class DynamicReportQuery(BaseModel):
    entity: str
    selected_fields: list[str]
    filters: list[FilterRule] = Field(default_factory=list)
    sort_field: Optional[str] = None
    sort_desc: bool = False
    limit: int = 100


class DynamicReportResult(BaseModel):
    columns: list[str]
    rows: list[dict[str, Any]]
    total: int
