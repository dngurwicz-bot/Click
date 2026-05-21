import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, Integer, DateTime, ForeignKey, Index, UniqueConstraint, func
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
        Index("uq_lookup_items_list_code", "list_id", "code", unique=True, postgresql_where="code IS NOT NULL"),
    )

    id:         Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    list_id:    Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("lookup_lists.id"), nullable=False)
    item_key:   Mapped[str]        = mapped_column(String, nullable=False)
    label_he:   Mapped[str]        = mapped_column(String, nullable=False)
    code:       Mapped[str | None] = mapped_column(String(20), nullable=True)
    sort_order: Mapped[int]        = mapped_column(Integer, nullable=False, default=0)
    is_system:  Mapped[bool]       = mapped_column(Boolean, nullable=False, default=False)
    is_active:  Mapped[bool]       = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime]   = mapped_column(DateTime(timezone=True), server_default=func.now())
