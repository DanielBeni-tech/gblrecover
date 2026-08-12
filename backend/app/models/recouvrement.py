"""Modèles SQLAlchemy pour le recouvrement : actions de recouvrement et promesses de paiement.

Ces tables existent en DB (cf. database/schema.sql) mais n'étaient pas mappées
auparavant dans l'ORM. Les modèles sont ajoutés pour permettre l'interrogation
et la manipulation via SQLAlchemy sans SQL brut.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from app.db.base import Base
from app.models.common import TimestampMixin


class CollectionAction(TimestampMixin, Base):
    """Action de recouvrement planifiée ou en cours (PHONE_CALL, EMAIL, VISIT, etc.)."""

    __tablename__ = "collection_actions"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    account_id = Column("account_id", Numeric, ForeignKey("compte.num_compte"), nullable=False)
    created_by = Column("created_by", PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    assigned_to = Column("assigned_to", PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action_type = Column("action_type", String(50), nullable=False)
    status = Column("status", String(50), nullable=False, default="PLANNED")
    due_date = Column("due_date", Date, nullable=False)
    completed_at = Column("completed_at", DateTime(timezone=True), nullable=True)
    comment = Column("comment", Text, nullable=True)
    result = Column("result", String(255), nullable=True)
    priority = Column("priority", String(20), nullable=True, default="NORMAL")


class Promise(TimestampMixin, Base):
    """Promesse de paiement émise par un client suite à une action de recouvrement."""

    __tablename__ = "promises"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    collection_action_id = Column(
        "collection_action_id",
        PG_UUID(as_uuid=True),
        ForeignKey("collection_actions.id"),
        nullable=False,
    )
    account_id = Column("account_id", Numeric, ForeignKey("compte.num_compte"), nullable=False)
    promised_amount = Column("promised_amount", Numeric(14, 2), nullable=False)
    promised_date = Column("promised_date", Date, nullable=False)
    status = Column("status", String(50), nullable=False, default="PENDING")
    notes = Column("notes", Text, nullable=True)
