import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SavedReportView(Base):
    __tablename__ = "saved_report_views"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default="gen_random_uuid()"
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    dataset: Mapped[str] = mapped_column(String(80), nullable=False)
    definition_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False, default="report", server_default="report")
    visibility: Mapped[str] = mapped_column(String(16), nullable=False, default="personal", server_default="personal")
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admin_users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
