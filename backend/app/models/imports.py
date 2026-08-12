"""Modèles SQLAlchemy pour l'import de fichiers Excel.

Tables existantes en DB (cf. database/schema.sql), mappées ici pour exposer
les imports via l'API sans SQL brut.
"""
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from app.db.base import Base
from app.models.common import TimestampMixin


class ImportBatch(TimestampMixin, Base):
    """Batch d'import Excel — un fichier déposé, un batch."""

    __tablename__ = "import_batches"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    filename = Column("filename", String(255), nullable=False)
    file_checksum = Column("file_checksum", String(64), nullable=False)
    entity_type = Column("entity_type", String(50), nullable=False)
    status = Column("status", String(50), nullable=False, default="PENDING")
    total_rows = Column("total_rows", Integer, nullable=True)
    processed_rows = Column("processed_rows", Integer, nullable=False, default=0)
    accepted_rows = Column("accepted_rows", Integer, nullable=False, default=0)
    rejected_rows = Column("rejected_rows", Integer, nullable=False, default=0)
    started_at = Column("started_at", DateTime(timezone=True), nullable=True)
    completed_at = Column("completed_at", DateTime(timezone=True), nullable=True)
    created_by = Column("created_by", PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)


class ImportError(Base):
    """Erreur sur une ligne d'un import — sert à afficher le rapport d'erreurs."""

    __tablename__ = "import_errors"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    batch_id = Column("batch_id", PG_UUID(as_uuid=True), ForeignKey("import_batches.id"), nullable=False)
    row_number = Column("row_number", Integer, nullable=False)
    column_name = Column("column_name", String(50), nullable=True)
    raw_value = Column("raw_value", Text, nullable=True)
    error_message = Column("error_message", Text, nullable=False)
    created_at = Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False)
