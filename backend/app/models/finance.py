from sqlalchemy import Column, String, BigInteger, Float, Date, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class Centre(Base):
    __tablename__ = "centre"

    nom_centre = Column("nom_centre", String(128), primary_key=True)
    agences = relationship("Agence", back_populates="centre", cascade="all, delete-orphan")


class Agence(Base):
    __tablename__ = "agence"

    id_agence = Column("id_agence", String(128), primary_key=True)
    nom_centre = Column("nom_centre", String(128), ForeignKey("centre.nom_centre"), nullable=False)
    nom_agence = Column("nom_agence", String(128), nullable=True)

    centre = relationship("Centre", back_populates="agences")
    comptes = relationship("Compte", back_populates="agence")


class Gestionnaire(Base):
    __tablename__ = "gestionnaire"

    mat_gestionnaire = Column("mat_gestionnaire", String(128), primary_key=True)
    nom_gestionnaire = Column("nom_gestionnaire", String(128), nullable=False)
    tel_gestionnaire = Column("tel_gestionnaire", String(30), nullable=True)
    email_gestionnaire = Column("email_gestionnaire", String(128), nullable=True)

    comptes = relationship("Compte", back_populates="gestionnaire")


class Client(Base):
    __tablename__ = "client"

    code_client = Column("code_client", BigInteger, primary_key=True)
    raison_sociale = Column("raison_sociale", String(128), nullable=False)
    marche = Column("marche", String(50), nullable=True)
    email = Column("email", String(128), nullable=True)
    tel = Column("tel", String(30), nullable=True)

    comptes = relationship("Compte", back_populates="client")


class Compte(Base):
    __tablename__ = "compte"

    num_compte = Column("num_compte", BigInteger, primary_key=True)
    mat_gestionnaire = Column("mat_gestionnaire", String(128), ForeignKey("gestionnaire.mat_gestionnaire"), nullable=True)
    id_agence = Column("id_agence", String(128), ForeignKey("agence.id_agence"), nullable=False)
    code_client = Column("code_client", BigInteger, ForeignKey("client.code_client"), nullable=False)
    e_bill = Column("e_bill", String(50), nullable=True)
    statut_facturation = Column("statut_facturation", String(50), nullable=True)
    identification = Column("identification", String(128), nullable=True)
    balance = Column("balance", Float, nullable=False)

    client = relationship("Client", back_populates="comptes")
    agence = relationship("Agence", back_populates="comptes")
    gestionnaire = relationship("Gestionnaire", back_populates="comptes")
    factures = relationship("Facture", back_populates="compte")


class Facture(Base):
    __tablename__ = "facture"

    id_facture = Column("id_facture", String(128), primary_key=True)
    num_compte = Column("num_compte", BigInteger, ForeignKey("compte.num_compte"), nullable=False)
    date_emission = Column("date_emission", Date, nullable=False)
    montant_facture = Column("montant_facture", Numeric(14, 2), nullable=True)
    paid_amount = Column("paid_amount", Numeric(14, 2), nullable=False, default=0)
    outstanding_amount = Column("outstanding_amount", Numeric(14, 2), nullable=False, default=0)
    type_flux = Column("type_flux", String(50), nullable=False, default='FACTURE')
    libelle_periode = Column("libelle_periode", String(128), nullable=True)
    status = Column("status", String(50), nullable=False, default="OPEN")

    compte = relationship("Compte", back_populates="factures")
    paiements = relationship("Paiement", back_populates="facture")


class Paiement(Base):
    __tablename__ = "paiement"

    id_paiement = Column("id_paiement", String(128), primary_key=True)
    id_facture = Column("id_facture", String(128), ForeignKey("facture.id_facture"), nullable=False)
    date_paiement = Column("date_paiement", Date, nullable=True)
    montant_paye = Column("montant_paye", Float, nullable=True)

    facture = relationship("Facture", back_populates="paiements")
