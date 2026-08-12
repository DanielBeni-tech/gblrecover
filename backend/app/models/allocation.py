"""Modèle SQLAlchemy pour les imputations paiement → facture.

La notion d'allocation n'a pas de table dédiée dans schema.sql mais elle est
référencée par la spec API (POST /payments/{id}/allocations, DELETE /allocations/{id}).
Ce modèle définit une table `allocations` qu'une migration Alembic ultérieure
devra créer. En attendant, les routes lèvent NotImplementedError.
"""
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from app.db.base import Base
from app.models.common import TimestampMixin


class Allocation(TimestampMixin, Base):
    """Imputation d'un paiement sur une facture."""

    __tablename__ = "allocations"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    payment_id = Column("payment_id", String(128), ForeignKey("paiement.id_paiement"), nullable=False)
    invoice_id = Column("invoice_id", String(128), ForeignKey("facture.id_facture"), nullable=False)
    allocated_amount = Column("allocated_amount", Numeric(14, 2), nullable=False)
    status = Column("status", String(50), nullable=False, default="ACTIVE")  # ACTIVE | REVERSED
