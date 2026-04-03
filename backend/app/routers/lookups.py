import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete

from app.database import get_db
from app.middleware.auth import require_admin, CurrentUser
from app.models.lookup import LookupList, LookupItem
from app.schemas.lookup import (
    LookupListCreate, LookupListUpdate, LookupListOut, LookupListItem,
    LookupItemCreate, LookupItemUpdate, LookupItemOut,
)

router = APIRouter(prefix="/api/admin/lookups", tags=["lookups"])


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_list_or_404(db: AsyncSession, list_key: str) -> LookupList:
    result = await db.execute(select(LookupList).where(LookupList.list_key == list_key))
    lst = result.scalar_one_or_none()
    if not lst:
        raise HTTPException(status_code=404, detail={"error": "List not found", "code": "NOT_FOUND"})
    return lst


# ── Lookup Lists ──────────────────────────────────────────────────────────────

@router.get("", response_model=list[LookupListItem])
async def list_lookup_lists(
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    result = await db.execute(select(LookupList).order_by(LookupList.name_he))
    lists = result.scalars().all()

    items = []
    for lst in lists:
        count_result = await db.execute(
            select(func.count()).select_from(LookupItem)
            .where(LookupItem.list_id == lst.id)
            .where(LookupItem.is_active == True)
        )
        item_count = count_result.scalar_one()
        items.append(LookupListItem(
            id=lst.id,
            list_key=lst.list_key,
            name_he=lst.name_he,
            description=lst.description,
            is_system=lst.is_system,
            is_active=lst.is_active,
            item_count=item_count,
            created_at=lst.created_at,
        ))
    return items


@router.post("", response_model=LookupListOut, status_code=status.HTTP_201_CREATED)
async def create_lookup_list(
    body: LookupListCreate,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    existing = await db.execute(select(LookupList).where(LookupList.list_key == body.list_key))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail={"error": "list_key already exists", "code": "DUPLICATE_KEY"},
        )
    lst = LookupList(**body.model_dump())
    db.add(lst)
    await db.commit()
    await db.refresh(lst)
    out = LookupListOut.model_validate(lst)
    return out


@router.get("/{list_key}", response_model=LookupListOut)
async def get_lookup_list(
    list_key: str,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    lst = await _get_list_or_404(db, list_key)
    items_result = await db.execute(
        select(LookupItem)
        .where(LookupItem.list_id == lst.id)
        .order_by(LookupItem.sort_order, LookupItem.label_he)
    )
    items = items_result.scalars().all()
    out = LookupListOut.model_validate(lst)
    out.items = [LookupItemOut.model_validate(i) for i in items]
    return out


@router.put("/{list_key}", response_model=LookupListOut)
async def update_lookup_list(
    list_key: str,
    body: LookupListUpdate,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    lst = await _get_list_or_404(db, list_key)
    if body.name_he is not None:     lst.name_he = body.name_he
    if body.description is not None: lst.description = body.description
    if body.is_active is not None:
        if lst.is_system and not body.is_active:
            raise HTTPException(
                status_code=422,
                detail={"error": "לא ניתן לבטל רשימת מערכת", "code": "SYSTEM_LIST"},
            )
        lst.is_active = body.is_active
    await db.commit()
    await db.refresh(lst)
    items_result = await db.execute(
        select(LookupItem).where(LookupItem.list_id == lst.id)
        .order_by(LookupItem.sort_order, LookupItem.label_he)
    )
    out = LookupListOut.model_validate(lst)
    out.items = [LookupItemOut.model_validate(i) for i in items_result.scalars().all()]
    return out


# ── Lookup Items ──────────────────────────────────────────────────────────────

@router.post("/{list_key}/items", response_model=LookupItemOut, status_code=status.HTTP_201_CREATED)
async def create_lookup_item(
    list_key: str,
    body: LookupItemCreate,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    lst = await _get_list_or_404(db, list_key)
    existing = await db.execute(
        select(LookupItem)
        .where(LookupItem.list_id == lst.id)
        .where(LookupItem.item_key == body.item_key)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail={"error": "item_key already exists in this list", "code": "DUPLICATE_ITEM_KEY"},
        )
    item = LookupItem(list_id=lst.id, **body.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return LookupItemOut.model_validate(item)


@router.delete("/{list_key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lookup_list(
    list_key: str,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    lst = await _get_list_or_404(db, list_key)
    if lst.is_system:
        raise HTTPException(
            status_code=422,
            detail={"error": "לא ניתן למחוק רשימת מערכת", "code": "SYSTEM_LIST"},
        )
    await db.execute(delete(LookupItem).where(LookupItem.list_id == lst.id))
    await db.delete(lst)
    await db.commit()


@router.delete("/{list_key}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lookup_item(
    list_key: str,
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    lst = await _get_list_or_404(db, list_key)
    result = await db.execute(
        select(LookupItem)
        .where(LookupItem.id == item_id)
        .where(LookupItem.list_id == lst.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail={"error": "Item not found", "code": "NOT_FOUND"})
    if item.is_system:
        raise HTTPException(
            status_code=422,
            detail={"error": "לא ניתן למחוק פריט מערכת", "code": "SYSTEM_ITEM"},
        )
    await db.delete(item)
    await db.commit()


@router.put("/{list_key}/items/{item_id}", response_model=LookupItemOut)
async def update_lookup_item(
    list_key: str,
    item_id: uuid.UUID,
    body: LookupItemUpdate,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_admin),
):
    lst = await _get_list_or_404(db, list_key)
    result = await db.execute(
        select(LookupItem)
        .where(LookupItem.id == item_id)
        .where(LookupItem.list_id == lst.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail={"error": "Item not found", "code": "NOT_FOUND"})

    if item.is_system and body.is_active is False:
        raise HTTPException(
            status_code=422,
            detail={"error": "לא ניתן לבטל פריט מערכת", "code": "SYSTEM_ITEM"},
        )
    if body.label_he   is not None: item.label_he   = body.label_he
    if body.sort_order is not None: item.sort_order = body.sort_order
    if body.is_active  is not None: item.is_active  = body.is_active
    await db.commit()
    await db.refresh(item)
    return LookupItemOut.model_validate(item)
