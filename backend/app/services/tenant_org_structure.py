from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Literal

from fastapi import HTTPException


OrgStructureLevel = Literal["division", "department", "section", "team"]

ORG_STRUCTURE_LEVELS: tuple[OrgStructureLevel, ...] = (
    "division",
    "department",
    "section",
    "team",
)

DEFAULT_ORG_STRUCTURE_LEVELS: list[OrgStructureLevel] = list(ORG_STRUCTURE_LEVELS)
DEFAULT_POSITION_ATTACHMENT_LEVEL: OrgStructureLevel = "team"


@dataclass
class OrgStructureImpactSummary:
    converted_units_count: int = 0
    reparented_units_count: int = 0
    affected_positions_count: int = 0
    affected_employments_count: int = 0
    warnings: list[str] | None = None

    def as_dict(self) -> dict[str, object]:
        return {
            "converted_units_count": self.converted_units_count,
            "reparented_units_count": self.reparented_units_count,
            "affected_positions_count": self.affected_positions_count,
            "affected_employments_count": self.affected_employments_count,
            "warnings": list(self.warnings or []),
        }


def sanitize_org_structure_levels(levels: list[str] | tuple[str, ...] | None) -> list[OrgStructureLevel]:
    if not levels:
        return DEFAULT_ORG_STRUCTURE_LEVELS.copy()
    normalized = [level for level in ORG_STRUCTURE_LEVELS if level in levels]
    if not normalized:
        raise ValueError("At least one valid org structure level is required")
    if len(set(normalized)) != len(normalized):
        raise ValueError("Org structure levels must be unique")
    return normalized


def resolve_position_attachment_level(
    levels: list[OrgStructureLevel],
    requested_level: str | None,
) -> OrgStructureLevel:
    if requested_level:
        if requested_level not in levels:
            raise ValueError("Position attachment level must be one of the active levels")
        return requested_level  # type: ignore[return-value]
    return levels[-1]


def resolve_optional_position_attachment_level(
    levels: list[OrgStructureLevel],
    requested_level: str | None,
) -> OrgStructureLevel | None:
    if requested_level is None:
        return None
    return resolve_position_attachment_level(levels, requested_level)


def get_expected_parent_level(
    levels: list[OrgStructureLevel],
    unit_type: str,
    *,
    is_hierarchical: bool,
) -> OrgStructureLevel | None:
    if unit_type not in levels:
        raise ValueError("Org unit type is not enabled for this tenant")
    if not is_hierarchical:
        return None
    index = levels.index(unit_type)  # type: ignore[arg-type]
    if index == 0:
        return None
    return levels[index - 1]


def is_org_structure_locked(has_active_config: bool) -> bool:
    return has_active_config


def validate_org_structure_override(
    *,
    current_levels: list[OrgStructureLevel],
    proposed_levels: list[OrgStructureLevel],
    current_is_hierarchical: bool,
    proposed_is_hierarchical: bool,
    allow_hierarchy_change: bool = False,
) -> list[OrgStructureLevel]:
    normalized_current = sanitize_org_structure_levels(current_levels)
    normalized_proposed = sanitize_org_structure_levels(proposed_levels)
    if list(proposed_levels) != normalized_proposed:
        raise HTTPException(
            status_code=422,
            detail={"error": "Override levels must preserve existing order", "code": "INVALID_ORG_STRUCTURE_OVERRIDE"},
        )
    if proposed_is_hierarchical != current_is_hierarchical and not allow_hierarchy_change:
        raise HTTPException(
            status_code=422,
            detail={"error": "Hierarchy mode cannot change after initial setup", "code": "INVALID_ORG_STRUCTURE_OVERRIDE"},
        )
    if len(normalized_proposed) > len(normalized_current):
        raise HTTPException(
            status_code=422,
            detail={"error": "Override may only remove existing org levels", "code": "INVALID_ORG_STRUCTURE_OVERRIDE"},
        )
    cursor = 0
    for level in normalized_proposed:
        try:
            found_at = normalized_current.index(level, cursor)
        except ValueError as exc:
            raise HTTPException(
                status_code=422,
                detail={"error": "Override levels must preserve existing order", "code": "INVALID_ORG_STRUCTURE_OVERRIDE"},
            ) from exc
        cursor = found_at + 1
    return normalized_proposed


def resolve_override_target_type(
    *,
    unit_type: OrgStructureLevel,
    current_levels: list[OrgStructureLevel],
    proposed_levels: list[OrgStructureLevel],
) -> OrgStructureLevel:
    if unit_type in proposed_levels:
        return unit_type

    current_index = current_levels.index(unit_type)
    for candidate in current_levels[current_index + 1:]:
        if candidate in proposed_levels:
            return candidate
    for candidate in reversed(current_levels[:current_index]):
        if candidate in proposed_levels:
            return candidate
    raise HTTPException(
        status_code=422,
        detail={"error": "Override must leave at least one active org level", "code": "INVALID_ORG_STRUCTURE_OVERRIDE"},
    )


def build_override_type_map(
    current_levels: list[OrgStructureLevel],
    proposed_levels: list[OrgStructureLevel],
) -> dict[OrgStructureLevel, OrgStructureLevel]:
    return {
        level: resolve_override_target_type(
            unit_type=level,
            current_levels=current_levels,
            proposed_levels=proposed_levels,
        )
        for level in current_levels
    }


def validate_org_structure_write_once(
    *,
    has_active_config: bool,
    force_override: bool,
) -> None:
    if has_active_config and not force_override:
        raise HTTPException(
            status_code=409,
            detail={"error": "Org structure is locked after initial setup", "code": "ORG_STRUCTURE_LOCKED"},
        )


def validate_override_effective_date(valid_from: date, current_valid_from: date) -> None:
    if valid_from <= current_valid_from:
        raise HTTPException(
            status_code=422,
            detail={"error": "Override effective date must be after the initial org structure date", "code": "INVALID_ORG_STRUCTURE_OVERRIDE"},
        )
