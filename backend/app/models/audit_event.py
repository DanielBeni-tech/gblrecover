from uuid import uuid4
from sqlalchemy import Column, String, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, INET
from app.db.base import Base
from app.models.common import TimestampMixin


class AuditEvent(TimestampMixin, Base):
    __tablename__ = "audit_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column("user_id", UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action = Column("action", String(100), nullable=False)
    entity_type = Column("entity_type", String(50), nullable=False)
    entity_id = Column("entity_id", String(128), nullable=False)
    old_values = Column("old_values", JSON, nullable=True)
    new_values = Column("new_values", JSON, nullable=True)
    ip_address = Column("ip_address", INET, nullable=True)
    user_agent = Column("user_agent", String, nullable=True)
    request_id = Column("request_id", String(36), nullable=True)
