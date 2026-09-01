# GBLRecover Containerisation

Structure de conteneurisation pour le déploiement de l'application GBLRecover avec Docker Compose.

## Architecture

```
docker/
├── docker-compose.yml      # Orchestration des services
├── .env.example            # Variables d'environnement
├── .dockerignore           # Fichiers à ignorer lors du build
├── dockerfile.backend/     # Image du backend FastAPI
└── dockerfile.frontend/    # Image du frontend React/Vite
```

## Services

- **db** : PostgreSQL 16 (port 5433)
- **backend** : FastAPI (port 8000)
- **frontend** : React + Vite (port 5173)

## Démarrage

1. Copier et configurer les variables d'environnement :
```bash
cp .env.example .env
```

2. Lancer les conteneurs depuis le répertoire `docker/` :
```bash
cd docker
docker compose up --build
```

3. Accéder à l'application :
- Frontend : http://localhost:5173
- Backend : http://localhost:8000
- Status : http://localhost:8000/status

## Arrêt

```bash
docker compose down
```

Pour supprimer aussi les volumes de données :
```bash
docker compose down -v
```

## Logs

Suivre les logs en temps réel :
```bash
docker compose logs -f [service_name]
```

Par exemple :
```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```

## Commandes utiles

Exécuter une commande dans un conteneur :
```bash
docker compose exec backend python -m alembic upgrade head
docker compose exec frontend npm run build
```

Rebâtir les images :
```bash
docker compose build --no-cache
```

Vérifier l'état des conteneurs :
```bash
docker compose ps
```

## Notes

- Les données PostgreSQL sont persistées dans un volume Docker (`postgres_data`)
- Le backend et le frontend sont en mode développement avec rechargement automatique
- L'URL de la base de données est automatiquement résolue via le service `db` défini dans docker-compose
