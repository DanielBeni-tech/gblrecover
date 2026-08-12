"""initial schema

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-08-12 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
import os

# revision identifiers, used by Alembic.
revision = '0001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    """Apply the SQL in database/schema.sql"""
    # Try to find the project root by walking upwards and locate database/schema.sql
    def find_schema(start_dir, max_up=5):
        cur = os.path.abspath(start_dir)
        for _ in range(max_up + 1):
            candidate = os.path.join(cur, 'database', 'schema.sql')
            if os.path.exists(candidate):
                return candidate
            cur = os.path.abspath(os.path.join(cur, '..'))
        return None

    sql_path = find_schema(os.path.dirname(__file__), max_up=6)
    if not sql_path:
        searched = ' (searched upwards from ' + os.path.dirname(__file__) + ' )'
        raise RuntimeError(f"schema.sql not found{searched}")

    with open(sql_path, 'r', encoding='utf-8') as f:
        sql = f.read()

    conn = op.get_bind()
    # naive split on semicolon; complex SQL may require manual adjustments
    statements = [s.strip() for s in sql.split(';') if s.strip()]
    for stmt in statements:
        conn.execute(sa.text(stmt))


def downgrade():
    # Downgrade is a no-op for initial baseline. Manual rollback required.
    pass
