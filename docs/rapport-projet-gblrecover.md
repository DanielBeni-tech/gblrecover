# Rapport d'Analyse Complète du Projet GBLRecover

**Plateforme de Revenue Assurance — CAMTEL**
**Date du rapport : 31 août 2026**
**Auteur : Analyse automatisée du code source**

---

## Sommaire Exécutif

GBLRecover est une plateforme web de Revenue Assurance destinée à CAMTEL, visant à centraliser, fiabiliser et rendre actionnables les données de facturation, paiement et créances. Le projet est dans un état fonctionnel avancé avec un MVP déployable, couvrant l'intégralité du cycle de recouvrement : de l'import Excel à l'aide à la décision analytique.

**Mots-clés du projet** : Consolidation de données, pipeline d'import Excel, Vue Client 360°, Aide à la décision, RBAC, Audit trail.

---

## 1. Équipe du Projet

| Membre | Nom complet |
|--------|-------------|
| 1 | BALAWE NDIKWA BIENVENU |
| 2 | SOUNDJOCK NDZANA MARIE ZACHARIE |
| 3 | DJOUKOUO KENGNE ANGE RAYANNE |
| 4 | DANIEL BENI MPODOL WELISAN |
| 5 | NKOUMOU TJADE GRINNEL GERMAIN |
| 6 | EVINA MBAHO ERIC |

---

## 2. Métriques Globales du Projet

| Métrique | Valeur |
|----------|--------|
| **Fichiers Python (backend)** | 35 fichiers — 4 322 lignes |
| **Fichiers TypeScript/TSX (frontend)** | 45 fichiers — 10 072 lignes |
| **Schéma SQL** | 254 lignes |
| **Vues SQL analytiques** | 1 868 lignes (30+ vues) |
| **Commits Git** | 54 |
| **Endpoints API** | 111 routes REST |
| **Pages frontend** | 17 routes (14 pages + 3 redirects) |
| **Composants UI** | 19 composants shadcn-style réutilisables |
| **Vues SQL analytiques** | 30+ |
| **Tables de la base** | 15 tables métier + auth |

---

## 3. Stack Technique

### 3.1 Frontend

| Technologie | Version | Usage |
|-------------|---------|-------|
| **React** | 19.2.8 | Framework UI |
| **TypeScript** | 7.0.2 | Typage statique |
| **Vite** | 8.2.1 | Bundler / dev server |
| **Tailwind CSS** | 4.3.3 | Styling utility-first |
| **TanStack Query** | 5.101.4 | Gestion état serveur / cache |
| **React Router** | 7.18.2 | Routage SPA |
| **React Hook Form + Zod** | 7.85 / 4.4 | Formulaires + validation |
| **Lucide React** | 1.31 | Iconographie |
| **Inter + JetBrains Mono** | 5.3 | Typographie |

**Architecture frontend** :
- **14 pages fonctionnelles** réparties en 8 domaines métier
- **19 composants UI** de base (shadcn-style, versionnés dans le projet)
- **4 composants graphiques** (donut, stacked bar, trend chart, aging chart)
- **Composants de layout** : sidebar responsive (desktop/mobile), topbar avec recherche globale
- **Hooks & utils** : `format.ts` (xaf, dateFr, xafCompact), `cn.ts` (clsx + tailwind-merge)

### 3.2 Backend

| Technologie | Version | Usage |
|-------------|---------|-------|
| **FastAPI** | — | Framework ASGI |
| **Python** | 3.12 | Langage |
| **SQLAlchemy 2.0** | — | ORM async |
| **Alembic** | — | Migrations |
| **Pydantic v2** | — | Validation/sérialisation |
| **PostgreSQL** | 16 | Base de données |
| **asyncpg** | — | Driver async PostgreSQL |
| **Passlib + bcrypt** | — | Hachage mots de passe |
| **Pandas + OpenPyXL** | — | Pipeline import Excel |

**Architecture backend** :
- **Couche API** : routes versionnées `/api/v1/` avec 111 endpoints
- **Couche CRUD** : opérations DB centralisées (~1 450 lignes)
- **Couche Modèles** : 12 modèles SQLAlchemy (User, Role, Permission, Client, Compte, Facture, Paiement, etc.)
- **Middleware** : CORS, gestion erreurs globale, X-Request-ID
- **Bootstrap** : auto-provisionnement des comptes démo au démarrage

### 3.3 Base de Données

- **PostgreSQL 16** (alpine pour Docker)
- **15 tables métier** : Centre, Agence, Gestionnaire, Client, Compte, Service, Souscrire, Facture, Paiement, Users, Roles, Permissions, Collection_Actions, Promises, Audit_Events, Import_Batches, Import_Errors
- **30+ vues SQL analytiques** couvrant :
  - Portefeuille global, impayés critiques, performance gestionnaires
  - Évolution mensuelle, cartographie clients, analyse par marché
  - Centres/agences, tendance de détérioration, spirale négative
  - Saisonnalité des impayés, cohortes de facturation
  - Aging des impayés, prédiction de balance (régression linéaire)
  - Détection d'anomalies de facturation
  - Qualité d'identification, complétude des contacts

---

## 4. Fonctionnalités Détaillées

### 4.1 Authentification & Sécurité (RBAC)

- **Login / Logout** avec JWT (access token)
- **Rôle par défaut** : Admin — capacité d'extension multi-rôles
- **RBAC complet** : Users → Roles → Permissions (tables many-to-many)
- **Filtrage périmètre** : CENTRE_ID / AGENCY_ID sur User_Roles
- **Bootstrap auto** : comptes démo créés au démarrage du backend
- **Comptes démo** : `admin@camtel.cm / admin1234`, `agent@camtel.cm / demo1234`
- **Hachage bcrypt** avec troncation 72 octets (compatibilité)

### 4.2 Dashboard Vue Nationale

- **6 KPIs** : Nombre de comptes, Encours total, Créances impayées, Créances payées, Taux de recouvrement, Solde négatif
- **Filtres** : Centre, Agence, Mois
- **Évolution dette vs encaissements** : graphique barres empilées mensuel
- **Top 20 clients endettés** avec détails (code, marché, centre, agence, nb comptes, nb factures, total impayé, période)
- **Top 20 dettes CAMTEL** (soldes négatifs)

### 4.3 Analyse de la Dette (Receivables)

- **Aging bucket national** : donut chart + tableau des tranches (0-30j, 31-60j, 61-90j, >90j) avec alerte seuil critique
- **Évolution des tranches** : graphique barres empilées sur 12 mois
- **Décomposition par centre** : tableau avec badges colorés (MC-CENTRE, MC-LITTORAL, etc.), encours total, %, taux de recouvrement
- **Centres en difficulté** : barres horizontales top 5 par montant >90j
- **Décomposition par agence** : top 10 par encours avec taux de recouvrement
- **Filtres** : Période, Segment (Centre/Agence/Marché), Centre, Agence, Marché

### 4.4 Performance — Centres

- **KPIs comparatifs** : Encours total, Dette échue >30j, Taux de recouvrement, Clients identifiés, Comptes à l'arrêt
- **Onglets** : Vue Synthétique, Dettes & Recouvrement, Comptes & Portefeuilles
- **Filtres** : Période de référence, Comparaison, Marché
- **Barres de progression** colorées (vert/rouge/orange)

### 4.5 Performance — Agences

- Liste paginée des agences avec métriques
- Recherche multicritère

### 4.6 Performance — Gestionnaires

- Tableau de bord gestionnaire avec volume de dossiers, taux de recouvrement
- Filtrage par centre/agence

### 4.7 Gestion des Clients

- **Recherche multicritère** : identifiant, code, raison sociale, téléphone
- **Liste clients** avec agrégations : nb comptes, encours, balance, statut facturation
- **Fiche client détaillée** (route `/clients/:id`) avec onglets :
  - Résumé KPI
  - Comptes
  - Services
  - Factures
  - Paiements
  - Créances
  - Historique

### 4.8 Factures & Paiements

- **Liste factures** paginée avec filtres (statut, paiement)
- **Détail facture** avec historique des paiements
- **Allocation paiement** à facture
- **Statuts dérivés** : PAID / PARTIAL / UNPAID (calculés depuis paid_amount / outstanding_amount)

### 4.9 Import Excel

- **Upload** de fichiers `.xlsx` / `.xls`
- **Pipeline** : validation format → prévisualisation → mapping colonnes → import batch
- **Rapport de rejets** : ligne, colonne, valeur brute, message d'erreur
- **Traçabilité** : Import_Batches + Import_Errors
- **Idempotence** : checksum fichier pour éviter les doubles imports

### 4.10 Recouvrement (Actions de relance)

- **Actions de collection** : type, date échéance, commentaire, priorité, assignation
- **Promesses de paiement** : montant promis, date, statut (PENDING / KEPT / BROKEN)
- **Dashboard actions** : PLANNED / IN_PROGRESS / COMPLETED / CANCELLED, dues today, en retard

### 4.11 Administration & Qualité des Données

- **Qualité d'identification** : comptes sans gestionnaire, comptes orphelins
- **Complétude des contacts** : clients sans email/téléphone
- **Doublons potentiels** : clients avec plusieurs codes
- **Incohérences facturation** : écarts montant vs outstanding
- **Adoption e-bill** : taux d'adoption par centre
- **Journal d'audit** : historique des actions utilisateur

### 4.12 Référentiels

- Centres, Agences, Gestionnaires, Services en lecture/édition

### 4.13 Recherche Globale

- **Topbar** avec champ de recherche global (clients, comptes, factures)
- Résultats avec navigation directe

---

## 5. Architecture Technique

### 5.1 Architecture en Couches

```
┌─────────────────────────────────────────┐
│           Frontend (React/Vite)          │
│  Pages → Components → API Client → Hooks │
└──────────────────┬──────────────────────┘
                   │ HTTP/JSON
┌──────────────────▼──────────────────────┐
│           Backend (FastAPI)              │
│  Routes → Schemas → CRUD → Models       │
└──────────────────┬──────────────────────┘
                   │ SQLAlchemy async
┌──────────────────▼──────────────────────┐
│          PostgreSQL 16                   │
│  Tables → Vues SQL → Indexes            │
└─────────────────────────────────────────┘
```

### 5.2 Conventions de Code

**Backend** :
- Routes dans `app/api/v1/*.py` — un fichier par domaine métier
- CRUD centralisé dans `crud.py` (~1 450 lignes)
- Schémas Pydantic dans `schemas.py`
- Modèles SQLAlchemy dans `app/models/*.py` — un par entité
- Validation : Pydantic v2 côté backend, Zod côté frontend
- Erreurs structurées : `{"error": {"code": "...", "message": "..."}}`

**Frontend** :
- Pages dans `src/features/*/` — un dossier par domaine
- Composants UI dans `src/components/ui/` — shadcn-style, réutilisables
- API client dans `src/api/client.ts` — fonctions typées par endpoint
- Types dans `src/api/types.ts`
- Formatage dans `src/lib/format.ts`
- TanStack Query pour le cache serveur (staleTime configuré)

### 5.3 Conception de la Sécurité

- JWT pour l'authentification stateless
- RBAC avec tables many-to-many (Users → Roles → Permissions)
- Filtrage par périmètre (CENTRE_ID, AGENCY_ID) sur User_Roles
- CORS configuré par variable d'environnement
- Aucune donnée sensible dans le frontend (pas de secrets committés)
- Audit trail complet (AUDIT_EVENTS)

---

## 6. Données Métier

### 6.1 Source des Données

Le projet utilise un fichier Excel de référence : `database/GBL - Juillet 2026.xlsx` contenant les données de facturation CAMTEL. Les données couvrent :

- **Période** : Décembre 2025 — Juin 2026 (7 mois)
- **Marchés** : OFF (Officiel), PRO (Professionnel), PAR (Particulier), AUTRE
- **Centres** : MC-CENTRE, MC-LITTORAL, MC-NORD, MC-SUD, MC-OUEST, MC-EST, MC-DG, MC-EXTREME NORD, MC-SOUTH WEST, MC-DOUALA, MC-NORTH WEST, MC-ADAMAOUA, DIVISION-CONTROLE_REVENUE_ASSURANCE
- **Total factures** : ~50 606 comptes, ~861 Md XAF d'encours

### 6.2 Pipeline d'Import

```
Excel (.xlsx) → Upload → Validation → Mapping → Pandas DataFrame → PostgreSQL
                                        ↑
                              Contrôles :
                              - Format colonnes
                              - Taille max
                              - Types de données
                              - ID uniques
```

### 6.3 Vues SQL Analytiques (Sélection)

| Vue | Description |
|-----|-------------|
| `vw_globale_portefeuille` | Vue consolidée portefeuille global |
| `vw_impayes_critiques` | Impayés prioritaires par montant |
| `vw_performance_gestionnaires` | KPIs par gestionnaire |
| `vw_evolution_mensuelle` | Évolution facturation/impayés mensuelle |
| `vw_cartographie_clients` | Répartition géographique des clients |
| `vw_analyse_marches` | Analyse par segment marché |
| `vw_analyse_centres_agences` | Performance centres/agences |
| `vw_aging_impayes` | Balance âgée (tranches d'ancienneté) |
| `vw_tendance_deterioration` | Détection de dégradation |
| `vw_spirale_negative` | Facturation baisse + impayés montent |
| `vw_saisonnalite_impayes` | Patterns saisonniers |
| `vw_cohortes_facturation` | Cohortes clients par mois acquisition |
| `vw_prevision_balance` | Prédiction par régression linéaire |
| `vw_detection_anomalies_facturation` | Anomalies de facturation (x2, /2) |
| `vw_qualite_identification` | Qualité des données identifiantes |
| `vw_completude_contacts` | Taux de complétude contacts |

---

## 7. Déploiement

### 7.1 Docker Compose

Le projet fournit un `docker-compose.yml` complet avec 3 services :

| Service | Image | Port |
|---------|-------|------|
| **db** | postgres:16-alpine | 5433 → 5432 |
| **backend** | FastAPI (Dockerfile) | 8001 |
| **frontend** | Vite dev (Dockerfile) | 5173 |

### 7.2 Environnement de Développement Local

| Ressource | Valeur par défaut |
|-----------|-------------------|
| PostgreSQL | `localhost:5433` / `postgres:postgres` / `gblrecover` |
| Backend API | `http://localhost:8000` |
| Frontend | `http://localhost:5173` |
| Login admin | `admin@camtel.cm` / `admin1234` |
| Login agent | `agent@camtel.cm` / `demo1234` |

### 7.3 Production (Prévu)

- Frontend → Vercel
- Backend → Railway
- Base → Railway PostgreSQL

---

## 8. Points Forts du Projet

1. **Couverture fonctionnelle complète** pour un MVP : auth, dashboard, clients 360°, factures, paiements, import Excel, recouvrement, administration, audit
2. **Architecture propre** : séparation front/back, API REST versionnée, RBAC, audit trail
3. **Base de données riche** : 15 tables + 30+ vues analytiques, dont des vues avancées (régression linéaire, cohortes, spirale négative)
4. **Design system cohérent** : composants UI shadcn-style, tokens Material GBLRecover, responsive
5. **Pipeline d'import** avec validation, rejets, et traçabilité
6. **Documentation produit solide** : PRODUCT.md, GBLContext, PRD, TRD, UX doc
7. **Docker-ready** : compose complet pour développement et déploiement
8. **Données réelles** : importées depuis fichier Excel CAMTEL avec mapping métier

---

## 9. Points d'Amélioration / Risques

### 9.1 Qualité du Code

| Problème | Gravité | Recommandation |
|----------|---------|----------------|
| Erreur TS6133 (variables non utilisées) dans centres-page | Faible | Nettoyer les destructurages |
| `Input` manquait dans centres-page (corrigé) | Moyen | Ajouter des tests de build CI |
| `demoPassword` incohérent dans mock-data | Faible | Harmoniser les identifiants démo |
| Pas de tests unitaires frontend | Moyen | Ajouter des tests (Vitest) |
| Pas de tests backend visibles | Moyen | Ajouter des tests pytest |

### 9.2 Sécurité

| Problème | Gravité | Recommandation |
|----------|---------|----------------|
| Pas de rate limiting sur les endpoints | Moyen | Ajouter slowapi |
| Pas de HTTPS en dev (localhost uniquement) | Faible | OK pour dev, à prévoir pour prod |
| SECRET_KEY JWT pas visible (peut être hardcoded) | Moyen | Vérifier generation aléatoire |
| Pas de refresh token | Faible | À prévoir pour UX longue session |

### 9.3 Architecture

| Problème | Gravité | Recommandation |
|----------|---------|----------------|
| `crud.py` très volumineux (~1 450 lignes) | Faible | Découper par domaine |
| Pas de cache Redis pour TanStack Query côté backend | Faible | À évaluer en charge |
| Pas de WebSocket pour temps réel | Faible | V2 |
| Les données ne sont pas temps réel | Information | OK pour MVP — date de fraîcheur affichée |

### 9.4 Déploiement

| Problème | Gravité | Recommandation |
|----------|---------|----------------|
| Pas de CI/CD configuré | Moyen | Ajouter GitHub Actions |
| Pas de monitoring (logs structurés, métriques) | Moyen | Ajouter Prometheus/Grafana |
| Backend lancé sans `--reload` en prod | Faible | Utiliser gunicorn |

---

## 10. Roadmap Suggérée

### Phase 1 — Consolidation (Court terme)
- ✅ Corriger les erreurs TypeScript résiduelles
- ✅ Ajouter tests unitaires (Vitest frontend, pytest backend)
- ✅ CI/CD (GitHub Actions)
- ✅ Rate limiting API

### Phase 2 — Enrichissement (Moyen terme)
- Refresh tokens pour sessions longues
- Notifications en temps réel (WebSocket)
- Export PDF des rapports
- Notifications email pour actions de relance
- Dashboard mobile responsive avancé

### Phase 3 — Production (Long terme)
- Déploiement Vercel/Railway
- Monitoring (Sentry, Prometheus)
- SSO/CAS pour intégration Active Directory
- API publique pour intégrations tierces
- Score prédictif de recouvrable (ML)

---

## 11. Conclusion

Le projet GBLRecover est un **MVP fonctionnel et bien architecturé** pour une plateforme de Revenue Assurance. L'équipe a réalisé un travail complet couvrant :

- Une **base de données riche** avec 30+ vues analytiques avancées
- Un **backend API** de 111 endpoints REST avec RBAC et audit trail
- Un **frontend** de 14 pages avec design system cohérent
- Un **pipeline d'import Excel** avec validation et traçabilité
- Une **documentation produit** exhaustive (PRD, TRD, UX)

Le projet est prêt pour un déploiement de démonstration et peut servir de base solide pour une mise en production progressive. Les améliorations prioritaires sont les tests automatisés, le CI/CD, et la sécurisation (rate limiting, refresh tokens).

---

*Rapport généré automatiquement le 31 août 2026*
*Source : analyse du code source GBLRecover (branche dev)*
