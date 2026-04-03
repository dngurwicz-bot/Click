# Lookup Lists (ניהול רשימות ארגוניות) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an admin UI to manage the values of all dropdown/select fields in the system (entity types, contact types, packages, etc.) — so admins can add/edit/deactivate values without touching code.

**Architecture:** Two new tables (`lookup_lists` parent + `lookup_items` child). Simple CRUD — no temporal tracking needed for reference data. Pre-seed the three existing system lists. Frontend mirrors the tenants pattern: list page → CardPage detail with child grid + modal.

**Tech Stack:** FastAPI + SQLAlchemy async (backend) · Next.js 14 App Router + TypeScript + Tailwind (frontend) · Alembic (migrations) · Existing `CardPage`, `FormField`, `TopNav`, `AdminMenu` components.

---

## Task 1: Alembic migration — create tables + seed data

**Files:**
- Create: `backend/alembic/versions/0003_lookup_lists.py`

**Step 1: Create the migration file**

```python
"""lookup_lists and lookup_items tables with seed data

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── lookup_lists ──────────────────────────────────────────────────────────
    op.create_table(
        "lookup_lists",
        sa.Column("id",          UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("list_key",    sa.String(),  nullable=False, unique=True),
        sa.Column("name_he",     sa.String(),  nullable=False),
        sa.Column("description", sa.String(),  nullable=True),
        sa.Column("is_system",   sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_active",   sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── lookup_items ──────────────────────────────────────────────────────────
    op.create_table(
        "lookup_items",
        sa.Column("id",         UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("list_id",    UUID(as_uuid=True), sa.ForeignKey("lookup_lists.id"), nullable=False),
        sa.Column("item_key",   sa.String(), nullable=False),
        sa.Column("label_he",   sa.String(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_system",  sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_active",  sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        "uq_lookup_items_list_key", "lookup_items", ["list_id", "item_key"]
    )

    # ── seed: entity_type ─────────────────────────────────────────────────────
    entity_list_id = str(uuid.uuid4())
    op.execute(f"""
        INSERT INTO lookup_lists (id, list_key, name_he, description, is_system, is_active)
        VALUES ('{entity_list_id}', 'entity_type', 'סוגי ישויות', 'סוג הישות המשפטית של הארגון', true, true)
    """)
    for sort_order, (item_key, label_he) in enumerate([
        ("company",       'חברה בע"מ'),
        ("self_employed", "עוסק מורשה"),
        ("nonprofit",     "עמותה"),
        ("gov",           "גוף ממשלתי"),
    ]):
        op.execute(f"""
            INSERT INTO lookup_items (id, list_id, item_key, label_he, sort_order, is_system, is_active)
            VALUES ('{uuid.uuid4()}', '{entity_list_id}', '{item_key}', '{label_he}', {sort_order}, true, true)
        """)

    # ── seed: contact_type ────────────────────────────────────────────────────
    contact_list_id = str(uuid.uuid4())
    op.execute(f"""
        INSERT INTO lookup_lists (id, list_key, name_he, description, is_system, is_active)
        VALUES ('{contact_list_id}', 'contact_type', 'סוגי קשרים', 'סוג איש הקשר של הארגון', true, true)
    """)
    for sort_order, (item_key, label_he) in enumerate([
        ("main",      "ראשי"),
        ("billing",   "חשבונאות"),
        ("technical", "טכני"),
        ("other",     "אחר"),
    ]):
        op.execute(f"""
            INSERT INTO lookup_items (id, list_id, item_key, label_he, sort_order, is_system, is_active)
            VALUES ('{uuid.uuid4()}', '{contact_list_id}', '{item_key}', '{label_he}', {sort_order}, true, true)
        """)

    # ── seed: package ─────────────────────────────────────────────────────────
    package_list_id = str(uuid.uuid4())
    op.execute(f"""
        INSERT INTO lookup_lists (id, list_key, name_he, description, is_system, is_active)
        VALUES ('{package_list_id}', 'package', 'חבילות', 'חבילות המנוי הזמינות', true, true)
    """)
    for sort_order, (item_key, label_he) in enumerate([
        ("starter",      "סטרטר"),
        ("professional", "פרופשיונל"),
        ("enterprise",   "אנטרפרייז"),
    ]):
        op.execute(f"""
            INSERT INTO lookup_items (id, list_id, item_key, label_he, sort_order, is_system, is_active)
            VALUES ('{uuid.uuid4()}', '{package_list_id}', '{item_key}', '{label_he}', {sort_order}, true, true)
        """)


def downgrade() -> None:
    op.drop_table("lookup_items")
    op.drop_table("lookup_lists")
```

**Step 2: Run migration**

```bash
cd backend
alembic upgrade head
```

Expected output: `Running upgrade 0002 -> 0003, lookup_lists and lookup_items tables with seed data`

**Step 3: Verify tables + seed data exist**

```bash
# In psql or Supabase SQL editor:
SELECT list_key, name_he, is_system FROM lookup_lists ORDER BY list_key;
SELECT li.item_key, li.label_he, ll.list_key
FROM lookup_items li JOIN lookup_lists ll ON li.list_id = ll.id
ORDER BY ll.list_key, li.sort_order;
```

Expected: 3 lists, 11 items total.

**Step 4: Commit**

```bash
git add backend/alembic/versions/0003_lookup_lists.py
git commit -m "feat: add lookup_lists + lookup_items migration with seed data"
```

---

## Task 2: Backend model

**Files:**
- Create: `backend/app/models/lookup.py`
- Modify: `backend/app/models/__init__.py` (or wherever models are imported — check if one exists, else skip)

**Step 1: Create model file**

```python
# backend/app/models/lookup.py
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, Integer, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class LookupList(Base):
    __tablename__ = "lookup_lists"

    id:          Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    list_key:    Mapped[str]       = mapped_column(String, nullable=False, unique=True)
    name_he:     Mapped[str]       = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    is_system:   Mapped[bool]      = mapped_column(Boolean, nullable=False, default=False)
    is_active:   Mapped[bool]      = mapped_column(Boolean, nullable=False, default=True)
    created_at:  Mapped[datetime]  = mapped_column(DateTime(timezone=True), server_default=func.now())


class LookupItem(Base):
    __tablename__ = "lookup_items"
    __table_args__ = (
        UniqueConstraint("list_id", "item_key", name="uq_lookup_items_list_key"),
    )

    id:         Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    list_id:    Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lookup_lists.id"), nullable=False)
    item_key:   Mapped[str]       = mapped_column(String, nullable=False)
    label_he:   Mapped[str]       = mapped_column(String, nullable=False)
    sort_order: Mapped[int]       = mapped_column(Integer, nullable=False, default=0)
    is_system:  Mapped[bool]      = mapped_column(Boolean, nullable=False, default=False)
    is_active:  Mapped[bool]      = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime]  = mapped_column(DateTime(timezone=True), server_default=func.now())
```

**Step 2: Commit**

```bash
git add backend/app/models/lookup.py
git commit -m "feat: add LookupList + LookupItem SQLAlchemy models"
```

---

## Task 3: Backend schemas

**Files:**
- Create: `backend/app/schemas/lookup.py`

**Step 1: Create schema file**

```python
# backend/app/schemas/lookup.py
from pydantic import BaseModel
import uuid
from datetime import datetime
from typing import Optional


class LookupItemBase(BaseModel):
    item_key:   str
    label_he:   str
    sort_order: int = 0
    is_active:  bool = True


class LookupItemCreate(LookupItemBase):
    pass


class LookupItemUpdate(BaseModel):
    label_he:   Optional[str]  = None
    sort_order: Optional[int]  = None
    is_active:  Optional[bool] = None


class LookupItemOut(LookupItemBase):
    id:         uuid.UUID
    list_id:    uuid.UUID
    is_system:  bool
    created_at: datetime

    model_config = {"from_attributes": True}


class LookupListBase(BaseModel):
    list_key:    str
    name_he:     str
    description: Optional[str] = None
    is_active:   bool = True


class LookupListCreate(LookupListBase):
    pass


class LookupListUpdate(BaseModel):
    name_he:     Optional[str]  = None
    description: Optional[str]  = None
    is_active:   Optional[bool] = None


class LookupListOut(LookupListBase):
    id:         uuid.UUID
    is_system:  bool
    created_at: datetime
    items:      list[LookupItemOut] = []

    model_config = {"from_attributes": True}


class LookupListItem(BaseModel):
    """For the parent list page (no items embedded)"""
    id:          uuid.UUID
    list_key:    str
    name_he:     str
    description: Optional[str]
    is_system:   bool
    is_active:   bool
    item_count:  int
    created_at:  datetime

    model_config = {"from_attributes": True}
```

**Step 2: Commit**

```bash
git add backend/app/schemas/lookup.py
git commit -m "feat: add lookup list + item Pydantic schemas"
```

---

## Task 4: Backend router

**Files:**
- Create: `backend/app/routers/lookups.py`

**Step 1: Create router file**

```python
# backend/app/routers/lookups.py
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

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
    return LookupListOut.model_validate(lst)


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
    # Return with items
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
```

**Step 2: Commit**

```bash
git add backend/app/routers/lookups.py
git commit -m "feat: add lookups router with CRUD for lists and items"
```

---

## Task 5: Register router in main.py

**Files:**
- Modify: `backend/app/main.py`

**Step 1: Add import + include_router**

In `backend/app/main.py`, add `lookups` to the import:
```python
# Change this line:
from app.routers import auth, tenants, modules, admin_users
# To:
from app.routers import auth, tenants, modules, admin_users, lookups
```

Then add after `app.include_router(admin_users.router)`:
```python
app.include_router(lookups.router)
```

**Step 2: Restart backend and verify**

```bash
# Visit: http://localhost:8000/api/docs
# Should see new /api/admin/lookups endpoints listed
```

**Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: register lookups router in FastAPI app"
```

---

## Task 6: Frontend — parent list page

**Files:**
- Create: `frontend/app/admin/lookups/page.tsx`

**Step 1: Create the page**

```tsx
// frontend/app/admin/lookups/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, api } from "@/lib/api";
import { TopNav } from "@/components/layout/TopNav";
import { Plus, Search, HelpCircle, Printer, RefreshCw } from "lucide-react";

interface LookupListItem {
  id: string;
  list_key: string;
  name_he: string;
  description?: string;
  is_system: boolean;
  is_active: boolean;
  item_count: number;
  created_at: string;
}

export default function LookupsPage() {
  const router = useRouter();
  const [lists, setLists] = useState<LookupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  function loadLists() {
    setLoading(true);
    api.get<LookupListItem[]>("/api/admin/lookups")
      .then(setLists)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    loadLists();
  }, [router]);

  const filtered = lists.filter((l) =>
    l.name_he.includes(search) || l.list_key.includes(search)
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <TopNav />
      <main className="flex-1 overflow-hidden flex flex-col">

        {/* Title Bar */}
        <div className="bg-white border-b border-slate-200 flex items-center justify-between px-3 py-1.5 shrink-0"
             style={{ boxShadow: "0 1px 0 0 #e2e8f0" }}>
          <div className="flex items-center gap-0.5">
            <button title="עזרה" className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <HelpCircle size={13} />
            </button>
            <button title="הדפסה" className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <Printer size={13} />
            </button>
            <button title="רענן" className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors" onClick={loadLists}>
              <RefreshCw size={13} />
            </button>
          </div>
          <h1 className="text-sm font-semibold tracking-wide" style={{ color: "#1c2831" }}>
            ניהול רשימות ארגוניות
          </h1>
        </div>

        {/* Action Bar */}
        <div className="bg-slate-50 border-b border-slate-200 flex items-center justify-between px-3 py-1.5 shrink-0 gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/admin/lookups/new")}
              className="flex items-center gap-1 bg-brand-600 hover:bg-brand-700 text-white
                         text-xs font-semibold px-3 py-1.5 rounded-md transition-colors shadow-sm"
            >
              <Plus size={12} />
              חדש
            </button>
            <div className="relative">
              <Search size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="חיפוש..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-8 pl-3 py-1.5 text-xs border border-slate-300 bg-white rounded-md
                           focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100
                           text-right w-48 transition-colors"
              />
            </div>
          </div>
          <div className="text-xs text-slate-400 font-medium">
            {!loading && <span>{filtered.length} רשימות</span>}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto bg-white min-h-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center gap-3 text-slate-400">
              <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">טוען...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-sm">לא נמצאו רשימות</div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">שם הרשימה</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">מפתח</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">תיאור</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">פריטים</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-600 bg-slate-100 border-b border-slate-200 whitespace-nowrap">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l, i) => (
                  <tr
                    key={l.id}
                    className={`cursor-pointer transition-colors
                      ${i % 2 === 0 ? "bg-white hover:bg-brand-50/40" : "bg-slate-50/60 hover:bg-brand-50/40"}`}
                    onClick={() => router.push(`/admin/lookups/${l.list_key}`)}
                  >
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-800 font-medium">
                      {l.name_he}
                      {l.is_system && (
                        <span className="mr-2 text-[10px] font-normal px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">מערכת</span>
                      )}
                    </td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-500 font-mono">{l.list_key}</td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-500">{l.description ?? "—"}</td>
                    <td className="px-4 py-2 border-b border-slate-100 text-slate-600">{l.item_count}</td>
                    <td className="px-4 py-2 border-b border-slate-100">
                      {l.is_active ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />פעיל
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />לא פעיל
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </main>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/app/admin/lookups/page.tsx
git commit -m "feat: add lookup lists parent page (/admin/lookups)"
```

---

## Task 7: Frontend — new list page

**Files:**
- Create: `frontend/app/admin/lookups/new/page.tsx`

**Step 1: Create the page**

```tsx
// frontend/app/admin/lookups/new/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { TopNav } from "@/components/layout/TopNav";
import { FormField } from "@/components/ui/FormField";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

export default function NewLookupListPage() {
  const router = useRouter();
  const [form, setForm] = useState({ list_key: "", name_he: "", description: "", is_active: true });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const payload = {
        list_key:    form.list_key.trim(),
        name_he:     form.name_he.trim(),
        description: form.description.trim() || null,
        is_active:   true,
      };
      await api.post("/api/admin/lookups", payload);
      router.push(`/admin/lookups/${payload.list_key}`);
    } catch (err: unknown) {
      const e = err as { error?: string; detail?: { error?: string } };
      setError(e?.error ?? e?.detail?.error ?? "שגיאה בשמירה");
    } finally { setSaving(false); }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <TopNav />
      <main className="flex-1 overflow-hidden flex flex-col">

        {/* Title Bar */}
        <div className="bg-white border-b border-slate-200 flex items-center justify-between px-3 py-1.5 shrink-0"
             style={{ boxShadow: "0 1px 0 0 #e2e8f0" }}>
          <div className="flex items-center gap-0.5">
            <Link href="/admin/lookups"
              className="flex items-center gap-0.5 text-xs text-slate-500 hover:text-brand-600
                         px-2 py-0.5 rounded hover:bg-brand-50 transition-colors font-medium">
              <ChevronRight size={13} />
              רשימות
            </Link>
          </div>
          <h1 className="text-sm font-semibold tracking-wide" style={{ color: "#1c2831" }}>
            רשימה חדשה
          </h1>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-auto p-6">
          <form onSubmit={handleSubmit} className="max-w-lg mr-auto space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{error}</div>
            )}

            <FormField label="שם הרשימה" required value={form.name_he} readOnly={false} onChange={(v) => set("name_he", v)} />
            <FormField label="מפתח (key)" required value={form.list_key} readOnly={false} onChange={(v) => set("list_key", v.toLowerCase().replace(/\s/g, "_"))} />
            <FormField label="תיאור" value={form.description} readOnly={false} onChange={(v) => set("description", v)} />

            <div className="flex justify-start gap-2 pt-2">
              <button
                type="submit"
                disabled={saving || !form.list_key || !form.name_he}
                className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-md transition-colors"
              >
                {saving ? "שומר..." : "שמור"}
              </button>
              <Link href="/admin/lookups"
                className="border border-slate-300 bg-white text-slate-600 text-xs px-4 py-2 rounded-md hover:bg-slate-50 transition-colors">
                ביטול
              </Link>
            </div>
          </form>
        </div>

      </main>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/app/admin/lookups/new/page.tsx
git commit -m "feat: add new lookup list creation page"
```

---

## Task 8: Frontend — detail page (CardPage with items child grid + modal)

**Files:**
- Create: `frontend/app/admin/lookups/[key]/page.tsx`

This is the main detail page. It uses `CardPage` with:
- `parentContent`: static display of list metadata (name, key, description, active toggle)
- `formTabs`: `[]` (empty — parentContent takes over)
- `childTabs`: one tab "פריטים" with item rows; `onAddClick` and `onRowDoubleClick` open a modal

**Step 1: Create the page**

```tsx
// frontend/app/admin/lookups/[key]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { isLoggedIn, api } from "@/lib/api";
import { TopNav } from "@/components/layout/TopNav";
import { CardPage } from "@/components/layout/CardPage";
import { FormField } from "@/components/ui/FormField";
import { X } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface LookupItemOut {
  id: string;
  list_id: string;
  item_key: string;
  label_he: string;
  sort_order: number;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
}

interface LookupListOut {
  id: string;
  list_key: string;
  name_he: string;
  description?: string;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  items: LookupItemOut[];
}

// ── Item Modal ────────────────────────────────────────────────────────────────

interface ItemModalProps {
  listKey: string;
  item?: LookupItemOut;   // undefined = new
  onClose: () => void;
  onSaved: () => void;
}

function ItemModal({ listKey, item, onClose, onSaved }: ItemModalProps) {
  const isNew = !item;
  const [form, setForm] = useState({
    item_key:   item?.item_key   ?? "",
    label_he:   item?.label_he   ?? "",
    sort_order: String(item?.sort_order ?? "0"),
    is_active:  item?.is_active  ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      if (isNew) {
        await api.post(`/api/admin/lookups/${listKey}/items`, {
          item_key:   form.item_key.trim(),
          label_he:   form.label_he.trim(),
          sort_order: Number(form.sort_order),
          is_active:  true,
        });
      } else {
        await api.put(`/api/admin/lookups/${listKey}/items/${item!.id}`, {
          label_he:   form.label_he.trim(),
          sort_order: Number(form.sort_order),
          is_active:  form.is_active,
        });
      }
      onSaved(); onClose();
    } catch (err: unknown) {
      const e = err as { error?: string; detail?: { error?: string } };
      setError(e?.error ?? e?.detail?.error ?? "שגיאה בשמירה");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-200 text-slate-400 transition-colors">
            <X size={14} />
          </button>
          <span className="text-sm font-semibold text-slate-700">
            {isNew ? "פריט חדש" : "עריכת פריט"}
          </span>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-3">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{error}</div>
          )}

          {isNew ? (
            <FormField
              label="מפתח (key)"
              required
              value={form.item_key}
              readOnly={false}
              onChange={(v) => set("item_key", v.toLowerCase().replace(/\s/g, "_"))}
            />
          ) : (
            <FormField label="מפתח (key)" value={item.item_key} readOnly />
          )}

          <FormField label="תיאור" required value={form.label_he} readOnly={false} onChange={(v) => set("label_he", v)} />
          <FormField label="סדר" value={form.sort_order} readOnly={false} onChange={(v) => set("sort_order", v)} />

          {!isNew && !item.is_system && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500 shrink-0" style={{ minWidth: "88px" }}>פעיל</label>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-brand-600"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-100 flex justify-start gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !form.label_he || (isNew && !form.item_key)}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-1.5 rounded-md transition-colors"
          >
            {saving ? "שומר..." : "שמור"}
          </button>
          <button
            onClick={onClose}
            className="border border-slate-300 bg-white text-slate-600 text-xs px-4 py-1.5 rounded-md hover:bg-slate-50 transition-colors"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LookupDetailPage() {
  const router = useRouter();
  const params = useParams();
  const listKey = params.key as string;

  const [data,    setData]    = useState<LookupListOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState<{ open: boolean; item?: LookupItemOut }>({ open: false });

  function loadData() {
    setLoading(true);
    api.get<LookupListOut>(`/api/admin/lookups/${listKey}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    loadData();
  }, [router, listKey]);

  if (loading || !data) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <TopNav />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  // ── Parent content: list metadata ─────────────────────────────────────────
  const parentContent = (
    <div className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2">
      <FormField label="שם הרשימה" required value={data.name_he} readOnly />
      <FormField label="מפתח (key)" value={data.list_key} readOnly />
      <FormField label="תיאור" value={data.description ?? ""} readOnly />
      <FormField
        label="סטטוס"
        type="select"
        value={data.is_active ? "active" : "inactive"}
        options={[{ value: "active", label: "פעיל" }, { value: "inactive", label: "לא פעיל" }]}
        readOnly
      />
    </div>
  );

  // ── Child tab: items ──────────────────────────────────────────────────────
  const itemRows = data.items.map((item) => ({
    item_key:   <span className="font-mono text-slate-600">{item.item_key}</span>,
    label_he:   item.label_he,
    sort_order: item.sort_order,
    is_system: item.is_system
      ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">מערכת</span>
      : null,
    is_active: item.is_active
      ? <span className="inline-flex items-center gap-1 text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />פעיל</span>
      : <span className="inline-flex items-center gap-1 text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-slate-300" />לא פעיל</span>,
    _item: item,   // internal ref for double-click
  }));

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <TopNav />
      <main className="flex-1 overflow-hidden flex flex-col">
        <CardPage
          title={data.name_he}
          backHref="/admin/lookups"
          backLabel="רשימות"
          parentContent={parentContent}
          formTabs={[]}
          childTabs={[
            {
              id: "items",
              label: "פריטים",
              columns: [
                { key: "item_key",   label: "מפתח",  width: "w-40" },
                { key: "label_he",   label: "תיאור", required: true },
                { key: "sort_order", label: "סדר",   width: "w-20" },
                { key: "is_system",  label: "מערכת", width: "w-20" },
                { key: "is_active",  label: "פעיל",  width: "w-24" },
              ],
              rows: itemRows as Record<string, React.ReactNode>[],
              emptyMessage: "לחץ להוספת פריט חדש",
              onAddClick: () => setModal({ open: true, item: undefined }),
              onRowDoubleClick: (i) => setModal({ open: true, item: data.items[i] }),
            },
          ]}
        />
      </main>

      {modal.open && (
        <ItemModal
          listKey={listKey}
          item={modal.item}
          onClose={() => setModal({ open: false })}
          onSaved={loadData}
        />
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/app/admin/lookups/[key]/page.tsx
git commit -m "feat: add lookup list detail page with CardPage + item modal"
```

---

## Task 9: Add menu item to AdminMenu

**Files:**
- Modify: `frontend/components/layout/AdminMenu.tsx`

**Step 1: Add List icon import and new menu entry**

In `frontend/components/layout/AdminMenu.tsx`:

Change the import line:
```tsx
// Before:
import { ChevronDown, Building2, Package, Users, FileText, ClipboardList } from "lucide-react";
// After:
import { ChevronDown, Building2, Package, Users, FileText, ClipboardList, List } from "lucide-react";
```

Add entry to `ADMIN_LINKS` after the tenants entry:
```tsx
const ADMIN_LINKS = [
  { href: "/admin/tenants",   label: "ניהול ארגונים",         icon: Building2 },
  { href: "/admin/lookups",   label: "ניהול רשימות ארגוניות", icon: List },      // ← ADD THIS
  { href: "/admin/modules",   label: "מודולים ומחירון",        icon: Package },
  { href: "/admin/users",     label: "משתמשי מערכת",          icon: Users },
  { href: "/admin/templates", label: "תבניות הקמה",            icon: FileText },
  { href: "/admin/audit",     label: "Audit Log",              icon: ClipboardList },
];
```

**Step 2: Commit**

```bash
git add frontend/components/layout/AdminMenu.tsx
git commit -m "feat: add lookup lists menu item to AdminMenu"
```

---

## Summary checklist

After all tasks are complete, verify end-to-end:
1. Open `/admin/lookups` → see 3 system lists (סוגי ישויות, סוגי קשרים, חבילות)
2. Click "ניהול רשימות ארגוניות" menu item → navigates to list
3. Click a list row → opens detail page with CardPage layout
4. See items in child grid
5. Double-click a system item → modal opens with read-only key, editable label
6. Click "הוסף" → modal opens for new item, key + label required
7. Save new item → grid refreshes with new row
8. Click "חדש" on parent page → new list form → save → redirects to detail
