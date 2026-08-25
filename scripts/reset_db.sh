#!/usr/bin/env bash
# =============================================================================
#  GBLRecover — Reset complet de la base de données locale (port 5433).
#
#  Remet la base dans un état IDENTIQUE aux données réelles du fichier Excel
#  « database/GBL - Juillet 2026.xlsx » :
#    1. DROP SCHEMA public CASCADE  (supprime TOUTES les tables/vues)
#    2. Re-création du schéma officiel (schema.sql) + vues (views.sql)
#    3. Chargement des données réelles (load_fast.py)
#    4. Rôles + comptes de démo (agent@camtel.cm / demo1234)
#
#  Usage : ./scripts/reset_db.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$ROOT/backend"

PGBIN="${PGBIN:-/usr/lib/postgresql/14/bin}"
PGPORT="${PGPORT:-5433}"
DB="${DB:-gblrecover}"

_log() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }

_log "Arrêt du backend (le temps du reset)…"
systemctl --user stop gblrecover-backend.service 2>/dev/null || true

_log "1/5 Suppression du schéma public…"
"$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT" -U postgres -d "$DB" -c "DROP SCHEMA public CASCADE;" -c "CREATE SCHEMA public;" -c "GRANT ALL ON SCHEMA public TO postgres;" -c "GRANT ALL ON SCHEMA public TO public;"

_log "2/5 Application du schéma officiel…"
"$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT" -U postgres -d "$DB" -v ON_ERROR_STOP=1 -f "$ROOT/database/schema.sql" >/dev/null

_log "3/5 Application des vues…"
"$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT" -U postgres -d "$DB" -v ON_ERROR_STOP=1 -f "$ROOT/database/views.sql" >/dev/null

_log "4/5 Chargement des données réelles (GBL - Juillet 2026.xlsx)…"
(cd "$ROOT/database" && POSTGRES_PASSWORD=postgres POSTGRES_PORT="$PGPORT" POSTGRES_DB="$DB" python3 load_fast.py)

_log "5/5 Rôles et comptes de démo…"
(cd "$BACKEND_DIR" && DATABASE_URL="postgresql://postgres:postgres@localhost:${PGPORT}/${DB}" python3 -m scripts.seed_demo)

_log "Redémarrage du backend…"
systemctl --user start gblrecover-backend.service 2>/dev/null || true

_log "✅ Base réinitialisée avec les données réelles !"