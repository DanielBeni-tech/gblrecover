# Plan de refonte de la page « Administration » → « Référentiels »

> **Statut** : prêt à implémenter
> **Portée** : frontend uniquement (pas de changement backend, sauf si on en décide autrement)
> **Effort estimé** : 1h de code + 15 min de test
> **Auteur** : toi (stagiaire) avec accompagnement Claude

---

## 0. Contexte et motivation

### Pourquoi cette refonte

La page actuelle `/administration` a 3 problèmes majeurs :

1. **C'est un annuaire plat, pas un outil** : 3 listes (centres, agences, gestionnaires) sans interaction. Aucune recherche, aucun tri, aucun drill-down. Avec 180 agences et 500 gestionnaires, c'est inutilisable.
2. **Le label « Administration » est trompeur** : on s'attend à y trouver la gestion des utilisateurs, rôles, permissions. Or on y trouve des référentiels métier. C'est le **persona 12.5** (`GBLContext.md`) qui devrait avoir une page « Administration » — pas le persona 12.1.
3. **Aucune valeur décisionnelle** : aucun KPI, aucune alerte, aucun indicateur de santé. L'utilisateur voit des listes brutes sans savoir quoi en faire.

### Ce qu'on veut à la place

Une page **« Référentiels »** claire, qui aide vraiment l'admin fonctionnel à :
- Comprendre la structure organisationnelle d'un coup d'œil (KPIs)
- Retrouver un centre/une agence/un agent en 3 secondes (recherche + tri)
- Naviguer dans la hiérarchie centre → agence → gestionnaire (drill-down)
- Voir l'encours et la charge par gestionnaire (enrichissement)

### Décision de renommage

**On renomme complètement** :
- Sidebar : « Administration » → **« Référentiels »**
- Route : `/administration` → **`/referentiels`**
- Composant : `AdministrationPage` → **`ReferentielsPage`**
- Dossier : `features/administration/` → **`features/referentiels/`**
- Titre de la page : « Référentiels organisationnels »

> ⚠️ **Risque de casse** : toute personne qui a bookmarké `/administration` tombera sur une 404. C'est un choix assumé. On ajoute une **redirection** `/administration` → `/referentiels` pour la过渡 (过渡 = transition).

---

## 1. Nouvelle structure de la page

### Layout général

```
┌────────────────────────────────────────────────────────────────┐
│  PageHeader : Référentiels organisationnels                    │
│  Sous-titre : "Vue d'ensemble et navigation..."                │
├────────────────────────────────────────────────────────────────┤
│  [KPI 1]   [KPI 2]   [KPI 3]   [KPI 4]   [KPI 5]              │ ← nouvelle ligne
│  Centres   Agences   Gest.     Clients    Comptes              │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌─────────────────────────────┐   │
│  │ Centres              │  │ Agences (filtrées si clic)  │   │
│  │ [🔍 recherche...]    │  │ [🔍 recherche...]            │   │
│  │ [↑↓] Centre | Agences│  │ [↑↓] Agence | Centre        │   │
│  │ ...                  │  │ ...                         │   │
│  └──────────────────────┘  └─────────────────────────────┘   │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐     │
│  │ Gestionnaires (filtrés si clic sur agence/centre)   │     │
│  │ [🔍 recherche...]                                    │     │
│  │ [↑↓] Nom | Matricule | Agence | Centre | Comptes | Encours ││
│  │ ...                                                  │     │
│  └──────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────┘
```

### Comportement du drill-down

| Action | Résultat |
|---|---|
| Clic sur un centre dans le tableau « Centres » | La liste « Agences » se filtre automatiquement sur ce centre. Un badge apparaît : « Filtré par : MC-LITTORAL [✕] » |
| Clic sur une agence dans le tableau « Agences » | La liste « Gestionnaires » se filtre sur cette agence. Un badge apparaît : « Filtré par : AGENCE AKWA NORD [✕] » |
| Bouton « Réinitialiser » | Supprime tous les filtres |

> Le clic **sélectionne** sans naviguer. Pour vraiment voir le détail, on pourrait plus tard ajouter une vraie page « Fiche centre » / « Fiche agence » / « Fiche gestionnaire ». Pour cette V1, le drill-down par filtrage est suffisant.

---

## 2. Détail des sections

### 2.1 Bandeau de KPIs (5 tuiles)

| Tuile | Valeur affichée | Source |
|---|---|---|
| **Centres** | Nombre de centres de gestion (ex. 18) | `GET /centres` → longueur du tableau |
| **Agences** | Nombre d'agences (ex. 179) | `GET /agencies` → longueur du tableau |
| **Gestionnaires** | Nombre de gestionnaires (ex. 500) | `GET /managers` → longueur du tableau |
| **Clients** | Nombre de clients (ex. 47 719) | `GET /clients/count` → total |
| **Comptes** | Nombre de comptes (ex. 50 606) | À dériver de `listClientsAggregated` ou nouveau endpoint |

> 💡 Si l'endpoint compte n'existe pas, on l'ajoute. Sinon, on lit la longueur d'un échantillon représentatif (pas tout, ce serait trop lent).

**Composant réutilisé** : `KpiCard` (existe déjà dans `components/ui/kpi-card.tsx`).

### 2.2 Tableau « Centres de gestion »

**Colonnes** :
- Centre (avec icône bâtiment)
- Agences (nombre)
- Clients (nombre — nouveau !)
- Comptes (nombre — nouveau !)

**Fonctionnalités** :
- 🔍 Recherche en haut du tableau (filtre sur le nom)
- ↑↓ Tri par colonne (clic sur l'en-tête)
- Sélection de ligne (fond bleu) pour drill-down

### 2.3 Tableau « Agences »

**Colonnes** :
- Agence
- Centre (parent)
- Nb gestionnaires
- Nb comptes

**Fonctionnalités** :
- 🔍 Recherche
- ↑↓ Tri
- Sélection → filtre le tableau « Gestionnaires » en dessous

### 2.4 Tableau « Gestionnaires »

**Colonnes** :
- Nom (avec avatar)
- Matricule
- Agence
- Centre
- Comptes (workload)
- Encours géré (en FCFA, nouveau !)
- Contact (email ou tél)

**Fonctionnalités** :
- 🔍 Recherche
- ↑↓ Tri par toutes les colonnes
- (Plus tard) clic sur le nom → fiche gestionnaire

---

## 3. Sources de données (backend)

### Endpoints existants (réutilisés)
| Endpoint | Usage |
|---|---|
| `GET /centres` | Liste des centres |
| `GET /agencies?centre_id=X` | Liste des agences, filtrables par centre |
| `GET /managers?agency_id=X` | Liste des gestionnaires, filtrables par agence |
| `GET /clients/count` | Nombre total de clients |
| `GET /reports/centres-agences` | Volumétrie par centre |
| `GET /reports/gestionnaires` | Volumétrie par gestionnaire (workload, encours) |

### Endpoints à créer ou vérifier
| Endpoint | Statut | Besoin |
|---|---|---|
| `GET /centres/:id/stats` | ⚠️ À vérifier | Nb clients/comptes/agences par centre |
| `GET /agencies/:id/stats` | ⚠️ À vérifier | Nb gestionnaires/comptes par agence |
| `GET /centres/:id/agencies` | ❓ À voir | Si pas déjà couvert par `?centre_id=` |
| `GET /managers/:id/encours` | ⚠️ À dériver | Somme des balances des comptes du gestionnaire |

> 💡 Avant de créer de nouveaux endpoints, je vais vérifier ce que `vw_analyse_centres_agences` et `vw_performance_gestionnaires` retournent. Si elles ont déjà les colonnes, c'est gratuit.

---

## 4. Fichiers à modifier

### Fichiers supprimés (ou vidés puis supprimés après migration)
- `frontend/src/features/administration/administration-page.tsx` (sera déplacé)

### Fichiers créés
- `frontend/src/features/referentiels/referentiels-page.tsx` (nouvelle page)
- (Optionnel) `frontend/src/features/referentiels/components/kpi-band.tsx` (la bande de KPIs)
- (Optionnel) `frontend/src/features/referentiels/components/filterable-table.tsx` (composant tableau avec recherche/tri)

### Fichiers modifiés
- `frontend/src/App.tsx` : changer l'import + la route
- `frontend/src/components/layout/sidebar.tsx` : changer le label + l'icône + la route
- `frontend/src/components/layout/topbar.tsx` : changer le breadcrumb

### Fichiers à vérifier (peut-être impactés)
- D'autres pages qui font un lien vers `/administration` ? Probablement pas, mais à grepper.
- Documentation qui mentionne « Administration » : on mettra à jour `docs/AUDIT_FONCTIONNALITES.md` et `docs/PERSONA_RESPONSABLE_RA.md`.

---

## 5. Étapes d'implémentation (ordre recommandé)

### Étape 1 — Préparer le terrain (5 min)
- [ ] Créer le dossier `frontend/src/features/referentiels/`
- [ ] Copier le contenu actuel de `administration-page.tsx` vers `referentiels-page.tsx`
- [ ] Renommer le composant `AdministrationPage` → `ReferentielsPage`

### Étape 2 — Bandeau de KPIs (30 min)
- [ ] Ajouter 5 tuiles `KpiCard` en haut
- [ ] Câbler sur les endpoints existants
- [ ] Gérer les états loading/error

### Étape 3 — Recherche + tri sur les 3 tableaux (45 min)
- [ ] Ajouter un état `searchQuery` par tableau (ou un état global)
- [ ] Ajouter un état `sortKey` + `sortDir` par tableau
- [ ] Filtrer et trier les données à l'affichage
- [ ] Indicateur visuel ↑↓ sur la colonne triée

### Étape 4 — Drill-down entre les 3 tableaux (30 min)
- [ ] Ajouter un état `selectedCentre` et `selectedAgence`
- [ ] Quand on clique sur un centre → on set `selectedCentre` et on re-fetch les agences avec `?centre_id=`
- [ ] Quand on clique sur une agence → on set `selectedAgence` et on re-fetch les gestionnaires avec `?agency_id=`
- [ ] Bouton « Réinitialiser les filtres »

### Étape 5 — Enrichir le tableau « Gestionnaires » (15 min)
- [ ] Ajouter colonnes : Agence, Centre, Encours
- [ ] Brancher sur `getGestionnairesReport` qui a les colonnes

### Étape 6 — Renommage dans la nav (5 min)
- [ ] Sidebar : « Administration » → « Référentiels » + icône
- [ ] Topbar : breadcrumb à jour
- [ ] Route : `/administration` → `/referentiels`

### Étape 7 — Redirection de l'ancienne route (5 min)
- [ ] Dans `App.tsx`, ajouter une route catch-all qui redirige `/administration*` vers `/referentiels`
- [ ] Tester qu'un ancien bookmark fonctionne encore

### Étape 8 — Tests manuels (15 min)
- [ ] Charger la page, vérifier que les KPIs s'affichent
- [ ] Taper dans la recherche, vérifier le filtre
- [ ] Cliquer sur un en-tête de colonne, vérifier le tri
- [ ] Cliquer sur un centre, vérifier le drill-down
- [ ] Cliquer sur « Réinitialiser », vérifier le retour à l'état initial
- [ ] Ouvrir `/administration` dans l'URL, vérifier la redirection

### Étape 9 — Mise à jour de la doc (10 min)
- [ ] `docs/AUDIT_FONCTIONNALITES.md` : renommer la section
- [ ] `docs/PERSONA_RESPONSABLE_RA.md` : mettre à jour les références

---

## 6. Critères d'acceptation (definition of done)

La refonte est considérée comme réussie si :

- [ ] La page se charge sans erreur
- [ ] Les 5 KPIs s'affichent avec des valeurs réelles
- [ ] La recherche fonctionne sur les 3 tableaux
- [ ] Le tri fonctionne sur toutes les colonnes des 3 tableaux
- [ ] Le drill-down centre → agence → gestionnaire fonctionne
- [ ] Le bouton « Réinitialiser » remet tout à plat
- [ ] L'ancienne route `/administration` redirige vers `/referentiels`
- [ ] La sidebar affiche « Référentiels » au lieu de « Administration »
- [ ] Aucun warning console React
- [ ] La page reste lisible et rapide (< 2s de chargement)

---

## 7. Ce qu'on ne fait PAS dans cette refonte (V1)

Pour ne pas se disperser, on s'en tient au scope. Voici ce qui est reporté à plus tard :

- ❌ Page « Fiche centre », « Fiche agence », « Fiche gestionnaire » (drill-down profond)
- ❌ Indicateurs d'alerte intelligents (« 3 gestionnaires à 0 clients »)
- ❌ Export CSV (peut être ajouté en 30 min si tu veux)
- ❌ Édition des référentiels (lecture seule pour la V1, comme avant)
- ❌ Section « Audit des modifications » sur cette page
- ❌ Intégration de la page « Contrôle des données » en onglet (séparé pour l'instant)

---

## 8. Points d'attention

### Risque 1 : Performance
Si on charge 500 gestionnaires avec tous leurs détails, ça peut être lent.
**Mitigation** : pagination côté backend (déjà en place avec `page_size=200`).

### Risque 2 : Endpoints manquants
Si on a besoin d'un endpoint qui n'existe pas, on peut :
- Option A : l'ajouter côté backend (1-2h de plus)
- Option B : composer avec ce qu'on a (lecture moins directe)

**Décision** : on essaie Option B d'abord, et on note les manques pour la suite.

### Risque 3 : Régression visuelle
La sidebar, le topbar, la nav... partout où « Administration » apparaît, on doit changer.
**Mitigation** : grep `administration` avant de fermer le ticket, pour vérifier qu'il ne reste rien.

### Risque 4 : Cohérence des icônes
Aujourd'hui la sidebar utilise `ShieldCheck` pour Administration. Pour « Référentiels », il faut une icône plus adaptée.
**Choix** : `Building2` (immeubles), `Network` (réseau), ou `Database` (base de données). Je propose **`Building2`** car c'est le plus parlant.

---

## 9. Après la V1, idées pour la V2

Une fois cette V1 en place, on pourra :
- Ajouter des **filtres avancés** (par marché, par statut, par plage d'encours)
- Ajouter des **graphiques** (camembert répartition par centre, barre par agence)
- Ajouter des **alertes** (badge rouge sur les centres sans gestionnaire)
- Créer une **vraie page « Administration »** (persona 12.5) pour gérer utilisateurs/rôles/audit

---

## 10. Validation

Avant que je commence à coder, confirme-moi :

- [ ] Tu valides le renommage complet (route, sidebar, composant, dossier)
- [ ] Tu valides le scope V1 (KPIs + recherche + tri + drill-down)
- [ ] Tu valides l'ordre des étapes
- [ ] Tu es OK pour ajouter une redirection `/administration` → `/referentiels`

Si tu dis « go », j'attaque. 💪
