"""Bootstrap automatique de la couche d'authentification GBLRecover.

Problème corrigé : les tables SQLAlchemy ``users``, ``roles``,
``user_roles``, ``permissions`` et ``role_permissions`` n'étaient créées
nulle part (ni dans ``database/schema.sql``, ni dans les migrations Alembic),
alors que les scripts de seed ``database/load_*.py`` s'y appuient. Résultat :
aucun utilisateur ne pouvait être connecté tant que ces tables n'existaient
pas manuellement.

Ce module garantit de manière *idempotente* que :
  1. les 5 tables d'authentification existent ;
  2. les rôles ``AGENT`` et ``ADMIN`` existent ;
  3. les utilisateurs de démonstration existent avec un mot de passe
     reconnu par le backend (même algorithme bcrypt/72 octets que ``crud``).

Il est conçu pour être appelé au démarrage de l'application (lifespan) ou
en ligne de commande via ``backend/scripts/seed_demo.py``.
"""

from __future__ import annotations

from logging import getLogger
from uuid import UUID, uuid4

from sqlalchemy import text

logger = getLogger("gblrecover.bootstrap")

# ---------------------------------------------------------------------------
# DDL des tables d'authentification (aligné sur les modèles SQLAlchemy)
# ---------------------------------------------------------------------------

AUTH_DDL: tuple[str, ...] = (
    """
    CREATE TABLE IF NOT EXISTS users (
        id                  UUID PRIMARY KEY,
        email               VARCHAR(255) NOT NULL UNIQUE,
        password_hash       VARCHAR(255) NOT NULL,
        full_name           VARCHAR(255) NOT NULL,
        phone               VARCHAR(30),
        status              VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
        created_by          UUID REFERENCES users(id),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS roles (
        id          UUID PRIMARY KEY,
        code        VARCHAR(50) NOT NULL UNIQUE,
        name        VARCHAR(100) NOT NULL,
        description TEXT,
        status      VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS user_roles (
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, role_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS permissions (
        id          UUID PRIMARY KEY,
        code        VARCHAR(100) NOT NULL UNIQUE,
        name        VARCHAR(100) NOT NULL,
        description TEXT,
        resource    VARCHAR(50) NOT NULL,
        action      VARCHAR(50) NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS role_permissions (
        role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
    )
    """,
)

# ---------------------------------------------------------------------------
# Configuration des comptes de démonstration
# ---------------------------------------------------------------------------

#: Rôles garantis présents en base.
ROLE_CODES: tuple[tuple[str, str, str], ...] = (
    ("AGENT", "Agent", "Agent de recouvrement — accès métier standard"),
    ("ADMIN", "Administrateur", "Administration du système et RBAC"),
)

#: Comptes de démonstration : (email, mot de passe, nom complet, code rôle).
DEMO_USERS: tuple[tuple[str, str, str, str], ...] = (
    ("agent@camtel.cm", "demo1234", "Diane Mbarga", "AGENT"),
    ("admin@camtel.cm", "admin1234", "Administrateur GBLRecover", "ADMIN"),
)


def _as_uuid(value: UUID | str | None) -> UUID | None:
    if value is None:
        return None
    return value if isinstance(value, UUID) else UUID(str(value))


async def _apply_ddl(conn) -> None:
    for stmt in AUTH_DDL:
        await conn.execute(text(stmt))


async def _ensure_roles(conn) -> None:
    for code, name, description in ROLE_CODES:
        row = (await conn.execute(text("SELECT id FROM roles WHERE code = :c"), {"c": code})).first()
        if row:
            continue
        await conn.execute(
            text(
                "INSERT INTO roles (id, code, name, description, status, created_at, updated_at) "
                "VALUES (:id, :code, :name, :desc, 'ACTIVE', now(), now())"
            ),
            {"id": str(uuid4()), "code": code, "name": name, "desc": description},
        )


async def _role_id(conn, code: str) -> UUID:
    row = (await conn.execute(text("SELECT id FROM roles WHERE code = :c"), {"c": code})).first()
    if not row:
        raise RuntimeError(f"Rôle '{code}' introuvable après le seed.")
    return _as_uuid(row[0])


async def _ensure_users(conn) -> list[str]:
    """Crée / réinitialise les comptes de démo. Retourne les identifiants actifs."""
    from app.api.v1.crud import get_password_hash

    credentials: list[str] = []
    for email, password, full_name, role_code in DEMO_USERS:
        role_id = await _role_id(conn, role_code)
        row = (await conn.execute(text("SELECT id FROM users WHERE email = :e"), {"e": email})).first()
        if row:
            user_id = _as_uuid(row[0])
            await conn.execute(
                text(
                    "UPDATE users SET password_hash = :pw, full_name = :fn, status = 'ACTIVE', "
                    "must_change_password = FALSE, updated_at = now() WHERE id = :uid"
                ),
                {"pw": get_password_hash(password), "fn": full_name, "uid": user_id},
            )
        else:
            user_id = uuid4()
            await conn.execute(
                text(
                    "INSERT INTO users (id, email, password_hash, full_name, status, "
                    "must_change_password, created_at, updated_at) "
                    "VALUES (:id, :email, :pw, :fn, 'ACTIVE', FALSE, now(), now())"
                ),
                {"id": str(user_id), "email": email, "pw": get_password_hash(password), "fn": full_name},
            )
        # Lien utilisateur -> rôle (idempotent).
        await conn.execute(
            text(
                "INSERT INTO user_roles (user_id, role_id) VALUES (:u, :r) "
                "ON CONFLICT (user_id, role_id) DO NOTHING"
            ),
            {"u": user_id, "r": role_id},
        )
        credentials.append(f"{email} / {password}")
    return credentials


async def bootstrap_db(engine) -> list[str]:
    """Crée les tables d'auth et sème rôles + comptes de démo.

    Idempotent : peut être appelé à chaque démarrage sans effet de bord.
    Retourne la liste des identifiants de démonstration actifs.
    """
    async with engine.begin() as conn:
        await _apply_ddl(conn)
        await _ensure_roles(conn)
        credentials = await _ensure_users(conn)
    return credentials