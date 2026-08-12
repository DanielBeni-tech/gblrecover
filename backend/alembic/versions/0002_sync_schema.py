"""sync schema

Revision ID: 0002_sync_schema
Revises: 0001_initial_schema
Create Date: 2026-08-12 07:30:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0002_sync_schema'
down_revision = '0001_initial_schema'
branch_labels = None
depends_on = None


def upgrade():
    # Ensure user_roles.centre_id is varchar(128)
    op.execute("""
    ALTER TABLE user_roles
    ALTER COLUMN centre_id TYPE varchar(128) USING centre_id::varchar;
    """)

    # Add missing columns to facture
    op.execute("""
    ALTER TABLE facture
    ADD COLUMN IF NOT EXISTS type_flux varchar(50) DEFAULT 'FACTURE';
    """)
    op.execute("""
    ALTER TABLE facture
    ADD COLUMN IF NOT EXISTS libelle_periode varchar(128);
    """)


def downgrade():
    # Downgrade: remove added columns and attempt to cast centre_id back to UUID
    op.execute("""
    ALTER TABLE facture DROP COLUMN IF EXISTS libelle_periode;
    """)
    op.execute("""
    ALTER TABLE facture DROP COLUMN IF EXISTS type_flux;
    """)
    # Attempt to cast centre_id back to UUID; may fail if values are not valid UUIDs
    op.execute("""
    ALTER TABLE user_roles
    ALTER COLUMN centre_id TYPE uuid USING centre_id::uuid;
    """)
