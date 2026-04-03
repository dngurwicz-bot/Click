import uuid
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete

from app.database import get_db
from app.middleware.auth import require_super_admin, CurrentUser
from app.models.module import OrgTemplate, OrgTemplateModule
from app.schemas.template import TemplateOut, TemplateCreate, TemplateActionBody

router = APIRouter(prefix="/api/admin/templates", tags=["templates"])


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _load_module_slugs(db: AsyncSession, template_id: uuid.UUID) -> list[str]:
    res = await db.execute(
        select(OrgTemplateModule.module_slug).where(OrgTemplateModule.template_id == template_id)
    )
    return [r[0] for r in res.all()]


async def _save_module_slugs(db: AsyncSession, template_id: uuid.UUID, slugs: list[str]) -> None:
    await db.execute(
        delete(OrgTemplateModule)
        .where(OrgTemplateModule.template_id == template_id)
        .execution_options(synchronize_session=False)
    )
    for s in slugs:
        db.add(OrgTemplateModule(template_id=template_id, module_slug=s))


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[TemplateOut])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_super_admin),
):
    """List all templates (active + history), ordered by valid_from DESC."""
    result = await db.execute(
        select(OrgTemplate).order_by(OrgTemplate.valid_from.desc())
    )
    templates = result.scalars().all()
    out = []
    for t in templates:
        item = TemplateOut.model_validate(t)
        item.module_slugs = await _load_module_slugs(db, t.id)
        out.append(item)
    return out


@router.post("", response_model=TemplateOut, status_code=201)
async def create_template(
    body: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_super_admin),
):
    """Create a new template record."""
    new_template = OrgTemplate(
        name=body.name,
        description=body.description,
        default_package_slug=body.default_package_slug,
        default_billing_cycle=body.default_billing_cycle,
        trial_days=body.trial_days,
        is_active=body.is_active,
        sort_order=body.sort_order,
        target_industry=body.target_industry,
        recommended_size=body.recommended_size,
        valid_from=body.valid_from or date.today(),
        valid_to=body.valid_to,
    )
    db.add(new_template)
    await db.flush()
    await db.refresh(new_template)
    await _save_module_slugs(db, new_template.id, body.module_slugs)
    await db.commit()
    out = TemplateOut.model_validate(new_template)
    out.module_slugs = await _load_module_slugs(db, new_template.id)
    return out


@router.put("/{template_id}", response_model=TemplateOut)
async def update_template(
    template_id: uuid.UUID,
    body: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_super_admin),
):
    """Update template metadata (name, description, non-temporal fields)."""
    result = await db.execute(select(OrgTemplate).where(OrgTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail={"error": "Template not found", "code": "NOT_FOUND"})

    template.name = body.name
    template.description = body.description
    template.default_package_slug = body.default_package_slug
    template.default_billing_cycle = body.default_billing_cycle
    template.trial_days = body.trial_days
    template.is_active = body.is_active
    template.sort_order = body.sort_order
    template.target_industry = body.target_industry
    template.recommended_size = body.recommended_size
    if body.valid_from is not None:
        template.valid_from = body.valid_from
    if body.valid_to is not None:
        template.valid_to = body.valid_to

    # TemplateCreate.module_slugs defaults to [] — treat as "replace with provided list"
    await _save_module_slugs(db, template_id, body.module_slugs)
    await db.commit()
    await db.refresh(template)
    out = TemplateOut.model_validate(template)
    out.module_slugs = await _load_module_slugs(db, template.id)
    return out


@router.delete("/{template_id}")
async def delete_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_super_admin),
):
    """Hard delete a template by id."""
    result = await db.execute(select(OrgTemplate).where(OrgTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail={"error": "Template not found", "code": "NOT_FOUND"})

    await db.execute(
        delete(OrgTemplate)
        .where(OrgTemplate.id == template_id)
        .execution_options(synchronize_session=False)
    )
    await db.commit()
    return {"ok": True}


@router.get("/{template_id}", response_model=list[TemplateOut])
async def get_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_super_admin),
):
    """Get a single template with its full history (all rows sharing the same name)."""
    result = await db.execute(select(OrgTemplate).where(OrgTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail={"error": "Template not found", "code": "NOT_FOUND"})

    history_result = await db.execute(
        select(OrgTemplate)
        .where(OrgTemplate.name == template.name)
        .order_by(OrgTemplate.valid_from.desc())
    )
    history = history_result.scalars().all()
    out = []
    for t in history:
        item = TemplateOut.model_validate(t)
        item.module_slugs = await _load_module_slugs(db, t.id)
        out.append(item)
    return out


@router.put("/{template_id}/record", response_model=TemplateOut)
async def template_record_action(
    template_id: uuid.UUID,
    body: TemplateActionBody,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(require_super_admin),
):
    """Temporal record actions: delete | close | update | add | set (kabiya)."""

    # Validate date range when both dates provided
    if body.valid_from and body.valid_to and body.valid_to < body.valid_from:
        raise HTTPException(
            status_code=422,
            detail={"error": "valid_to cannot be before valid_from", "code": "INVALID_DATE_RANGE"},
        )

    # Load the anchor row (the row identified by template_id in the URL)
    result = await db.execute(select(OrgTemplate).where(OrgTemplate.id == template_id))
    anchor = result.scalar_one_or_none()
    if not anchor:
        raise HTTPException(status_code=404, detail={"error": "Template not found", "code": "NOT_FOUND"})

    # The name used to scope history rows
    template_name = anchor.name

    action = body.action or "update"

    # ── Action: delete — hard-delete this specific row ───────────────────────
    if action == "delete":
        await db.execute(
            delete(OrgTemplate)
            .where(OrgTemplate.id == template_id)
            .execution_options(synchronize_session=False)
        )
        await db.commit()
        return TemplateOut.model_validate(anchor)

    # ── Action: close — set valid_to on this row ─────────────────────────────
    if action == "close":
        if not body.valid_to:
            raise HTTPException(
                status_code=422,
                detail={"error": "Close action requires valid_to", "code": "MISSING_DATE"},
            )
        await db.execute(
            update(OrgTemplate)
            .where(OrgTemplate.id == template_id)
            .values(valid_to=body.valid_to)
            .execution_options(synchronize_session=False)
        )
        await db.commit()
        refreshed = await db.execute(select(OrgTemplate).where(OrgTemplate.id == template_id))
        updated = refreshed.scalar_one()
        out = TemplateOut.model_validate(updated)
        out.module_slugs = await _load_module_slugs(db, updated.id)
        return out

    # ── Action: update ────────────────────────────────────────────────────────
    # same valid_from → in-place update of all fields
    # new valid_from  → close old row (valid_to = new_from - 1) + insert new row
    if action == "update":
        if not body.valid_from:
            raise HTTPException(
                status_code=422,
                detail={"error": "Update action requires valid_from", "code": "MISSING_DATE"},
            )

        # Load original as plain tuple to avoid ORM identity map issues
        orig_res = await db.execute(
            select(
                OrgTemplate.id,
                OrgTemplate.valid_from,
                OrgTemplate.valid_to,
                OrgTemplate.name,
            )
            .where(OrgTemplate.id == template_id)
        )
        orig = orig_res.one_or_none()
        if orig is None:
            raise HTTPException(status_code=404, detail={"error": "Template not found", "code": "NOT_FOUND"})

        date_changed = orig.valid_from != body.valid_from

        def _field_values(body: TemplateActionBody, anchor: OrgTemplate) -> dict:
            return {
                "name": body.name if body.name is not None else anchor.name,
                "description": body.description if body.description is not None else anchor.description,
                "default_package_slug": body.default_package_slug if body.default_package_slug is not None else anchor.default_package_slug,
                "default_billing_cycle": body.default_billing_cycle if body.default_billing_cycle is not None else anchor.default_billing_cycle,
                "trial_days": body.trial_days if body.trial_days is not None else anchor.trial_days,
                "is_active": body.is_active if body.is_active is not None else anchor.is_active,
                "sort_order": body.sort_order if body.sort_order is not None else anchor.sort_order,
                "target_industry": body.target_industry if body.target_industry is not None else anchor.target_industry,
                "recommended_size": body.recommended_size if body.recommended_size is not None else anchor.recommended_size,
            }

        if not date_changed:
            # In-place update
            field_vals = _field_values(body, anchor)
            field_vals["valid_to"] = body.valid_to
            await db.execute(
                update(OrgTemplate)
                .where(OrgTemplate.id == template_id)
                .values(**field_vals)
                .execution_options(synchronize_session=False)
            )
            if body.module_slugs is not None:
                await _save_module_slugs(db, template_id, body.module_slugs)
            await db.commit()
            refreshed = await db.execute(select(OrgTemplate).where(OrgTemplate.id == template_id))
            updated = refreshed.scalar_one()
            out = TemplateOut.model_validate(updated)
            out.module_slugs = await _load_module_slugs(db, updated.id)
            return out
        else:
            # Date changed: close original + insert new row
            close_to = body.valid_from - timedelta(days=1)
            await db.execute(
                update(OrgTemplate)
                .where(OrgTemplate.id == template_id)
                .values(valid_to=close_to)
                .execution_options(synchronize_session=False)
            )
            field_vals = _field_values(body, anchor)
            new_row = OrgTemplate(
                **field_vals,
                valid_from=body.valid_from,
                valid_to=body.valid_to,
            )
            db.add(new_row)
            await db.flush()
            await db.refresh(new_row)
            # Copy module_slugs from old row unless new ones are provided
            if body.module_slugs is not None:
                slugs_to_copy = body.module_slugs
            else:
                slugs_to_copy = await _load_module_slugs(db, template_id)
            await _save_module_slugs(db, new_row.id, slugs_to_copy)
            await db.commit()
            out = TemplateOut.model_validate(new_row)
            out.module_slugs = await _load_module_slugs(db, new_row.id)
            return out

    # ── Action: add — insert a new record ────────────────────────────────────
    if action == "add":
        if not body.valid_from:
            raise HTTPException(
                status_code=422,
                detail={"error": "Add action requires valid_from", "code": "MISSING_DATE"},
            )
        if not body.name:
            raise HTTPException(
                status_code=422,
                detail={"error": "Add action requires name", "code": "MISSING_NAME"},
            )
        new_row = OrgTemplate(
            name=body.name,
            description=body.description,
            default_package_slug=body.default_package_slug,
            default_billing_cycle=body.default_billing_cycle or "monthly",
            trial_days=body.trial_days if body.trial_days is not None else 30,
            is_active=body.is_active if body.is_active is not None else True,
            sort_order=body.sort_order if body.sort_order is not None else 10,
            target_industry=body.target_industry,
            recommended_size=body.recommended_size,
            valid_from=body.valid_from,
            valid_to=body.valid_to,
        )
        db.add(new_row)
        await db.flush()
        await db.refresh(new_row)
        await _save_module_slugs(db, new_row.id, body.module_slugs or [])
        await db.commit()
        out = TemplateOut.model_validate(new_row)
        out.module_slugs = await _load_module_slugs(db, new_row.id)
        return out

    # ── Action: set (kabiya) ──────────────────────────────────────────────────
    # Load all rows for this template name as plain tuples (NOT ORM objects),
    # implement full split/trim/delete/keep logic, then insert the new record.
    if action == "set":
        if not body.valid_from:
            raise HTTPException(
                status_code=422,
                detail={"error": "Set action requires valid_from", "code": "MISSING_DATE"},
            )
        new_from: date = body.valid_from
        new_to: date | None = body.valid_to

        # Load as plain Row tuples — NO ORM objects enter the identity map
        rows_res = await db.execute(
            select(
                OrgTemplate.id,
                OrgTemplate.valid_from,
                OrgTemplate.valid_to,
                OrgTemplate.name,
                OrgTemplate.description,
                OrgTemplate.default_package_slug,
                OrgTemplate.default_billing_cycle,
                OrgTemplate.trial_days,
                OrgTemplate.is_active,
                OrgTemplate.sort_order,
                OrgTemplate.target_industry,
                OrgTemplate.recommended_size,
            )
            .where(OrgTemplate.name == template_name)
            .order_by(OrgTemplate.valid_from)
        )
        existing = rows_res.all()  # list of plain Row namedtuples, NOT ORM objects

        for row in existing:
            rec_id = row.id
            rec_from: date = row.valid_from
            rec_to: date | None = row.valid_to

            # Completely BEFORE new period → keep (preserve history)
            if rec_to is not None and rec_to < new_from:
                continue

            # Completely AFTER new period (only when new period has end) → keep
            if new_to is not None and rec_from > new_to:
                continue

            starts_before = rec_from < new_from
            ends_after = new_to is not None and (rec_to is None or rec_to > new_to)

            if starts_before and ends_after:
                # SPLIT: trim left half, create right half
                right_row = OrgTemplate(
                    name=row.name,
                    description=row.description,
                    default_package_slug=row.default_package_slug,
                    default_billing_cycle=row.default_billing_cycle,
                    trial_days=row.trial_days,
                    is_active=row.is_active,
                    sort_order=row.sort_order,
                    target_industry=row.target_industry,
                    recommended_size=row.recommended_size,
                    valid_from=new_to + timedelta(days=1),  # type: ignore[operator]
                    valid_to=rec_to,
                )
                db.add(right_row)
                await db.execute(
                    update(OrgTemplate)
                    .where(OrgTemplate.id == rec_id)
                    .values(valid_to=new_from - timedelta(days=1))
                    .execution_options(synchronize_session=False)
                )

            elif starts_before:
                # LEFT TRIM
                await db.execute(
                    update(OrgTemplate)
                    .where(OrgTemplate.id == rec_id)
                    .values(valid_to=new_from - timedelta(days=1))
                    .execution_options(synchronize_session=False)
                )

            elif ends_after:
                # RIGHT PUSH
                await db.execute(
                    update(OrgTemplate)
                    .where(OrgTemplate.id == rec_id)
                    .values(valid_from=new_to + timedelta(days=1))  # type: ignore[operator]
                    .execution_options(synchronize_session=False)
                )

            else:
                # COMPLETELY WITHIN new period → delete
                await db.execute(
                    delete(OrgTemplate)
                    .where(OrgTemplate.id == rec_id)
                    .execution_options(synchronize_session=False)
                )

        # Determine new record field values (fall back to anchor row values)
        new_row = OrgTemplate(
            name=body.name if body.name is not None else anchor.name,
            description=body.description if body.description is not None else anchor.description,
            default_package_slug=body.default_package_slug if body.default_package_slug is not None else anchor.default_package_slug,
            default_billing_cycle=body.default_billing_cycle if body.default_billing_cycle is not None else anchor.default_billing_cycle,
            trial_days=body.trial_days if body.trial_days is not None else anchor.trial_days,
            is_active=body.is_active if body.is_active is not None else anchor.is_active,
            sort_order=body.sort_order if body.sort_order is not None else anchor.sort_order,
            target_industry=body.target_industry if body.target_industry is not None else anchor.target_industry,
            recommended_size=body.recommended_size if body.recommended_size is not None else anchor.recommended_size,
            valid_from=new_from,
            valid_to=new_to,
        )
        db.add(new_row)
        await db.flush()
        await db.refresh(new_row)
        await _save_module_slugs(db, new_row.id, body.module_slugs or [])
        await db.commit()
        out = TemplateOut.model_validate(new_row)
        out.module_slugs = await _load_module_slugs(db, new_row.id)
        return out

    raise HTTPException(
        status_code=422,
        detail={"error": f"Unknown action: {action}", "code": "UNKNOWN_ACTION"},
    )
