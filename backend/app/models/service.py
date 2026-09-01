"""Modèle SQLAlchemy pour la table SERVICE.

La table existe en DB (cf. database/schema.sql) avec un seed de référence
(LS, Vobb, FTTx, TV, ADSL, Mobile, Autres). Le modèle est ajouté pour
permettre son interrogation via SQLAlchemy.
"""
from sqlalchemy import Column, String

from app.db.base import Base


class Service(Base):
    """Service souscrit par un compte (LS, Vobb, FTTx, etc.)."""

    __tablename__ = "service"

    type_service = Column("type_service", String(128), primary_key=True)
    libelle_service = Column("libelle_service", String(128), nullable=True)
