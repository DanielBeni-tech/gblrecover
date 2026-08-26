# PROMPT D'ALIGNEMENT — GBLRecover ↔ Fichier Excel réel

> **Source de vérité** : `database/GBL - Juillet 2026.xlsx` — **51 789 lignes, 44 colonnes**.
> Ce document est un **prompt prêt à l'emploi** pour faire corriger par un agent de
> codage toutes les pages, données, fonctionnalités, KPI, filtres et boutons qui ne
> correspondent pas au fichier Excel.
>
> Contexte d'exécution : base PostgreSQL locale `gblrecover` (port 5433) déjà chargée
> via `python3 database/load_fast.py`. Stack : FastAPI + SQLAlchemy async (backend) /
> React 19 + TanStack Query + Tailwind (frontend `frontend/src/`).

---

## 1. Colonnes réelles du fichier Excel (référence absolue)

| # | Colonne Excel | Champ DB associé | Chargé en base ? |
|---|---|---|---|
| 1 | Compte | `compte.num_compte` | ✅ |
| 2 | Marché | `compte/client.marche` | ✅ |
| 3 | Code client | `client.code_client` | ✅ |
| 4 | E-Bill | `compte.e_bill` | ✅ |
| 5 | Raison sociale | `client.raison_sociale` | ✅ |
| 6 | Centre gestion | `agence.nom_centre` | ✅ |
| 7 | Agence | `agence.nom_agence` | ✅ |
| 8 | Mat. Gestionnaire | `gestionnaire.mat_gestionnaire` | ✅ |
| 9 | Gestionnaire | `gestionnaire.nom_gestionnaire` | ✅ |
| 10 | Identification | `compte.identification` | ✅ |
| 11-18 | LS, Vobb, FTTx, TV, Tel, ADSL, Mobile, Autres | services par compte (`souscrire`) | ⚠️ partiel |
| 19-32 | « Décembre Facture 2025 » … « Juin Impayés 2026 » (14 col.) | `facture` (une ligne par mois) | ✅ |
| 33 | Balance | `compte.balance` | ✅ |
| 34 | Facturation | `compte.statut_facturation` (« Arrêt », « En cours ») | ✅ |
| 35 | Type | non mappé (« Postpaid ») | ❌ |
| 36 | Tax | non mappé | ❌ |
| 37 | Cycle | non mappé (1.0) | ❌ |
| 38 | Model de control | non mappé (« Credit Control by Bill Cycle ») | ❌ |
| 39 | Credit Limit | non mappé (99999999) | ❌ |
| 40 | Indv à contacter | non mappé | ❌ |
| 41 | Contact | non mappé (téléphone réel) | ❌ |
| 42 | Adresse | non mappé | ❌ |
| 43 | Code postal | non mappé | ❌ |
| 44 | Email | `client.email` | ✅ |

**Règles métier constatées** :
- `Raison sociale` = identité du client (PE/PME/grand compte). Jamais de « client fictif ».
- `Centre gestion` ∈ {MC-LITTORAL, MC-CENTRE, MC-DOUALA, MC-SUD, MC-OUEST, MC-ADAMAOUA, …}.
- `Agence` = nom lisible ; en base `agence.id_agence` = « AG_ » + `nom_agence` (clé de jointure).
- `Facturation` = statut du compte (« Arrêt » / « En cours ») ; l'Excel ne contient **pas** de statut « ACTIVE/BLOCKED ».
- L'Excel ne contient **pas de paiements** : la page Paiements restera vide si aucune source de paiements n'est intégrée.
- Les 14 colonnes mensuelles représentent **6 mois** (Déc 2025 → Juin 2026) : une facture
  `FAC_{compte}_{libellé période}` par mois, `date_emission` au 1er du mois, `outstanding_amount` = Impayés du mois.
---

## 2. Écarts constatés et corrections demandées (page par page)

### 2.1 Tableau de bord — `frontend/src/features/dashboard/dashboard-page.tsx`
- [ ] **Mois** : `AVAILABLE_MONTHS` codé en dur ({2026-06-01 … 2025-12-01}). Le dériver depuis les mois réels de `facture.date_emission`, avec « Tous les mois » par défaut.
- [ ] **KPI « Créances payées »** : `total_paye_mois` vaut toujours 0 car l'Excel n'a pas de paiements → redéfinir **« payé » = facturé − impayé** sur le mois, ou le retirer tant que les paiements ne sont pas sources.
- [ ] **KPI « Taux de recouvrement »** : vaut 0 → recalculer avec la convention (Facturé − Impayé)/Facturé sur le mois, sinon le masquer.
- [ ] **Filtre agences** : ✅ corrigé (envoie `id_agence`, liste restreinte aux centres choisis). Conserver le mapping **affiché = `nom_agence`**, **transmis = `id_agence`** (fait via `getLabel`).
- [ ] **Top 10 dettes CAMTEL** : afficher le **nom de l'agence** (`nom_agence`) via jointure au lieu de `id_agence`, et le **centre**.
- [ ] **Nom des centres** : les vrais noms sont `MC-LITTORAL`, `MC-DOUALA`… (pas « DOUALA » seul) → exposer `nom_centre` complet.

### 2.2 Clients — `frontend/src/features/customers/clients-page.tsx`
- [ ] **Type client** : l'Excel n'a pas « entreprise/état/particulier » → dériver l'affichage de la Raison sociale / Marché, ne pas inventer de valeur.
- [ ] **Statut** : remplacer `status` fictif par `statut_facturation` (« Arrêt »/« En cours ») ou `identification`.
- [ ] **Filtres** : aligner sur les vrais libellés : Centre = `Centre gestion`, Agence = `nom_agence`, Gestionnaire = `nom_gestionnaire`, Marché = `marche`.
- [ ] **Export CSV** : en-têtes/colonnes réels (code_client, raison_sociale, marche, email, tel, centre, agence, balance).
### 2.3 Fiche client — `frontend/src/features/customers/customer-detail-page.tsx`
- [ ] `customer.name` = `raison_sociale` ; `customer.agency` = `nom_agence` ; `customer.center` = `nom_centre`.
- [ ] Ajouter les contacts réels : Email (colonne Email), Téléphone (Contact/Tel), Adresse (colonne Adresse) après chargement.
- [ ] Afficher Marché, E-Bill, Identification, Statut facturation dans le résumé.
- [ ] Onglet Comptes : `num_compte`, afficher `nom_agence`, `balance`, `e_bill`, `statut_facturation`.
- [ ] Onglet Factures/Créances : refléter `date_emission` (1er du mois) et `outstanding_amount` réel.
- [ ] Onglet Paiements/Historique : vide explicite (aucune donnée de paiement).

### 2.4 Factures — `frontend/src/features/invoices/invoices-page.tsx`
- [ ] Les statuts affichés ne correspondent pas : en base `status='OPEN'` → afficher « Impayée » si `outstanding_amount > 0`, « Payée » sinon.
- [ ] `date_echeance` absente de l'Excel → afficher **période/libellé** et `date_emission`.
- [ ] Recherche par numéro de compte réel et par client.

### 2.5 Paiements — `frontend/src/features/payments/payments-page.tsx`
- [ ] Table `paiement` vide (l'Excel n'a pas de paiements) → Option A : bandeau explicite. Option B : intégrer une source de paiements si elle existe. **Ne jamais afficher de données fictives.**

### 2.6 Créances — `frontend/src/features/receivables/receivables-page.tsx`
- [ ] Remplacer l'agrégation JS (100 clients) par un **endpoint backend** reposant sur `vw_impayes_critiques` / `vw_globale_portefeuille`.
- [ ] Recherche/statut dérivés de `outstanding_amount` et de l'âge réel.

### 2.7 Administration — `frontend/src/features/administration/administration-page.tsx`
- [ ] Vérifier le mapping des colonnes des rapports (`centres-agences`, `gestionnaires`) avec les noms des vues (ex. `nb_agences`, `total_dossiers`, `total_balance_fcfa`, …).
- [ ] Afficher vrais codes (`MC-LITTORAL`, `AG_…`) avec libellés lisibles.

### 2.8 Imports — `frontend/src/features/imports/imports-page.tsx`
- [ ] Templates CSV codés en dur (endpoint `/imports/templates` en 501) → utiliser les vraies colonnes Excel dans les modèles (voir §1).
- [ ] L'import doit accepter un fichier conforme aux colonnes Excel (Compte, Code client, Raison sociale, Centre gestion, Agence, Mat. Gestionnaire, Gestionnaire, Marché, Balance, Facturation, Identification, colonnes mensuelles…).

---

## 3. Améliorations backend / schéma

- [ ] **Migration Alembic** `0003` pour ajouter les colonnes non chargées : `type_abonnement`, `tax`, `cycle`, `modele_controle`, `credit_limit`, `contact`, `adresse`, `code_postal` (compte/client).
- [ ] Enrichir `database/load_fast.py` / `load_v2.py` pour charger ces colonnes.
- [ ] Implémenter l'endpoint backend `/receivables` (liste paginée + filtres centre/agence/mois).
- [ ] Revoir `total_paye_mois` / `taux_recouvrement` : sans fichier de paiements, calculer « facturé − impayé » pour le mois.
- [ ] Garantir que les vues `/reports/*` et `/dashboards/*` joignent `agence.nom_agence` pour l'affichage.

---

## 4. Critères d'acceptation (checks finaux)

- [ ] Connexion `agent@camtel.cm / demo1234` fonctionne ; aucune donnée « fictive » visible.
- [ ] Dashboard : KPIs cohérents (18 centres, 179 agences, ~50 606 comptes, ~293 500 factures) ; centre → restreint le filtre agence ; agence → change les résultats.
- [ ] Liste clients : 47 719 clients réels, colonnes conformes à l'Excel.
- [ ] Factures : ~293 500 factures réelles, montants conformes.
- [ ] Paiements : état explicite « aucune donnée de paiement ».
- [ ] Créances : alimentée par une vue réelle, filtrable.
- [ ] Aucun `id_agence` brut affiché : toujours `nom_agence`.
- [ ] `npx tsc --noEmit` et `pytest` passent.