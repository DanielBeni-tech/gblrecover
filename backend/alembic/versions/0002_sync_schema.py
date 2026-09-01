"""sync schema

Revision ID: 0002_sync_schema
Revises: 0001_initial_schema
Create Date: 2026-08-12 07:30:00.000000
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "0002_sync_schema"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade():
    # user_roles may already exist without these columns (bootstrap DDL or
    # CREATE TABLE IF NOT EXISTS skipped a later, richer definition).
    op.execute(
        "ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS centre_id varchar(128)"
    )
    op.execute(
        "ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS agency_id varchar(128)"
    )
    op.execute(
        "ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()"
    )
    op.execute("ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS created_by uuid")

    # Older installs stored centre_id as uuid; convert only in that case.
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'user_roles'
                  AND column_name = 'centre_id'
                  AND udt_name = 'uuid'
            ) THEN
                ALTER TABLE user_roles
                ALTER COLUMN centre_id TYPE varchar(128) USING centre_id::varchar;
            END IF;
        END $$;
        """
    )

    op.execute(
        "ALTER TABLE facture ADD COLUMN IF NOT EXISTS type_flux varchar(50) DEFAULT 'FACTURE'"
    )
    op.execute(
        "ALTER TABLE facture ADD COLUMN IF NOT EXISTS libelle_periode varchar(128)"
    )


def downgrade():
    op.execute("ALTER TABLE facture DROP COLUMN IF EXISTS libelle_periode")
    op.execute("ALTER TABLE facture DROP COLUMN IF EXISTS type_flux")
