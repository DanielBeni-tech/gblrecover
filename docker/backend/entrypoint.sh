#!/bin/sh
set -e
python -m alembic upgrade head

XLSX="/app/database/GBL - Juillet 2026.xlsx"
if [ -f "$XLSX" ]; then
  echo "▶ Vérification du portefeuille…"
  LOAD_IF_EMPTY=1 python /app/database/load_fast.py
else
  echo "⚠ Excel absent ($XLSX) — le portefeuille ne sera pas chargé."
fi

exec "$@"
