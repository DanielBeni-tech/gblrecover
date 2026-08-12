from uuid import uuid4
from sqlalchemy import Column, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.models.common import TimestampMixin


class Permission(TimestampMixin, Base):
    __tablename__ = "permissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    code = Column(String(100), nullable=False, unique=True)
    name = Column(String(100), nullable=False)
    description = Column(String, nullable=True)
    resource = Column(String(50), nullable=False)
    action = Column(String(50), nullable=False)

    roles = relationship("Role", secondary="role_permissions", back_populates="permissions")
