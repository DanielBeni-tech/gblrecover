# GBLRecover

Plateforme de Revenue Assurance de **CAMTEL** : centralise, fiabilise et rend actionnables les données de facturation, de paiement et de créances.

> Promesse produit : « Voir juste. Comprendre vite. Agir avec confiance. »

## Identifiants et accès de démonstration

### Compte de connexion (frontend / démo) — utilisable dès la page de login

| Champ | Valeur |
|---|---|
| **Identifiant / e-mail** | `agent@camtel.cm` |
| **Mot de passe** | `demo1234` |
| Utilisateur | Diane Mbarga |
| Mode | Démonstration (MVP) |

> **Source** : `frontend/src/api/client.ts` (`login`) et `frontend/src/data/mock-data.ts` (`demoCredentials`).
> Ce compte est reconnu en mode démo (`VITE_DEMO_MODE=true`, défaut). En mode intégration (`VITE_DEMO_MODE=false`), l'authentification passe par le backend FastAPI (`POST /api/v1/auth/login`) et nécessite un utilisateur présent en base.

### ⚠️ Incohérence connue

- `frontend/src/data/demo-data.ts` expose `demoPassword = "camtel2026"`. Ce mot de passe **n'est pas** celui validé à la connexion (le mot de passe effectif est `demo1234`). Il s'agit d'une valeur résiduelle à harmoniser.

### Backend / Base de données

| Ressource | Valeur |
|---|---|
| `DATABASE_URL` (défaut) | `postgresql://postgres:postgres@localhost:5433/gblrecover` |
| Docker (TRD §14) | `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` = `gblrecover` |

## Stack

- **Frontend** : React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, React Hook Form + Zod.
- **Backend** : FastAPI, Python 3.12, SQLAlchemy 2.0 (async), Alembic, Pydantic v2, PostgreSQL 16.

## Documentation

- `PRODUCT.md` — vision produit (GBLContext, PRD, TRD).
- `backend/README.md` — guide du backend et état des endpoints API.
- `docs/` — référentiels produit & technique complets.
