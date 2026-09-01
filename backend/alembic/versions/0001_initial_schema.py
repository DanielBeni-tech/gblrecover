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


def _find_sql_file(filename: str) -> str | None:
    env_path = os.environ.get("SCHEMA_SQL_PATH") if filename == "schema.sql" else None
    if env_path and os.path.isfile(env_path):
        return env_path

    explicit = [
        f"/app/database/{filename}",
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "database", filename)),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "database", filename)),
    ]
    for path in explicit:
        if os.path.isfile(path):
            return path

    cur = os.path.abspath(os.path.dirname(__file__))
    for _ in range(8):
        candidate = os.path.join(cur, "database", filename)
        if os.path.isfile(candidate):
            return candidate
        parent = os.path.abspath(os.path.join(cur, ".."))
        if parent == cur:
            break
        cur = parent
    return None


def _execute_sql_file(path: str) -> None:
    with open(path, encoding="utf-8") as f:
        sql = f.read()
    conn = op.get_bind()
    statements = [s.strip() for s in sql.split(";") if s.strip()]
    for stmt in statements:
        conn.execute(sa.text(stmt))


def upgrade():
    """Apply the SQL in database/schema.sql."""
    sql_path = _find_sql_file("schema.sql")
    if not sql_path:
        raise RuntimeError(
            "schema.sql not found (searched /app/database and upwards from "
            f"{os.path.dirname(__file__)})"
        )

    conn = op.get_bind()
    conn.execute(sa.text('CREATE EXTENSION IF NOT EXISTS "pgcrypto"'))
    _execute_sql_file(sql_path)


def downgrade():
    # Downgrade is a no-op for initial baseline. Manual rollback required.
    pass
