"""add views

Revision ID: 0003_add_views
Revises: 0002_sync_schema
Create Date: 2026-08-28 07:00:00.000000
"""
import os
from alembic import op
import sqlalchemy as sa

revision = "0003_add_views"
down_revision = "0002_sync_schema"
branch_labels = None
depends_on = None


def _find_views_sql() -> str | None:
    explicit = [
        "/app/database/views.sql",
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "database", "views.sql")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "database", "views.sql")),
    ]
    for path in explicit:
        if os.path.isfile(path):
            return path

    cur = os.path.abspath(os.path.dirname(__file__))
    for _ in range(8):
        candidate = os.path.join(cur, "database", "views.sql")
        if os.path.isfile(candidate):
            return candidate
        parent = os.path.abspath(os.path.join(cur, ".."))
        if parent == cur:
            break
        cur = parent
    return None


def upgrade():
    vpath = _find_views_sql()
    if vpath:
        with open(vpath, encoding="utf-8") as f:
            sql = f.read()
        conn = op.get_bind()
        conn.execute(sa.text(sql))


def downgrade():
    pass
