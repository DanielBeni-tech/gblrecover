# Persona 12.3 — Responsable Revenue Assurance : pages et roadmap

> **Référence** : `GBLContext.md` §12.3 — *« Il analyse les tendances globales, la dette, les anomalies et les performances de recouvrement. Il a besoin d'indicateurs consolidés, de comparaisons et d'une information fiable sur la fraîcheur des données. »*
>
> **But de ce document** : lister, pour le persona Responsable RA, les pages dont il a besoin, ce qu'elles doivent afficher, et comment les implémenter à partir de l'existant.
>
> **Approche** : on part du besoin du persona (zéro biais vis-à-vis du code actuel), puis on regarde ce qui existe déjà et ce qu'il faut construire. Si une vue SQL ou un endpoint existe, on le réutilise. Sinon, on note ce qu'il faut ajouter.

---

## 0. Rappel : qui est-ce, en une phrase ?

Le Responsable RA est un **décideur transverse** (pas un opérateur). Il ne gère pas les dossiers au quotidien, il **regarde la situation globale, détecte les problèmes, et décide des actions structurelles**.

C'est le persona qui a besoin d'**un tableau de bord de direction**, pas d'une interface de gestion.

### Ce qu'il fait vs ce qu'il ne fait PAS

| ✅ Il FAIT | ❌ Il ne fait PAS |
|---|---|
| Voit les chiffres globaux (toute l'entreprise, tous centres) | Ne traite pas les dossiers un par un |
| Compare des segments (centres, marchés, périodes) | N'appelle pas les clients |
| Détecte anomalies, dérives, signaux faibles | Ne crée pas d'actions de recouvrement |
| Décide d'actions structurelles (redéploiement, plan d'action) | N'est pas dans l'opérationnel |
| Suit la fraîcheur et la qualité des données | Ne saisit pas de factures |
| Rend des comptes à sa direction | Ne gère pas les comptes au quotidien |

---

## 1. Ses 3 questions du quotidien

Toute page qu'on lui destine doit répondre à au moins une de ces questions :

1. **« Où en sommes-nous ? »** → Vue d'ensemble, KPIs nationaux, fraîcheur
2. **« Qu'est-ce qui ne va pas ? »** → Anomalies, dérives, signaux d'alerte
3. **« Qu'est-ce qu'on fait ? »** → Comparaisons, tendances, aide à la décision

---

## 2. Les 5 pages essentielles

Voici les 5 pages qui couvrent **exhaustivement** les besoins du persona. Pour chaque page, on précise : l'objectif, le contenu, les sources de données, l'état d'implémentation, et le chemin d'implémentation.

### 📊 Page 1 — Dashboard RA (page d'atterrissage)

**Sa question** : *« Où en sommes-nous, là, maintenant ? »*

#### Objectif métier
Donner en un coup d'œil la **photo nationale** du portefeuille, avec les chiffres qui intéressent la direction : encours total, dette échue, taux de recouvrement, volumétrie, qualité. C'est la « home » du RA.

#### Contenu attendu

**Bandeau 1 — Fraîcheur des données**
- Date du dernier import Excel (ex. *« Données au 27/08/2026 — import du 26/08/2026 à 14h32 »*)
- Nombre de comptes / clients / factures actifs
- Bouton « Voir l'historique des imports »

**Bandeau 2 — KPIs nationaux** (4-6 tuiles)
- Encours total (somme des balances)
- Dette échue (> 30 jours)
- Taux de recouvrement (facturé − impayé / facturé)
- % clients identifiés
- Nombre de comptes en statut « Arrêt »
- Volumétrie (nb comptes / clients / factures)

**Bandeau 3 — Alertes**
- Bandeau orange si KPI hors seuil (ex. « Le taux d'identification est descendu sous 60% ce mois-ci »)
- Liste cliquable des 3-5 alertes les plus importantes

**Bandeau 4 — Carte / Treemap**
- Répartition de l'encours par centre (heatmap ou treemap)
- Permet de voir en un coup d'œil quel centre concentre la dette

**Bandeau 5 — Courbe d'évolution**
- Encours vs encaissements sur 12 mois
- Sparkline dans chaque KPI (tendance N vs N-1)

#### Sources de données existantes
- ✅ Vues SQL prêtes : `vw_globale_portefeuille`, `vw_evolution_mensuelle`, `vw_analyse_centres_agences`
- ✅ Endpoints existants : `GET /dashboards/summary`, `GET /dashboards/trend`
- ⚠️ Vue à créer : une vue « alertes » agrégée (KPIs hors seuil)

#### État d'implémentation actuel
- 🟡 **Partiel** : un Dashboard existe déjà (`/dashboard`) mais il est positionné pour l'**agent de recouvrement** (vue par compte, focus client). Il n'est pas pensé pour le RA (vue nationale, focus performance).
- 📝 **Chemin d'implémentation** : créer une **nouvelle page `/pilotage` ou `/ra`** qui agrège les vues nationales. Réutiliser 80% des composants existants (KPI cards, TrendChart, KpiCard) avec des données différentes (filtres par segment plutôt que par client).

#### Niveau d'effort
🟢 Faible (1-2 jours) — la majorité des briques existent, il faut composer.

---

### 🔍 Page 2 — Analyse de la dette (vue macro)

**Sa question** : *« Où est le problème ? »*

#### Objectif métier
Permettre au RA de **décomposer la dette** par segment (centre, marché, période, ancienneté) et d'identifier les concentrations problématiques.

#### Contenu attendu

**Section 1 — Aging bucket national**
- Diagramme en barres empilées : 0-30j / 31-60j / 61-90j / 90+
- Montant total et % dans chaque tranche
- Mise en évidence de la tranche 90+ (c'est la dette « dure »)

**Section 2 — Décomposition par segment** (au choix de l'utilisateur)
- Sélecteur de segment : **Centre de gestion / Marché / Agence**
- Tableau de décomposition : pour chaque entité du segment, montant d'encours, % du total, évolution N vs N-1
- Tri par n'importe quelle colonne
- Mise en évidence des top 5 contributeurs

**Section 3 — Top contributeurs**
- Top 10 centres/agences qui concentrent la dette
- Pour chacun : nom, encours, % du total, lien vers le détail

**Section 4 — Comparaison temporelle**
- Ce mois vs mois dernier (N vs N-1)
- Indicateur de tendance (▲ hausse / ▼ baisse / = stable)
- Mise en évidence des dérives significatives

#### Sources de données existantes
- ✅ Vues SQL prêtes : `vw_aging_impayes`, `vw_analyse_centres_agences`, `vw_analyse_marches`, `vw_tendance_deterioration`
- ✅ Endpoints existants : `GET /dashboards/aging`, `GET /reports/centres-agences`, `GET /reports/marches`, `GET /reports/evolution-mensuelle`
- ✅ Composant frontend existant : `AgedBars` (cf. `frontend/src/components/charts/aging-chart.tsx`)

#### État d'implémentation actuel
- 🟡 **Épars** : les endpoints existent, mais aucune page ne les agrège dans une vue « analyse de dette » dédiée.
- 📝 **Chemin d'implémentation** : créer une page `/analyse-dette` qui compose les 4 sections ci-dessus. Réutiliser `AgedBars` et les tableaux existants.

#### Niveau d'effort
🟢 Faible (2-3 jours) — les briques existent.

---

### 🏆 Page 3 — Performance & Comparaison *(c'est la « page Gestionnaires » repositionnée)*

**Sa question** : *« Qui performe, qui décroche ? »*

#### Objectif métier
Permettre au RA de **comparer** la performance des centres, agences et gestionnaires, et d'identifier les outliers (top et flop). C'est la page qui correspond à ce que tu appelais « page Gestionnaires », repositionnée au bon niveau pour le persona RA.

#### Contenu attendu

**Section 1 — Onglets de comparaison**
Le RA peut basculer entre 3 vues :
- 🏢 **Par centre** : tous les centres de gestion
- 🏛️ **Par agence** : toutes les agences (avec filtre centre)
- 👤 **Par gestionnaire** : tous les agents de recouvrement (avec filtre agence)

**Section 2 — Tableau de classement**
Pour chaque entité (centre / agence / gestionnaire) :
- Nom + identifiant
- Entité parente (centre → agence → gestionnaire)
- Nb de comptes gérés
- Encours total géré
- Encours moyen par compte
- Taux de comptes « Arrêt »
- (Optionnel) Taux d'identification des clients
- (Optionnel) Activité 30j (nb d'actions de recouvrement)
- Sparkline d'évolution sur 6 mois
- Tri par n'importe quelle colonne

**Section 3 — Mise en évidence des outliers**
- Top 3 surlignés en vert (« performers »)
- Flop 3 surlignés en rouge (« décrocheurs »)
- Bandeau latéral : « 3 gestionnaires concentrent 40% de l'encours »

**Section 4 — Drill-down**
- Clic sur un centre → liste de ses agences
- Clic sur une agence → liste de ses gestionnaires
- Clic sur un gestionnaire → sa fiche détaillée (page 4)

#### Sources de données existantes
- ✅ Vues SQL prêtes : `vw_performance_gestionnaires`, `vw_performance_gestionnaire_marche`, `vw_analyse_gestionnaires_avec_impaye`, `vw_indice_fragilite`
- ✅ Endpoints existants : `GET /reports/centres-agences`, `GET /reports/gestionnaires`, `GET /reports/gestionnaires/:id`
- ⚠️ Vue à enrichir : les rapports actuels ne donnent pas encore toutes les colonnes (sparklines, activité 30j, etc.)

#### État d'implémentation actuel
- 🟠 **Très partiel** : la page `/administration` affiche les gestionnaires, mais sans KPIs de performance (juste le nombre de dossiers actifs). C'est une vue « annuaire », pas une vue « performance ».
- 📝 **Chemin d'implémentation** :
  1. Vérifier que `vw_performance_gestionnaires` retourne bien toutes les colonnes nécessaires (encours, taux, activité 30j).
  2. Si non, étendre la vue SQL ou créer une nouvelle vue.
  3. Créer une page `/performance` (ou `/ra/performance`) avec les 4 sections.
  4. Réutiliser le composant `Table` + ajouter un composant `Sparkline` (à créer ou reprendre de `TrendChart`).

#### Niveau d'effort
🟡 Moyen (3-5 jours) — beaucoup de briques existent, mais il faut composer la vue comparative et ajouter les sparklines.

---

### 🩺 Page 4 — Qualité & Anomalies

**Sa question** : *« Qu'est-ce qui ne va pas dans nos données ? »*

#### Objectif métier
Détecter les signaux faibles dans la qualité des données : clients non identifiés, données manquantes, doublons, incohérences, comptes « zombies ». C'est une page que le RA consulte pour **détecter les problèmes systémiques** avant qu'ils ne coûtent cher.

#### Contenu attendu

**Section 1 — KPIs qualité** (4-5 tuiles)
- % clients identifiés (cible : 80%+)
- % comptes avec email connu
- % comptes avec téléphone connu
- % comptes avec adresse connue
- Nb de doublons potentiels détectés

**Section 2 — Tableau des anomalies** (onglets)
- 🟠 **Doublons potentiels** : paires de clients suspects (même raison sociale, même tél…)
- 🟠 **Comptes orphelins** : comptes sans client valide
- 🟠 **Incohérences de facturation** : comptes « Arrêt » avec facture OPEN, etc.
- 🟠 **Comptes zombies** : inactifs depuis > 12 mois
- 🟠 **Données manquantes** : comptes sans email, sans téléphone, sans adresse

**Section 3 — Top des problèmes**
- Top 5 centres les plus concernés par les anomalies
- Sparkline de l'évolution de la qualité sur 6 mois

**Section 4 — Actions suggérées** (lecture seule)
- Pour chaque type d'anomalie, une suggestion générique : *« 12 doublons potentiels détectés. Action recommandée : rapprocher ces clients via la fiche client. »*

#### Sources de données existantes
- ✅ Vues SQL prêtes : `vw_qualite_identification`, `vw_completude_contacts`, `vw_doublons_potentiels`, `vw_comptes_orphelins`, `vw_incoherences_facturation`, `vw_ebill_adoption`, `vw_detection_anomalies_facturation`, `vw_comptes_zombies`
- ✅ Endpoints existants : `GET /admin/qualite-identification`, `GET /admin/completude-contacts`, `GET /admin/doublons-potentiels`, `GET /admin/comptes-orphelins`, `GET /admin/incoherences-facturation`, `GET /admin/ebill-adoption`
- ✅ Composants frontend : on peut reprendre les onglets de la page Administration

#### État d'implémentation actuel
- 🟠 **Endpoints présents, page manquante** : toutes les données sont déjà exposées par l'API, mais **rien dans le frontend** ne les affiche (sauf quelques bribes dans la page Administration). C'est du gâchis : on a les vues, on n'a pas l'écran.
- 📝 **Chemin d'implémentation** : créer une page `/qualite` (ou `/ra/qualite`) qui :
  1. Récupère les 6 endpoints en parallèle
  2. Affiche les KPIs en haut
  3. Affiche les 5 onglets d'anomalies (réutiliser le pattern `Tabs` de la fiche client)
  4. Tableau simple par onglet (réutiliser `Table`)

#### Niveau d'effort
🟢 Faible (2-3 jours) — tout est déjà prêt côté backend, c'est du « simple » assemblage frontend.

---

### 📜 Page 5 — Audit & Fraîcheur

**Sa question** : *« Quand est-ce que les données ont changé, qui a fait quoi ? »*

#### Objectif métier
Donner au RA la **confiance** dans les chiffres qu'il présente à sa direction. S'il annonce « 12 milliards d'encours », il doit pouvoir justifier : *« Ces chiffres viennent de l'import du 26/08, voici le journal des modifications depuis. »*

#### Contenu attendu

**Section 1 — Fraîcheur des données**
- Date du dernier import Excel
- Date du dernier import paiements (si applicable)
- Indicateur visuel : vert si < 7 jours, orange si 7-30 jours, rouge si > 30 jours
- Liste des 10 derniers imports (date, taille, taux de rejet, statut)

**Section 2 — Volumétrie**
- Compteurs globaux : nb comptes, nb clients, nb factures, nb paiements, nb actions
- Comparaison N vs N-1
- Sparkline d'évolution sur 30 jours

**Section 3 — Audit des actions sensibles**
- Timeline des actions sensibles des 7 derniers jours
- Filtres : type d'action, utilisateur, entité
- Détail : qui a fait quoi, quand, sur quoi

**Section 4 — Santé du système**
- Statut de chaque module (Import ✓, Dashboard ✓, Recouvrement ⚠️, etc.)
- Latence moyenne de l'API
- Erreurs récentes

#### Sources de données existantes
- ✅ Vue SQL à utiliser / créer : volumétrie par jour, agrégats d'audit
- ✅ Endpoints existants : `GET /admin/audit`, `GET /imports`, `GET /imports/count`
- ⚠️ Endpoints à créer : `GET /admin/system-health` (latence, statut modules), `GET /admin/data-freshness` (indicateur global)

#### État d'implémentation actuel
- 🔴 **Très partiel** : la table `AUDIT_EVENTS` existe, l'endpoint `/admin/audit` est exposé, mais **aucune page** ne les exploite.
- 📝 **Chemin d'implémentation** :
  1. Étendre le backend avec 1-2 nouveaux endpoints (volumétrie, system-health).
  2. Créer une page `/audit` ou `/ra/audit`.
  3. Réutiliser le composant `Timeline` (existe déjà) pour l'audit.

#### Niveau d'effort
🟡 Moyen (3-5 jours) — il faut construire les endpoints manquants.

---

## 3. Synthèse : l'écart entre l'existant et le besoin

### Ce qui existe déjà (réutilisable)

| Brique | Où | Réutilisé par |
|---|---|---|
| `vw_globale_portefeuille` (KPIs nationaux) | `database/views.sql` | Page 1 |
| `vw_evolution_mensuelle` (courbe 12 mois) | `database/views.sql` | Pages 1, 2 |
| `vw_aging_impayes` (buckets d'ancienneté) | `database/views.sql` | Page 2 |
| `vw_performance_gestionnaires` (perf par agent) | `database/views.sql` | Page 3 |
| `vw_analyse_centres_agences` (perf par centre) | `database/views.sql` | Pages 2, 3 |
| `vw_qualite_identification`, `vw_doublons_potentiels`, etc. | `database/views.sql` | Page 4 |
| Composants `KpiCard`, `TrendChart`, `AgedBars`, `Table`, `Tabs` | `frontend/src/components/` | Toutes les pages |
| `OrgCascadeFilters` (filtres centre→agence) | `frontend/src/components/filters/` | Pages 2, 3 |

### Ce qui manque (à construire)

| Brique | Type d'effort | Priorité |
|---|---|---|
| Page « Pilotage RA » (composition des vues nationales) | Frontend (1-2 j) | 🔴 Haute |
| Page « Performance & Comparaison » avec onglets et sparklines | Frontend (3-5 j) | 🔴 Haute |
| Composant `Sparkline` réutilisable | Frontend (0.5 j) | 🟡 Moyenne |
| Page « Qualité & Anomalies » (assemblage des endpoints admin) | Frontend (2-3 j) | 🟡 Moyenne |
| Endpoint `system-health` (statut modules) | Backend (1 j) | 🟢 Basse |
| Vue SQL « alertes » (KPIs hors seuil) | Backend SQL (0.5 j) | 🟡 Moyenne |

---

## 4. Proposition de roadmap

Sur un sprint de 2 semaines, voici l'ordre recommandé :

### Semaine 1 — Cœur du pilotage
- **J1-J2** : Page Pilotage RA (Dashboard national) — Quick win, beaucoup de réutilisation
- **J3-J5** : Page Performance & Comparaison (l'ex « page Gestionnaires » repositionnée)

### Semaine 2 — Profondeur
- **J6-J7** : Page Analyse de la dette (décomposition par segment)
- **J8-J9** : Page Qualité & Anomalies (assemblage rapide)
- **J10** : Page Audit & Fraîcheur (polish + endpoints manquants)

### Améliorations continues
- Tests (smoke + e2e sur les nouveaux flux)
- Documentation utilisateur
- Ajustement UX après feedback

---

## 5. Recommandation : faut-il une « page Gestionnaires » à part ?

**Ma recommandation : non, pas comme page d'entrée.** Voici pourquoi :

1. Le **RA** ne pense pas « gestionnaire » en premier. Il pense « centre » puis « agence » puis « gestionnaire ». Faire des gestionnaires le point d'entrée, c'est le faire entrer par le bas de la hiérarchie.
2. La **page Performance & Comparaison** (Page 3) inclut un onglet « Par gestionnaire » qui répond exactement au besoin initial, mais en le positionnant correctement.
3. Si on crée une page `/gestionnaires` isolée, on duplique la logique de filtrage, de tri, de pagination qui existe déjà dans la page Performance.

**L'arborescence cible** :

```
/pilotage        (Page 1 : Dashboard RA)
/analyse-dette   (Page 2 : Vue macro de la dette)
/performance     (Page 3 : Comparaison centres/agences/gestionnaires)
   ├── onglet "Centres"
   ├── onglet "Agences"
   └── onglet "Gestionnaires"  ← c'est ici que vit "ta" page
/qualite         (Page 4 : Anomalies et qualité des données)
/audit           (Page 5 : Fraîcheur et traçabilité)
```

> 💡 **Si tu veux quand même une entrée « Gestionnaires » dans la sidebar**, on peut faire un lien « Performance › Gestionnaires » qui ouvre directement la Page 3 sur l'onglet Gestionnaires. Comme ça, le mot magique reste accessible, mais on n'isole pas une page qui aurait moins de valeur que les autres.

---

## 6. Critères de succès

Une page du persona RA est réussie si :

- [ ] Elle répond à une de ses 3 questions (Où / Quoi / Comment)
- [ ] Elle affiche des **données réelles** (pas de mock, pas de fictif)
- [ ] Elle indique la **fraîcheur** des données affichées
- [ ] Elle permet un **drill-down** vers le détail (centre → agence → gestionnaire → client)
- [ ] Elle est **exportable** (CSV au minimum) pour transmission à la direction
- [ ] Elle est **performante** (< 2s de chargement) même avec 50 000 comptes
- [ ] Elle **commente** les chiffres hors norme (alertes, seuils)

---

## 7. Prochaine étape

Avant de coder, je te propose qu'on choisisse ensemble :

1. **Par quelle page on commence** (recommandation : Page 1 Pilotage, car c'est le plus visible et le plus rapide)
2. **Est-ce qu'on suit la roadmap proposée** (semaine 1 = Pilotage + Performance)
3. **Est-ce qu'on valide l'arborescence `/pilotage /analyse-dette /performance /qualite /audit`** ou tu préfères d'autres noms

Dis-moi ce qui te semble juste, et on attaque. 💪
