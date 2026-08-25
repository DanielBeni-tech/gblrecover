# Lancer GBLRecover localement (sans Docker)

## Prérequis

- **Python 3.12+** ([https://www.python.org](https://www.python.org))
- **Node.js 20+** ([https://nodejs.org](https://nodejs.org))
- **PostgreSQL 14+** (optionnel - voir alternatives ci-dessous)

Vérifie que tu as les bon outils :
```powershell
python --version
node --version
npm --version
```

---

## Lancement rapide (recommandé)

L'environnement local se met en place **en une commande** :

```bash
./scripts/start_local.sh            # base + backend (+ frontend, optionnel : --all)
```

Ce script :
1. Démarre un **cluster PostgreSQL dédié au projet** (`~/.gblrecover`, port **5433**,
   superuser `postgres` / mot de passe `postgres`) s'il n'est pas déjà actif ;
2. Applique le schéma officiel `database/schema.sql` + les vues `database/views.sql` ;
3. Sème les rôles `AGENT`/`ADMIN` et les comptes de démo ;
4. Démarre le backend FastAPI sur `http://localhost:8000` (et le frontend sur `:5173` avec `--all`).

Des **services systemd utilisateur** (`gblrecover-postgres`, `gblrecover-backend`) sont
également installés : la base et l'API redémarrent automatiquement à la session.

```bash
systemctl --user status gblrecover-postgres gblrecover-backend
```

> 💡 Historique des données : `database/GBL - Juillet 2026.xlsx` (réel, 13 Mo) peut être
> (re)chargé avec `python3 database/load_fast.py` (PORT 5433, MDP `postgres`).

---

## Option 1 : Avec PostgreSQL local (Recommandé)

### 1. Installer PostgreSQL

Télécharge et installe PostgreSQL depuis : https://www.postgresql.org/download/windows/

Lors de l'installation, note bien :
- **Port** : 5432 (par défaut)
- **Username** : `postgres`
- **Password** : postgres

### 2. Créer la base de données

Ouvre **pgAdmin** (installé avec PostgreSQL) ou utilise la ligne de commande :

```powershell
psql -U postgres -c "CREATE DATABASE gblrecover;"
```

### 3. Configurer le backend

Navigue dans le dossier backend :
```powershell
cd backend
```

Crée un fichier `.env` :
```
DATABASE_URL=postgresql://postgres:TON_MOT_DE_PASSE@localhost:5432/gblrecover
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Remplace `TON_MOT_DE_PASSE` par le mot de passe PostgreSQL que tu as noté.

### 4. Installer et lancer le backend

```powershell
# Créer un environnement virtuel Python
python -m venv venv

# Activer l'environnement virtuel
.\venv\Scripts\Activate.ps1

# Installer les dépendances
pip install -r requirements.txt

# Lancer le serveur FastAPI
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

✅ Le backend est maintenant accessible à `http://localhost:8000`

### 5. Dans un nouveau terminal, lancer le frontend

```powershell
cd frontend

# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
```

✅ Le frontend est maintenant accessible à `http://localhost:5173`

---

## Option 2 : Sans PostgreSQL (SQLite pour le développement)

Si tu n'as pas PostgreSQL, tu peux utiliser SQLite pour tester rapidement.

### Modifier la configuration du backend

Édite `backend/app/core/config.py` :

```python
import os
from pathlib import Path

database_url = os.getenv(
    "DATABASE_URL",
    "sqlite:///./gblrecover.db"  # ← Change ici
)

class Settings:
    database_url: str = database_url
```

### Modifier `backend/app/db/session.py` :

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Adapter pour SQLite
if "sqlite" in settings.database_url:
    engine = create_async_engine(settings.database_url, echo=False, connect_args={"check_same_thread": False})
else:
    engine = create_async_engine(settings.database_url.replace('postgresql://', 'postgresql+asyncpg://'), echo=False)

AsyncSessionLocal = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

Puis relance le backend comme avant ✅

---

## Résumé des accès

| Service | URL | Statut |
|---------|-----|--------|
| Frontend | http://localhost:5173 | Doit afficher l'interface |
| Backend | http://localhost:8000 | Doit afficher un message JSON |
| Backend Status | http://localhost:8000/status | `{"status": "ok", "version": "0.2.0"}` |
| DB Health | http://localhost:8000/health/db | `{"db": "ok"}` |

---

## Comptes de démonstration

Au **démarrage du backend**, un bootstrap automatique (`backend/app/db/bootstrap.py`)
crée (si absentes) les tables d'authentification `users`, `roles`, `user_roles`,
`permissions`, `role_permissions`, puis provisionne les comptes de démo :

| Rôle | E-mail | Mot de passe |
|------|--------|--------------|
| Agent | `agent@camtel.cm` | `demo1234` |
| Administrateur | `admin@camtel.cm` | `admin1234` |

Ce bootstrap est **idempotent** : à chaque démarrage, il réinitialise le mot de
passe de ces comptes à la valeur ci-dessus. À lancer aussi à la main :

```powershell
cd backend
python -m scripts.seed_demo
```

> L'interface de connexion attend un **e-mail** + **mot de passe**
> (`POST /api/v1/auth/login`).

---

## Troubleshooting

### Le backend ne se lance pas

```powershell
# Vérifie Python
python -c "import fastapi; print('FastAPI OK')"

# Réinstalle les dépendances
pip install --upgrade -r requirements.txt
```

### Le frontend ne se lance pas

```powershell
# Suprime node_modules et réinstalle
rm -Recurse node_modules
npm install
npm run dev
```

### Erreur de base de données

```powershell
# Vérifie PostgreSQL
psql -U postgres -c "\l"  # Liste les BD

# Crée la BD si elle n'existe pas
psql -U postgres -c "CREATE DATABASE gblrecover;"
```

### Port déjà utilisé

Si le port 8000 ou 5173 est déjà utilisé :

```powershell
# Backend sur un autre port
uvicorn app.main:app --reload --host 0.0.0.0 --port 9000

# Frontend sur un autre port (voir vite.config.ts)
npm run dev -- --port 3000
```
