# Audit des fonctionnalités actuelles de GBLRecover

> **Pour qui** : toi, le nouveau/la nouvelle qui arrive sur le projet.
> **Pourquoi** : avant d'ajouter une fonctionnalité, mieux vaut comprendre ce qui existe déjà, à quoi ça sert, et comment le système s'articule autour du fameux fichier Excel de CAMTEL.
> **Approche** : ce document est un *paysage* — pas un jugement. Tout ce que tu vas lire a été conçu pour répondre à un besoin métier précis. Si quelque chose te semble « bizarre » ou « pas fini », c'est probablement parce que tu n'as pas encore vu le besoin derrière. C'est normal.

---

## 0. Le projet en une phrase

**GBLRecover** est la plateforme web de *Revenue Assurance* (assurance chiffre d'affaires) de **CAMTEL**, l'opérateur télécom camerounais. Elle prend un gros fichier Excel mensuel que CAMTEL reçoit de son système de facturation, et le transforme en une vue 360° d'un client : ses comptes, ses factures, ses impayés, l'agence qui le suit, le gestionnaire responsable, et l'action de recouvrement à mener.

**La promesse produit** (tirée de `PRODUCT.md`) : *« Voir juste. Comprendre vite. Agir avec confiance. »*

**La question métier fondamentale** : étant donné un fichier de 51 789 lignes et 44 colonnes représentant ~47 700 clients CAMTEL, comment aider un agent de recouvrement à trouver en quelques secondes le bon client, à comprendre sa situation, et à décider quoi faire ?

---

## 1. Le fichier Excel : la matière première de tout le système

Avant de parler fonctionnalités, regarde le fichier `database/GBL - Juillet 2026.xlsx`. C'est **la** source de vérité métier du projet. Le système n'invente pas les chiffres, il les structure.

### 1.1 Ce qu'il y a dans ce fichier (1 seul onglet : « Fichier client »)

| Bloc | Colonnes | Ce que ça représente |
|---|---|---|
| **Identité client** | Compte, Marché, Code client, E-Bill, Raison sociale | Qui est le client (entreprise, particulier, administration…) |
| **Organisation interne** | Centre gestion, Agence, Mat. Gestionnaire, Gestionnaire | Qui chez CAMTEL suit ce client |
| **Souscription** | LS, Vobb, FTTx, TV, Tel, ADSL, Mobile, Autres | Les 8 types de services téléphoniques/internet souscrits par compte |
| **Cycle de facturation** | 14 colonnes « Décembre Facture 2025 » → « Juin Impayés 2026 » | Ce qui a été facturé et ce qui reste dû, mois par mois |
| **Indicateurs de compte** | Balance, Facturation | Solde du compte + statut (Arrêt / En cours) |
| **Métadonnées non chargées** | Type, Tax, Cycle, Model de control, Credit Limit, Contact, Adresse, Code postal, Indv à contacter | Présentes dans le fichier mais pas (encore) exploitées par l'app |

### 1.2 Pourquoi c'est important

- **Le fichier change chaque mois** : c'est un livrable récurrent que CAMTEL fournit. La plateforme doit donc *absorber* un nouveau fichier, *remplacer* ce qui a changé, et *préserver* l'historique. C'est tout l'enjeu du pipeline d'import (§6).
- **L'Excel n'a PAS de paiements** : c'est une bizarrerie apparente mais très documentée. La table `paiement` existe dans le schéma SQL et des endpoints existent, mais le fichier source ne contient pas de données de paiement. Conséquence : la page « Paiements » est explicitement vide par construction, pas par oubli.
- **L'Excel n'a PAS non plus de notion de « créance » formalisée** : les créances sont *dérivées* en croisant ce qui a été facturé et ce qui reste impayé, mois par mois.

> 💡 **Conseil de lecture** : quand on te demandera d'ajouter une fonctionnalité, commence toujours par te demander : *« est-ce que cette information est dans l'Excel, ou est-ce qu'on la calcule à partir de l'Excel ? »* — ça change tout.

---

## 2. Architecture générale (où vit quoi)

```
gblrecover/
├── backend/                 # API FastAPI (Python)
│   ├── app/
│   │   ├── api/v1/         # Les routes HTTP (auth, clients, factures, imports…)
│   │   ├── models/         # Modèles SQLAlchemy (miroir des tables SQL)
│   │   ├── core/           # Configuration (DATABASE_URL, etc.)
│   │   ├── db/             # Connexion base, sessions
│   │   └── main.py         # Point d'entrée FastAPI
│   └── alembic/            # Migrations de schéma
│
├── frontend/                # SPA React 19 (TypeScript + Vite)
│   ├── src/
│   │   ├── api/            # Client HTTP (fetch + JWT + X-Request-ID)
│   │   ├── features/       # Une page = un dossier (dashboard, clients, factures…)
│   │   ├── components/     # Briques UI partagées (boutons, cartes, tableaux…)
│   │   └── lib/            # Helpers (format XAF, dates FR…)
│   └── vite.config.ts
│
├── database/                # Le cœur métier
│   ├── schema.sql          # 20 tables (CENTRE, AGENCE, CLIENT, COMPTE, FACTURE…)
│   ├── views.sql           # ~40 vues SQL prêtes à l'emploi
│   ├── load_fast.py        # Le script qui charge l'Excel en base
│   └── GBL - Juillet 2026.xlsx  # Le fichier source
│
├── docs/                    # Documentation (PRD, TRD, UX, GBLContext…)
├── scripts/                 # Scripts utilitaires (reset DB, démarrage local…)
└── docker/                  # Compose pour lancement conteneurisé
```

> **Le flux de données** en une ligne : *Excel → `load_fast.py` → tables SQL → vues SQL → API FastAPI → pages React → écran de l'agent.*

---

## 3. Authentification & session

**Fichiers clés** : `frontend/src/features/auth/login-page.tsx`, `backend/app/api/v1/auth.py`, `frontend/src/api/client.ts`

| Fonctionnalité | Ce qu'elle fait | Pourquoi elle existe (plus-value) |
|---|---|---|
| Page de login | Formulaire identifiant + mot de passe | Point d'entrée sécurisé. Avant, l'Excel était manipulé par n'importe qui ; aujourd'hui chaque action est tracée et attribuée à un utilisateur. |
| Stockage JWT (access + refresh) | Le token est stocké dans `localStorage` sous la clé `gbl-session` | Permet à l'agent de ne pas se reconnecter à chaque page, tout en gardant la session vérifiable côté backend. |
| Garde de route `RequireAuth` | Toute route sauf `/login` exige une session | Empêche qu'on accède au dashboard ou aux données client sans être identifié. |
| Déconnexion automatique sur 401 | Si le JWT expire, l'agent est renvoyé au login | Évite les écrans gelés sur données périmées. |
| Compte de démo | `agent@camtel.cm` / `demo1234` | Permet de tester sans configurer d'AD/LDAP. En production, ce compte serait désactivé. |

**Compte de démonstration** : `agent@camtel.cm` / `demo1234` (utilisateur « Diane Mbarga », rôle `AGENT`).

---

## 4. Tableau de bord

**Fichier clé** : `frontend/src/features/dashboard/dashboard-page.tsx`

C'est la page d'atterrissage. Le rôle d'un tableau de bord dans ce contexte : donner en **un coup d'œil** l'état du portefeuille, sans avoir à ouvrir 50 fichiers Excel.

### 4.1 Ce que l'agent y voit

| Élément | Source de données | Plus-value métier |
|---|---|---|
| 6 KPIs en grille | Vues SQL `vw_globale_portefeuille` et compagnie | « Voir juste » : nombre de comptes, encours total, créances impayées, créances payées, taux de recouvrement, solde négatif. |
| Filtres en cascade (Centre → Agence) | Tables `CENTRE` et `AGENCE` | Un responsable de centre à Yaoundé ne s'occupe pas de ce qui se passe à Maroua. Les filtres permettent de **restreindre la vue à son périmètre**. |
| Filtre Mois | Vue SQL qui agrège par mois | Pour comparer juillet 2026 à juin 2026, et détecter les dérives. |
| Courbe d'évolution de la dette vs encaissements | Vue SQL `vw_evolution_mensuelle` | Visualiser si la tendance s'améliore ou se dégrade. |
| Top 20 clients les plus endettés | Vue SQL `vw_impayes_critiques` | Cibler en priorité les dossiers à plus gros enjeu financier. C'est la **« prochaine action »** rendue visible. |
| Top 20 dettes CAMTEL (soldes négatifs) | Vue SQL `vw_clients_balance_negative` | Détecter les cas anormaux où CAMTEL a versé plus que facturé — utile pour les audits internes. |

### 4.2 Détail technique interessant

- Chaque ligne du Top 20 est un *hyperlien* : un clic amène l'agent sur la fiche du client avec un focus pré-positionné sur l'onglet « Créances » ou « Comptes ». On évite de perdre l'utilisateur.
- Les KPIs sont sensibles : `solde_negatif` est volontairement agrégé à part pour ne pas être confondu avec l'encours.
- Un badge `FILTRÉ` apparaît dès qu'un filtre est actif — c'est un *engage* de transparence pour que l'agent ne lise pas un chiffre global en pensant qu'il est local.

---

## 5. Clients : recherche, liste, fiche

**Fichiers clés** : `frontend/src/features/customers/clients-page.tsx`, `customer-detail-page.tsx`, route `GET /clients/list` (vue agrégée)

### 5.1 Liste des clients (`/clients`)

| Élément | Plus-value |
|---|---|
| Recherche par mot-clé (raison sociale, code client, marché) | Avant : Ctrl+F dans un Excel de 50 000 lignes. Maintenant : résultats en moins d'une seconde. |
| Filtres : Marché, Statut facturation, Centre, Agence | Permettent de **scoper** son travail. Un agent du marché « PRO » (professionnels) ne regarde pas les « PTT ». |
| Priorité calculée (Urgent / À traiter / OK) | Tri visuel : on voit immédiatement qui a le plus de dettes. |
| Export CSV | Pour transmettre une liste à un collègue ou à un manager qui n'a pas accès à la plateforme. |
| Création de client (modale) | Cas rare, mais nécessaire quand un client apparaît dans l'Excel sans avoir encore été créé en base. |

**Point technique subtil** : la liste interroge l'endpoint agrégé `/clients/list` qui fait **une seule requête SQL** (pas de N+1). C'est un choix de performance important quand on a 47 000 clients.

### 5.2 Fiche client (`/clients/:id`)

C'est la **vue 360°**, le cœur fonctionnel de la promesse produit. Onglets :

| Onglet | Contenu | Plus-value |
|---|---|---|
| Résumé | Identité, contacts, encours, risque calculé, courbes | « Comprendre vite » — d'un coup d'œil on sait si le dossier est sain ou non. |
| Comptes | Liste des comptes rattachés au client (un client peut avoir plusieurs lignes chez CAMTEL) | Vue d'ensemble du périmètre client. |
| Factures | Toutes les factures du client, avec statut dérivé (Impayée / Payée) | Suivi de la facturation mois par mois. |
| Paiements | Vide explicite | Cf. §1.2 — le fichier source n'a pas de paiements. |
| Créances | Factures non soldées, avec ancienneté (bucket 0-30j, 31-60j, etc.) | C'est ici qu'on calcule l'urgence d'agir. |
| Historique | Toutes les actions de recouvrement passées sur ce client | Traçabilité : on voit qui a fait quoi, quand. |

**Calcul du risque** (encart dans le résumé) : un *score* simple (Élevé / Moyen / Faible) est dérivé de l'ancienneté des créances et de leur montant. Pas d'IA, juste de la logique métier transparente.

---

## 6. Factures, Paiements, Créances

**Fichiers clés** : `invoices-page.tsx`, `payments-page.tsx`, `receivables-page.tsx`

Ce sont les **3 tables transactionnelles** du système.

### 6.1 Factures (`/factures`)

- **Source** : 14 colonnes mensuelles de l'Excel (Déc 2025 → Juin 2026) sont *dépliées* (`pd.melt` dans `load_fast.py`) en une ligne par mois par compte. Une facture = un mois de facturation pour un compte.
- **Plus-value** : on peut filtrer par compte, statut, période ; on voit le statut dérivé (`Impayée` si `outstanding_amount > 0`).
- **Identifiant** : `FAC_{num_compte}_{libellé_période}`. Cela permet de réimporter le même mois sans créer de doublons (`ON CONFLICT DO NOTHING`).

### 6.2 Paiements (`/paiements`)

- **État actuel** : page fonctionnelle mais vide par construction.
- **Plus-value future** : lorsque CAMTEL fournira un fichier de paiements (ou une intégration temps réel), cette page deviendra centrale pour rapprocher les paiements des factures.

### 6.3 Créances (`/creances`)

- **Concept** : une créance = une facture non soldée. C'est une *vue dérivée*, pas une table.
- **Plus-value** : permet de prioriser les actions par ancienneté et par montant. Un agent voit immédiatement quels sont les comptes à appeler en premier.

---

## 7. Imports Excel

**Fichiers clés** : `frontend/src/features/imports/imports-page.tsx`, `backend/app/api/v1/imports.py`, `database/load_fast.py`

C'est **la** fonctionnalité « pivot » : sans import, pas de données, pas de dashboard.

### 7.1 Le pipeline complet

```
┌─────────────────────┐     ┌────────────────────┐     ┌─────────────────┐
│ 1. Utilisateur      │     │ 2. Validation      │     │ 3. Insertion    │
│ drag&drop le .xlsx  │ ──▶ │ format/taille      │ ──▶ │ batchée en base │
└─────────────────────┘     └────────────────────┘     └─────────────────┘
                                       │                         │
                                       ▼                         ▼
                              ┌─────────────────┐      ┌──────────────────┐
                              │ 4. Rapport de   │      │ 5. Vue SQL       │
                              │ rejets par lot  │      │ recalculée auto  │
                              └─────────────────┘      └──────────────────┘
```

### 7.2 Côté frontend (page d'import)

| Élément | Plus-value |
|---|---|
| **Stepper** en 3 étapes (choix du type → upload → résultat) | Guidage pas-à-pas pour un utilisateur non technique. |
| **Templates CSV** téléchargeables localement | L'utilisateur n'a pas à deviner les colonnes. Le modèle côté front reproduit les 44 colonnes Excel (séparateur `;`). |
| **Drag & drop** de fichier | Ergonomie moderne, plus naturelle qu'un bouton « Parcourir ». |
| **Génération d'une clé d'idempotence** (`X-Idempotency-Key`) | Permet de renvoyer le même import sans créer de doublons. C'est ce qui rend l'import *résilient*. |
| **Tableau de rejets** (ligne, colonne, valeur, motif) | Si une ligne est invalide, l'agent voit précisément quoi corriger. |
| **Historique des lots d'import** | Traçabilité : qui a importé quoi, quand, avec quel résultat. |

### 7.3 Côté backend (`/imports`)

| Endpoint | Rôle |
|---|---|
| `POST /imports` | Démarre un import (multipart, avec `X-Idempotency-Key` requis) |
| `GET /imports` | Liste paginée des lots d'import |
| `GET /imports/:batch_id` | Détail d'un lot |
| `GET /imports/:batch_id/errors` | Erreurs d'un lot (rejets) |
| `DELETE /imports/:batch_id` | Annulation |
| `GET /imports/templates` | *(Stub — renvoie 501)* Téléchargement d'un modèle Excel serveur |
| `GET /imports/count` | Compteur rapide pour le dashboard admin |

### 7.4 Côté base de données (le script de chargement)

`database/load_fast.py` est **le** script qui transforme l'Excel en base relationnelle :

1. **Lecture du fichier** avec `pandas`
2. **Nettoyage** des colonnes (trim, normalisation des téléphones, des statuts)
3. **Insertion par lots** (batch de 2 000 lignes) avec `ON CONFLICT DO NOTHING` → **idempotent** : on peut relancer sans tout casser
4. **Mapping intelligent** des 14 colonnes mensuelles en factures individuelles
5. **Création automatique** du compte de démo `agent@camtel.cm` avec son rôle `AGENT`

**Plus-value de ce script** : sans lui, l'Excel reste un fichier plat inexploitable. Avec lui, les 51 789 lignes deviennent 6 tables relationnelles requêtables, et toutes les vues SQL peuvent être recalculées en cascade.

> 💡 **Quand tu toucheras à l'import** : assure-toi de toujours préserver l'idempotence (`ON CONFLICT DO NOTHING` sur les clés naturelles) et de nettoyer les valeurs avant insertion. Le script `load_fast.py` est ton modèle de référence.

---

## 8. Administration

**Fichier clé** : `frontend/src/features/administration/administration-page.tsx`

Cette page est une **vue lecture** sur les référentiels organisationnels :

- **Centres** (ex. `MC-LITTORAL`, `MC-CENTRE`…)
- **Agences** (~180 agences CAMTEL réparties dans les centres)
- **Gestionnaires** (les agents de recouvrement eux-mêmes)

### Plus-value

- Un responsable de centre peut voir d'un coup d'œil combien d'agences il supervise, combien de gestionnaires y sont rattachés, et la volumétrie de leur portefeuille.
- C'est aussi un **point d'entrée de la qualité des données** : si une agence a trop de clients « Non identifiés », c'est un signal.

### Notes d'implémentation

- L'endpoint `getCentresAgencesReport` synthétise le nombre d'agences par centre (rapport `centres-agences`).
- L'endpoint `getGestionnairesReport` donne la volumétrie par gestionnaire (utile pour équilibrer les charges).
- Le mode est en *lecture seule* pour le MVP — la création/modification de référentiels est *out of scope* (cf. `PRODUCT.md` § Capabilities and Constraints).

---

## 9. Sécurité & habilitations (squelette)

**Fichiers** : `backend/app/api/v1/auth.py`, `routes.py` (section `/users`)

Le système implémente les **briques minimales** d'un RBAC (Role-Based Access Control) :

| Élément | État |
|---|---|
| Authentification JWT (access + refresh) | ✅ Implémenté |
| Table `ROLES` + table `ROLE_PERMISSIONS` + table `USER_ROLES` | ✅ Schéma en place |
| Permissions par code (string) | ✅ Modèle prêt |
| Vérification des permissions par endpoint | ⚠️ Partiel — `get_current_user` est branché, le filtrage par périmètre (centre/agence) reste à généraliser |
| Gestion des utilisateurs (CRUD) | ✅ Endpoints `GET/POST/PATCH/DELETE /users` en place |
| Journal d'audit (`AUDIT_EVENTS`) | ✅ Table existe, endpoint `/admin/audit` exposé |

### Plus-value

Même en mode démo, la plateforme *prépare* le terrain pour un vrai déploiement : séparation claire des rôles, table d'audit, traçabilité. C'est un engagement pris dans le TRD et le PRD pour qu'on n'ait pas à tout refaire le jour où CAMTEL demandera une vraie gestion des accès.

---

## 10. Backend : architecture des routes

**Fichier central** : `backend/app/api/v1/routes.py`

Les routes sont organisées en **sous-routers** par domaine métier :

| Sous-router | Préfixe | Endpoints | État |
|---|---|---|---|
| `auth` | `/auth` | login, logout, refresh, change-password, forgot/reset | ✅ Complet |
| `organization` | `/centres`, `/agencies`, `/managers`, `/organizations/hierarchy` | CRUD référentiels | ✅ Complet |
| `clients` | `/clients`, `/clients/:id`, `/clients/:id/{summary,accounts,invoices,payments,history}`, `/clients/merge` | Vue 360° | ✅ Complet |
| `finance` | `/accounts`, `/invoices`, `/payments`, `/allocations` | Comptes & transactions | ⚠️ Squelette — schémas OK, logique CRUD partielle |
| `recouvrement` | `/collection-actions`, `/promises` | Workflow recouvrement | ⚠️ Squelette |
| `imports` | `/imports` | Pipeline import Excel | ✅ Couvert (templates Excel = 501) |
| `reports` | `/reports/*` | Rapports spécialisés | ✅ Connecté aux vues SQL |
| `admin` | `/admin/*` | Qualité données, audit, nettoyage | ✅ Connecté aux vues SQL |
| `services` | `/services` | Référentiel types de service | ✅ Complet |
| `users` | `/users` | Gestion utilisateurs | ✅ Complet |

> 💡 **Pour ajouter une fonctionnalité** : regarde d'abord dans quel sous-router elle se loge naturellement. Si tu ajoutes un endpoint `/clients/:id/contracts` par exemple, c'est dans `clients.py`. Cette organisation par domaine est précieuse — respecte-la.

---

## 11. Vues SQL : la puissance cachée du système

**Fichier** : `database/views.sql` (~58 Ko, ~40 vues)

Ce fichier est **l'un des actifs les plus précieux** du projet. Chaque vue est une requête SQL « métier » qui répond à une question récurrente :

| Vue | Question métier à laquelle elle répond |
|---|---|
| `vw_globale_portefeuille` | Quel est l'état global du portefeuille ce mois-ci ? |
| `vw_impayes_critiques` | Quels clients ont le plus d'impayés ? |
| `vw_evolution_mensuelle` | Comment évolue la dette mois par mois ? |
| `vw_performance_gestionnaires` | Quel gestionnaire récupère le mieux ses créances ? |
| `vw_cartographie_clients` | Combien de clients par marché / par centre ? |
| `vw_aging_impayes` | Quelle est l'ancienneté moyenne des impayés ? |
| `vw_clients_balance_negative` | Quels comptes ont un solde anormalement négatif ? |
| `vw_doublons_potentiels` | Y a-t-il des clients présents deux fois ? |
| `vw_comptes_orphelins` | Des comptes sans client valide ? |
| `vw_ebill_adoption` | Quelle part des clients a adhéré à la e-facture ? |
| `vw_qualite_identification` | Combien de clients sont correctement identifiés ? |
| `vw_indice_fragilite` | Quel client est à risque de ne pas payer ? |
| `vw_comptes_zombies` | Quels comptes sont inactifs depuis longtemps ? |
| `vw_score_effort_recouvrement` | Sur quel client l'effort de recouvrement est-il rentable ? |
| `vw_prediction_passage_impaye` | Quelle facture a le plus de chances de devenir impayée ? |
| … | *(~25 autres vues spécialisées)* |

**Plus-value** : sans ces vues, chaque écran serait un calcul JavaScript redondant (ou une requête SQL réécrite 10 fois). Avec elles, le backend sert des données déjà agrégées et cohérentes entre tous les écrans. **Si on te demande un nouvel indicateur**, commence par regarder si une vue existe ou peut être dérivée.

---

## 12. Conventions de code (pour t'y retrouver)

- **Frontend** : TypeScript strict, React 19, Tailwind, composants UI dans `components/ui/`, pages dans `features/<domaine>/`. Chaque page a son propre fichier et est branchée dans `App.tsx`.
- **Backend** : FastAPI en async partout, SQLAlchemy 2.0, schémas Pydantic dans `schemas.py`, logique CRUD dans `crud.py`, routes dans `api/v1/<domaine>.py`.
- **Erreurs** : une `ApiError` typée est levée côté front, normalisée depuis le format `{ error: { code, message, details } }`.
- **Auth** : header `Authorization: Bearer <JWT>` + header `X-Request-ID` pour la corrélation.
- **Langue UI** : français professionnel. Pas d'anglais dans les libellés utilisateurs.
- **Devise** : FCFA (formatée via `xaf()` dans `lib/format.ts`).

---

## 13. Ce qui est « fini », ce qui est « en cours », ce qui est « à faire »

### ✅ Fini (ou quasi-fini)
- Authentification, session, RBAC squelette
- Dashboard avec KPIs et tops
- Liste clients + fiche client 360°
- Liste factures (avec statut dérivé)
- Liste créances (vue agrégée)
- Pipeline d'import (UI + backend + chargement initial)
- Référentiels organisationnels (centres, agences, gestionnaires)
- 40+ vues SQL couvrant les analyses courantes

### ⚠️ Squelette / partiel
- Page Paiements (volontairement vide, en attente de source de données)
- CRUD finance (comptes, factures, paiements) côté backend
- Workflow recouvrement (collection actions, promesses)
- Téléchargement du modèle Excel serveur (`/imports/templates` → 501)
- Quelques KPIs dérivés (« Créances payées », « Taux de recouvrement ») qui valent 0 tant que les paiements ne sont pas source

### 🟡 Documenté comme « à faire »
- Enrichissement du schéma (colonnes Type, Tax, Cycle, Model de control, Credit Limit, Contact, Adresse, Code postal — cf. `PROMPT_ALIGNEMENT_DONNEES_EXCEL.md` §3)
- Migration Alembic dédiée aux vues SQL
- Variables d'environnement `SECRET_KEY`, `CORS_ORIGINS`, `LOG_LEVEL`

---

## 14. Quand on te demandera d'ajouter une fonctionnalité

Voici une checklist douce pour ne pas te perdre :

1. **Lis d'abord ce document** pour voir si quelque chose de proche existe déjà.
2. **Cherche dans `docs/`** (`PRODUCT.md`, `GBLContext.md`, `TRD officiel.md`) si la fonctionnalité est déjà spécifiée.
3. **Ouvre `PROMPT_ALIGNEMENT_DONNEES_EXCEL.md`** pour vérifier que ce que tu veux faire est cohérent avec les colonnes réelles de l'Excel.
4. **Regarde si une vue SQL existe** (`database/views.sql`). Si oui, ton nouveau endpoint n'a qu'à la projeter. Sinon, écris-en une.
5. **Choisis ton domaine** : ça va dans `frontend/src/features/<domaine>/` et `backend/app/api/v1/<domaine>.py`.
6. **Ne casse pas l'idempotence de l'import** : si tu touches au schéma, propose une migration Alembic.
7. **Pense à la langue** : les libellés utilisateur sont en français.

---

## 15. Glossaire express

- **Revenue Assurance** : discipline qui consiste à s'assurer qu'une entreprise facture et encaisse tout ce qu'elle devrait. C'est le métier que la plateforme sert.
- **Centre de gestion** : unité territoriale CAMTEL (ex. `MC-LITTORAL`, `MC-DOUALA`).
- **Agence** : sous-structure d'un centre (ex. `AGENCE AKWA NORD`).
- **Gestionnaire** : l'agent CAMTEL qui suit un portefeuille de clients.
- **Portefeuille** : l'ensemble des clients suivis par un gestionnaire.
- **Périmètre** : la combinaison centre + agence + gestionnaire que l'utilisateur a le droit de voir.
- **Créance** : une facture émise mais non payée.
- **Ancienneté (aging)** : nombre de jours depuis l'émission d'une facture impayée.
- **Idempotence** : propriété d'un import qui peut être exécuté plusieurs fois sans créer de doublons.
- **Rejet** : ligne d'un import qui n'a pas pu être insérée (format invalide, valeur hors limite, etc.).
- **Vues SQL** : requêtes pré-écrites que la base exécute comme si elles étaient des tables — utilisées partout dans le projet pour les rapports.

---

*Document rédigé pour l'accueil d'un nouveau membre sur le projet. Si quelque chose te paraît inexact, c'est un signe qu'il faut enrichir ce document — la vérité est dans le code et dans l'Excel, pas ici.*
