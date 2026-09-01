#!/usr/bin/env bash
# =============================================================================
#  GBLRecover — Démarrage tout-en-un de l'environnement local.
#
#  Actions :
#    1. Démarre PostgreSQL (cluster local ~/.gblrecover, port 5433) si besoin.
#    2. Garantit le schéma officiel (schema.sql) + les vues (views.sql).
#    3. Sème rôles + comptes de démo (agent/admin).
#    4. Démarre le backend FastAPI sur http://localhost:8000.
#    5. (Optionnel) Démarre le frontend Vite sur http://localhost:5173.
#
#  Usage :
#    ./scripts/start_local.sh            # db + backend (+ frontend si présent)
#    ./scripts/start_local.sh --backend  # seulement db + backend
#    ./scripts/start_local.sh --all      # db + backend + frontend
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"

PGBIN="${PGBIN:-/usr/lib/postgresql/14/bin}"
PGDATA="${PGDATA:-$HOME/.gblrecover/pgdata}"
PGSOCK="${PGSOCK:-$HOME/.gblrecover/socket}"
PGPORT="${PGPORT:-5433}"
PGLOG="${PGLOG:-$HOME/.gblrecover/pg.log}"
DB="${DB:-gblrecover}"
DBURL="postgresql://postgres:postgres@localhost:${PGPORT}/${DB}"

MODE="${1:-backend}"

_log() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }

# ----------------------------------------------------------------------------
# 1. PostgreSQL
# ----------------------------------------------------------------------------
ensure_db() {
    mkdir -p "$PGSOCK"
    if ! "$PGBIN/pg_isready" -h 127.0.0.1 -p "$PGPORT" -q; then
        _log "Démarrage de PostgreSQL (port $PGPORT)…"
        "$PGBIN/pg_ctl" -D "$PGDATA" \
            -o "-p $PGPORT -k $PGSOCK -c listen_addresses=127.0.0.1" \
            -l "$PGLOG" start
        sleep 3
    else
        _log "PostgreSQL déjà actif sur le port $PGPORT."
    fi

    _log "Application du schéma officiel ($DB)…"
    "$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT" -U postgres -d "$DB" \
        -v ON_ERROR_STOP=1 -f "$ROOT/database/schema.sql" >/dev/null
    "$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT" -U postgres -d "$DB" \
        -v ON_ERROR_STOP=1 -f "$ROOT/database/views.sql" >/dev/null

    _log "Rôles et comptes de démo…"
    (cd "$BACKEND_DIR" && DATABASE_URL="$DBURL" python3 -m scripts.seed_demo)
}

# ----------------------------------------------------------------------------
# 2. Backend FastAPI
# ----------------------------------------------------------------------------
ensure_backend() {
    if ss -ltn 2>/dev/null | grep -q ':8000'; then
        _log "Backend déjà actif sur http://localhost:8000."
    else
        if [ ! -f "$BACKEND_DIR/.env" ]; then
            _log "Création de backend/.env"
            cat > "$BACKEND_DIR/.env" <<EOF
DATABASE_URL=$DBURL
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173
EOF
        fi
        _log "Démarrage du backend FastAPI sur http://localhost:8000…"
        (cd "$BACKEND_DIR" && nohup "$(command -v python3)" -m uvicorn app.main:app \
            --host 0.0.0.0 --port 8000 > "$HOME/.gblrecover/backend.log" 2>&1 & echo $! > "$HOME/.gblrecover/backend.pid")
        sleep 4
    fi
}

# ----------------------------------------------------------------------------
# 3. Frontend Vite
# ----------------------------------------------------------------------------
ensure_frontend() {
    if ss -ltn 2>/dev/null | grep -q ':5173'; then
        _log "Frontend déjà actif sur http://localhost:5173."
    else
        _log "Démarrage du frontend Vite sur http://localhost:5173…"
        (cd "$FRONTEND_DIR" && nohup npm run dev -- --port 5173 > "$HOME/.gblrecover/frontend.log" 2>&1 & echo $! > "$HOME/.gblrecover/frontend.pid")
        sleep 4
    fi
}

# ----------------------------------------------------------------------------
ensure_db
ensure_backend
if [ "$MODE" = "--all" ]; then ensure_frontend; fi

_log "✅ Environnement GBLRecover prêt !"
echo
printf '  %-22s %s\n' "Frontend :" "http://localhost:5173"
printf '  %-22s %s\n' "Backend :" "http://localhost:8000"
printf '  %-22s %s\n' "API status :" "http://localhost:8000/status"
echo
printf '  %-22s %s\n' "Agent :" "agent@camtel.cm / demo1234"
printf '  %-22s %s\n' "Admin :" "admin@camtel.cm / admin1234"
echo