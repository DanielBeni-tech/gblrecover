"""Point d'entrée CLI pour (re)seed la couche d'authentification.

Usage (depuis ``backend/``) :
    python -m scripts.seed_demo

Idempotent : les tables ``users`` / ``roles`` / ``user_roles`` /
``permissions`` / ``role_permissions`` sont créées si absentes, les rôles
AGENT/ADMIN et les utilisateurs de démo sont créés ou réinitialisés.
"""

from __future__ import annotations

import asyncio
import sys

from app.db.bootstrap import bootstrap_db
from app.db.session import engine


async def main() -> int:
    print("▶  Bootstrap de l'authentification GBLRecover…")
    try:
        credentials = await bootstrap_db(engine)
    except Exception as exc:  # pragma: no cover - dépend de l'état de la DB
        print(f"❌  Échec du bootstrap : {exc}", file=sys.stderr)
        return 1
    print("✔  Tables d'auth présentes, rôles et comptes de démo seedés.")
    print("Comptes disponibles :")
    for cred in credentials:
        print(f"   - {cred}")
    print("Astuce : ces comptes sont aussi (re)créés automatiquement au démarrage du backend.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))