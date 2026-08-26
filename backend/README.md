# GBLRecover Backend

API REST pour le produit **GBLRecover** (CAMTEL, Revenue Assurance).
Stack : **FastAPI** + **SQLAlchemy 2 async** + **PostgreSQL** (asyncpg).

> **Statut actuel (août 2026)** : 101/101 endpoints applicatifs déclarés. Les sections 3.2 → 3.4 (Auth, Organisation, Clients) sont pleinement opérationnelles. Les sections 3.5 → 3.12 (Comptes, Factures, Paiements, Recouvrement, Imports, Reporting, Admin, Services) sont livrées en **squelette** : la signature, les schémas Pydantic et le contrat HTTP sont en place, mais la logique métier reste à implémenter (stubs `NotImplementedError` côté `crud.py`, code HTTP `501 Not Implemented` côté routeurs).
>
> Voir [`API_specification_and_db_coherence_v2.md`](./API_specification_and_db_coherence_v2.md) pour le contrat API complet.

---

## Table des matières

1. [Pré-requis](#1-pré-requis)
2. [Installation](#2-installation)
3. [Configuration](#3-configuration)
4. [Base de données](#4-base-de-données)
5. [Démarrer l'API](#5-démarrer-lapi)
6. [Tests](#6-tests)
7. [Architecture](#7-architecture)
8. [Modules de l'API](#8-modules-de-lapi)
9. [Travail restant](#9-travail-restant)
10. [Notes opérationnelles](#10-notes-opérationnelles)

---

## 1. Pré-requis

- Python **3.10+**
- PostgreSQL **14+** (les vues SQL référencent des CTE et `gen_random_uuid()` de `pgcrypto`)
- Accès au répertoire `database/` pour le schéma SQL et les vues

---

## 2. Installation

```bash
# 1. Créer et activer le venv
python3 -m venv backend/.venv
source backend/.venv/bin/activate    # Linux/macOS
# backend\.venv\Scripts\Activate.ps1  # Windows PowerShell

# 2. Installer les dépendances
pip install --upgrade pip setuptools wheel
pip install -r backend/requirements.txt

# 3. Dépendances ajoutées après le scaffold initial
pip install python-multipart   # requis pour POST /imports (UploadFile)
pip install pytest httpx       # pour exécuter les tests smoke
```

Le `requirements.txt` liste les dépendances applicatives de base. Les dépendances
ajoutées par la suite sont documentées ici pour traçabilité.

---

## 3. Configuration

Toute la configuration passe par des variables d'environnement (chargées via
`python-dotenv` dans `app/core/config.py`).

| Variable | Défaut | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5433/gblrecover` | URL PostgreSQL. Le moteur asyncpg est sélectionné automatiquement. |

Créer un fichier `backend/.env` (gitignored) à partir de cet exemple :

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5433/gblrecover
```

> **Variables à venir (non encore implémentées)** : `SECRET_KEY` (JWT), `CORS_ORIGINS`, `LOG_LEVEL`, `ENV` (dev/staging/prod).

---

## 4. Base de données

Le schéma est versionné dans `../database/schema.sql` et appliqué par Alembic
(`backend/alembic/versions/0001_initial_schema.py`).

```bash
# Appliquer toutes les migrations
cd backend
source .venv/bin/activate
alembic upgrade head
```

Les **vues SQL** (essentielles pour `/dashboards/*`, `/reports/*` et `/admin/*`)
se trouvent dans `../database/views.sql` (58 KB). Elles ne sont **pas** chargées
par Alembic : appliquer le fichier à la main après la migration initiale :

```bash
psql "$DATABASE_URL" -f ../database/views.sql
```

> Une migration Alembic dédiée pour les vues est planifiée (cf. §9 — Travail restant).

### Tables principales couvertes par les modèles ORM

| Table SQL | Modèle ORM | Statut |
|---|---|---|
| `users`, `roles`, `permissions`, `user_roles`, `role_permissions` | `app/models/user.py`, `role.py`, `permission.py`, `user_role.py`, `role_permission.py` | ✅ |
| `centre`, `agence`, `gestionnaire`, `client`, `compte` | `app/models/finance.py` | ✅ |
| `facture`, `paiement` | `app/models/finance.py` | ✅ |
| `audit_events` | `app/models/audit_event.py` | ✅ |
| `collection_actions`, `promises` | `app/models/recouvrement.py` | ✅ (nouveau) |
| `import_batches`, `import_errors` | `app/models/imports.py` | ✅ (nouveau) |
| `service` | `app/models/service.py` | ✅ (nouveau) |
| `allocations` | `app/models/allocation.py` | ✅ (nouveau — table à créer via migration) |

---

## 5. Démarrer l'API

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Documentation interactive : <http://localhost:8000/docs> (Swagger UI)
- Spécification OpenAPI : <http://localhost:8000/openapi.json>
- Healthchecks :
  - `GET /status` → `{"status": "ok", "version": "0.2.0"}`
  - `GET /health/db` → `{"db": "ok"}` (200) ou `{"db": "error", "detail": "..."}` (503)

---

## 6. Tests

Les tests smoke vérifient le démarrage de l'app, le contrat OpenAPI et l'absence
de régression sur le routage des paths statiques/dynamiques (`/users/me` vs
`/users/{user_id}`).

```bash
cd backend
source .venv/bin/activate
python -m pytest tests/ -v
```

Résultat attendu : **4 passed** (test_status, test_openapi_spec,
test_users_me_ordering, test_health_db).

> Les tests n'ouvrent pas de connexion DB pour la majorité d'entre eux.
> `test_health_db` tolère 503 si la DB est injoignable.

---

## 7. Architecture

```
backend/
├── alembic/                 # Migrations DB
│   └── versions/
│       ├── 0001_initial_schema.py    # Applique database/schema.sql
│       └── 0002_sync_schema.py       # Patches (type_flux, libelle_periode)
├── app/
│   ├── core/
│   │   └── config.py        # Settings (DATABASE_URL)
│   ├── db/
│   │   ├── base.py          # SQLAlchemy declarative_base
│   │   └── session.py       # AsyncSession + get_db()
│   ├── models/              # Modèles SQLAlchemy
│   │   ├── common.py        # TimestampMixin
│   │   ├── user.py, role.py, permission.py, user_role.py, role_permission.py
│   │   ├── finance.py       # Centre, Agence, Gestionnaire, Client, Compte, Facture, Paiement
│   │   ├── recouvrement.py  # CollectionAction, Promise        (NOUVEAU)
│   │   ├── imports.py       # ImportBatch, ImportError          (NOUVEAU)
│   │   ├── service.py       # Service                            (NOUVEAU)
│   │   ├── allocation.py    # Allocation                         (NOUVEAU)
│   │   └── audit_event.py
│   └── api/v1/              # Routeurs versionnés
│       ├── routes.py        # Wire-up + /users
│       ├── auth.py          # /auth/* (3.2)
│       ├── organization.py  # /centres, /agencies, /managers, /organizations/hierarchy (3.3)
│       ├── clients.py       # /clients/* (3.4)
│       ├── finance.py       # /accounts, /invoices, /payments, /allocations (3.5–3.7)
│       ├── recouvrement.py  # /collection-actions, /promises, /accounts/{id}/collection-actions (3.5+3.8)
│       ├── imports.py       # /imports/* (3.9)
│       ├── reports.py       # /dashboards/*, /reports/* (3.10)
│       ├── admin.py         # /admin/* (3.11)
│       ├── services.py      # /services/* (3.12)
│       ├── pagination.py    # PageMeta, Page[T]
│       ├── schemas.py       # Tous les schémas Pydantic
│       └── crud.py          # Toutes les opérations DB
├── tests/
│   └── test_smoke.py
├── API_specification_and_db_coherence_v2.md   # Contrat API
├── alembic.ini
└── requirements.txt
```

### Convention de code

- **Schémas Pydantic** : `*Base / *Create / *Update / *Read` avec `from_attributes = True` (équivalent `orm_mode`) sur tous les Read. Cf. `schemas.py`.
- **CRUD** : `async def f(db: AsyncSession, ...) -> Optional[T] | List[T]`. Filtres passés en kwargs optionnels. Pagination par `page / page_size` (offset = `(page - 1) * page_size`). Cf. `crud.py`.
- **Routes** : `APIRouter()`, `Depends(get_db)`, `Depends(get_current_user)` sur les mutations, `HTTPException(status.HTTP_404_NOT_FOUND, ...)` sur les ressources absentes.
- **Stubs** : les fonctions marquées `_todo(name)` dans `crud.py` lèvent `NotImplementedError` et les routeurs retournent `501 Not Implemented` tant que la logique métier n'est pas implémentée.

---

## 8. Modules de l'API

| Section | Module(s) | Endpoints | Statut logique métier |
|---|---|---:|---|
| 3.2 Auth & Users | `auth.py`, `routes.py` | 14 | ✅ Complet |
| 3.3 Organisation | `organization.py` | 13 | ✅ Complet |
| 3.4 Clients | `clients.py` | 9 | ✅ Complet |
| 3.5 Comptes | `finance.py`, `recouvrement.py` | 10 | 🟡 Squelette |
| 3.6 Factures | `finance.py` | 7 | 🟡 Squelette |
| 3.7 Paiements & Allocations | `finance.py` | 8 | 🟡 Squelette |
| 3.8 Recouvrement & Actions | `recouvrement.py` | 8 | 🟡 Squelette |
| 3.9 Import Excel | `imports.py` | 6 | 🟡 Squelette |
| 3.10 Reporting & Dashboards | `reports.py` | 14 | 🟡 Squelette |
| 3.11 Administration & Qualité | `admin.py` | 8 | 🟡 Squelette |
| 3.12 Utilitaires | `services.py`, `main.py` | 7 | 🟡 / ✅ Partiel |

### Routes principales accessibles dès maintenant

```bash
# Auth
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/change-password
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password

# Profil utilisateur
GET    /api/v1/users/me
PATCH  /api/v1/users/me

# Administration des utilisateurs (admin only — RBAC à venir)
GET    /api/v1/users
POST   /api/v1/users
GET    /api/v1/users/{user_id}
PATCH  /api/v1/users/{user_id}
DELETE /api/v1/users/{user_id}
GET    /api/v1/users/{user_id}/permissions

# Organisation
GET    /api/v1/centres
POST   /api/v1/centres
GET    /api/v1/centres/{centre_id}
PATCH  /api/v1/centres/{centre_id}
GET    /api/v1/agencies
POST   /api/v1/agencies
GET    /api/v1/agencies/{agency_id}
PATCH  /api/v1/agencies/{agency_id}
GET    /api/v1/managers
POST   /api/v1/managers
GET    /api/v1/managers/{manager_id}
PATCH  /api/v1/managers/{manager_id}
GET    /api/v1/organizations/hierarchy

# Clients
GET    /api/v1/clients?q=&status=&client_type=&marche=
GET    /api/v1/clients/{client_id}
POST   /api/v1/clients
PATCH  /api/v1/clients/{client_id}
DELETE /api/v1/clients/{client_id}
GET    /api/v1/clients/{client_id}/accounts
GET    /api/v1/clients/{client_id}/summary
GET    /api/v1/clients/{client_id}/history
POST   /api/v1/clients/merge

# Comptes (lecture OK, écritures = 501)
GET    /api/v1/accounts
GET    /api/v1/accounts/{account_id}
PATCH  /api/v1/accounts/{account_id}
GET    /api/v1/accounts/{account_id}/receivable-summary
GET    /api/v1/accounts/{account_id}/receivable           # deprecated alias

# Factures (lecture OK, écritures = 501)
GET    /api/v1/invoices
GET    /api/v1/invoices/{invoice_id}

# Paiements (lecture OK, écritures = 501)
GET    /api/v1/payments
GET    /api/v1/payments/{payment_id}
GET    /api/v1/payments/unallocated

# Services
GET    /api/v1/services
GET    /api/v1/services/{type_service}

# Utilitaires
GET    /status
GET    /health/db
```

Toutes les autres routes (3.5+3.6+3.7 POST/PATCH/DELETE, 3.8, 3.9, 3.10, 3.11)
sont accessibles dans le contrat OpenAPI mais retournent **501 Not Implemented**
tant que les stubs `crud.py` ne sont pas remplacés.

---

## 9. Travail restant

Par ordre de priorité pour l'intégration frontend :

### 🔴 Bloquants (sans eux, le front ne peut rien faire)

1. Implémenter le **CRUD des paiements** : `create_payment`, `create_payment_allocations`, `delete_allocation` — c'est le cœur du métier.
2. Implémenter **`create_invoice`** et **`update_invoice`** — création de factures (workflow principal).
3. Implémenter le module **recouvrement** : `create_collection_action`, `update_collection_action`, `mark_promise_kept`, `mark_promise_broken`, `create_promise_for_account`.
4. Implémenter **`start_import`** et **`list_import_errors`** (parsing Excel).
5. Implémenter **`dashboard_summary`** (KPI globaux — page d'accueil).

### 🟠 Importants

6. `get_account_invoices` et `get_account_payments` (drill-down depuis un compte).
7. Les 14 endpoints `/reports/*` (projections sur vues SQL — relativement simples).
8. `admin_audit_list` et `admin_data_cleanup`.

### 🟡 Qualité

9. **RBAC** : créer un `Depends(require("scope:action"))` et l'appliquer partout — la spec est explicite (`users:read`, `clients:write`, `payments:allocate`, etc.).
10. **Middleware `X-Request-ID`** : traçabilité des requêtes.
11. **Middleware `X-Idempotency-Key`** : surtout pour `POST /imports` et `POST /payments/{id}/allocations`.
12. **Pagination uniforme** : migrer les routes existantes (qui renvoient `List[T]`) vers `Page[T]` conformément à §3.1 de la spec.
13. **Migration Alembic** pour charger les vues SQL de `database/views.sql` automatiquement.
14. **Migration Alembic** pour créer la table `allocations`.
15. **JWT signé** + révocation serveur (l'actuel est un token en mémoire).
16. **CORS** : configuration `CORS_ORIGINS` + middleware.
17. **Tests d'intégration** : pytest par section (auth, clients, finance, recouvrement…).

---

## 10. Notes opérationnelles

### Identifiants et accès

| Ressource | Valeur |
|---|---|
| Compte de connexion frontend (démo) | `agent@camtel.cm` / `demo1234` |
| `DATABASE_URL` (défaut, config.py) | `postgresql://postgres:postgres@localhost:5433/gblrecover` |
| Docker (TRD §14) | `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` = `gblrecover` |

> **Authentification réelle (API)** : `POST /api/v1/auth/login` attend un utilisateur présent en base (`users.email` + mot de passe vérifié par `passlib`). Aucun utilisateur de démonstration n'est seedé par le schéma (seul `system@local`, mot de passe vide, est créé par `database/load_data.py`). Le compte frontend `agent@camtel.cm` / `demo1234` est géré uniquement côté client en mode démo (`VITE_DEMO_MODE=true`).
>
> **Incohérence connue** : `frontend/src/data/demo-data.ts` expose `demoPassword = "camtel2026"`, non correspondant au mot de passe de connexion effectif (`demo1234`).

### Différences connues vs spec

| Point | Spec | Code | Raison |
|---|---|---|---|
| `GET /accounts/{id}/receivable` | `/receivable-summary` | les deux | Alias deprecated pour rétrocompat |
| Filtres `GET /accounts` | `client_id, agency_id, manager_id, status, account_number` | `client_id, agency_id` | Manque les 3 derniers (à étendre) |
| Filtres `GET /invoices` | `account_id, status, due_date__gte, due_date__lte, outstanding_amount__gt` | aucun filtre | À implémenter dans `crud.get_invoices` |
| Filtres `GET /payments` | `account_id, status, payment_date` | aucun filtre | À implémenter dans `crud.get_payments` |
| Format pagination | `{ items: [...], meta: { total, page, page_size } }` | `List[T]` (legacy) | Migration progressive via `Page[T]` |
| Codes HTTP `X-Idempotency-Key` | obligatoire sur mutations | non vérifié | Middleware à ajouter |
| Middleware `X-Request-ID` | obligatoire | non implémenté | Middleware à ajouter |
| RBAC par permission | requis | non implémenté | `Depends(require("scope:action"))` à créer |

### Convention pour étendre l'API

1. Ajouter le schéma Pydantic dans `schemas.py` (`*Base / *Create / *Update / *Read`).
2. Si la table n'est pas mappée, créer le modèle ORM dans `app/models/`.
3. Ajouter la fonction CRUD dans `crud.py` (signature stable, stub `_todo()` acceptable).
4. Déclarer la route dans le routeur de section (`finance.py`, `recouvrement.py`, …).
5. Si nouveau routeur : `include_router(...)` dans `routes.py`.
6. **Pour les routes avec logique à implémenter** : `status_code=status.HTTP_501_NOT_IMPLEMENTED` sur le décorateur.
7. **Quand la logique est implémentée** : retirer `status_code=501` du décorateur et remplacer `_todo()` par le code réel.

### Liens utiles

- Spec complète : [`API_specification_and_db_coherence_v2.md`](./API_specification_and_db_coherence_v2.md)
- Schéma DB : `../database/schema.sql`
- Vues SQL : `../database/views.sql`
- PRD/TRD : `../docs/`