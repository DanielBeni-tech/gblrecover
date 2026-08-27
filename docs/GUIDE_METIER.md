# Guide métier GBLRecover — Comprendre l'enjeu en 10 minutes

> **À qui s'adresse ce guide** : à toute personne qui rejoint le projet sans connaître le contexte (nouveau développeur, nouveau membre de l'équipe, partenaire).
> **Objectif** : comprendre **pourquoi** cette application existe, **qui** elle sert, et **comment** un fichier Excel devient un outil de pilotage.
> **Approche** : on va suivre un client fictif, M. Dupont, du début à la fin de son parcours chez CAMTEL. C'est plus facile à retenir qu'un catalogue de définitions.

---

## Partie 1 — Qui est CAMTEL et pourquoi cette plateforme existe

### CAMTEL en une phrase

CAMTEL (Cameroon Telecommunications) est l'opérateur historique de télécommunications du Cameroun. Comme Orange en France ou MTN au Cameroun, ils vendent :
- des **lignes téléphoniques** fixes
- de l'**internet** (ADSL, fibre optique, 4G fixe)
- de la **télévision** par abonnement
- des **services aux entreprises** (lignes spécialisées, VPN, etc.)

### Le problème que personne ne voit, mais qui coûte cher

Chaque mois, CAMTEL :
1. **Facture** des centaines de milliers de services à des dizaines de milliers de clients
2. **Encaisse** une partie (ceux qui paient)
3. **Attend** que les autres paient (ceux qui ne paient pas tout de suite)
4. **Relance** ceux qui ne paient pas du tout

Le souci, c'est l'étape 4. Sans outil de pilotage :
- L'agent de recouvrement ne sait pas **par où commencer sa journée**
- Le responsable ne sait pas **combien d'argent dort** chez les clients
- La direction ne sait pas **si l'argent perdu cette année est plus ou moins que l'an dernier**

> 💡 **Le chiffre qui fait peur** : sur les opérateurs télécom africains, l'argent « qui dort » (encours) peut représenter **plusieurs milliards de FCFA**. Un bon recouvrement peut littéralement changer les comptes d'une boîte.

### La solution : GBLRecover

GBLRecover est une plateforme web qui prend un **gros fichier Excel mensuel** (celui que tu as vu à `database/GBL - Juillet 2026.xlsx`) et le transforme en :
- une **vue par client** (qui doit combien, depuis quand)
- un **tableau de bord** (état global du portefeuille)
- une **liste de priorités** (qui appeler en premier)
- un **historique d'actions** (qui a fait quoi sur quel dossier)

**La promesse** : « Voir juste. Comprendre vite. Agir avec confiance. »

---

## Partie 2 — Le parcours complet d'un client, de A à Z

Pour comprendre le système, on va suivre **M. Dupont**, directeur d'une PME camerounaise. Son histoire, c'est la vie quotidienne de l'application.

### 🟢 Étape 1 — M. Dupont signe un contrat

M. Dupont possède un complexe hôtelier à Douala. Il appelle CAMTEL pour avoir :
- 1 connexion fibre optique pour la réception
- 5 lignes téléphoniques pour ses employés
- 1 accès TV pour le hall

Le service commercial de CAMTEL crée :

```
📋 CLIENT
   Code client       : 3660591600
   Raison sociale    : COMPLEXE HOTELIER B.S.P SARL
   Marché            : PRO (Professionnels)
   Email             : contact@bspsarl.cm
   Téléphone         : 233451097

📄 COMPTE (n°1)
   Numéro            : 4140073
   Type              : Fibre + 5 lignes Tel
   Agence            : POINT CAMTEL DSCHANG
   Centre            : MC-OUEST
   Gestionnaire      : Mme LAMAGO LEPALON SANDRINE
   Identifiant       : 103867rc
```

> 🎯 **Point important** : *un client* peut avoir *plusieurs comptes*. Si M. Dupont ouvre un autre restaurant à Bafoussam, il aura un 2e compte. C'est pour ça que la plateforme distingue les deux.

### 🟢 Étape 2 — Chaque mois, une facture arrive

Le 1er de chaque mois, le système de CAMTEL génère automatiquement une facture pour le compte de M. Dupont :

| Mois | Facture émise | Impayé (ce qu'il reste à payer) |
|------|---------------|--------------------------------|
| Décembre 2025 | 280 000 FCFA | 280 000 FCFA |
| Janvier 2026 | 280 000 FCFA | 280 000 FCFA |
| Février 2026 | 280 000 FCFA | 280 000 FCFA |
| Mars 2026 | 280 000 FCFA | 280 000 FCFA |
| Avril 2026 | 280 000 FCFA | 250 000 FCFA (il a payé 30 000) |
| Mai 2026 | 280 000 FCFA | 280 000 FCFA |
| Juin 2026 | 280 000 FCFA | 280 000 FCFA |

À la fin juin 2026, **M. Dupont doit 1 930 000 FCFA à CAMTEL**.

C'est exactement ce que tu retrouves dans les 14 colonnes de l'Excel (7 mois × 2 colonnes : une « Facture » et une « Impayés »).

### 🟡 Étape 3 — M. Dupont ne paie plus

Avril 2026, M. Dupont traverse une mauvaise passe. Son hôtel a perdu des clients. Il arrête de payer. Il n'a même pas fait la démarche de prévenir CAMTEL.

L'agent de recouvrement, **Mme LAMAGO**, voit dans la plateforme :

> *« Le client 3660591600 (COMPLEXE HOTELIER B.S.P) a 1,93M FCFA d'impayés, dont 280K à plus de 90 jours. C'est un dossier prioritaire. »*

Sans la plateforme, elle aurait dû :
- ouvrir le fichier Excel
- chercher le nom de M. Dupont (parmi 47 000 lignes)
- faire Ctrl+F, comparer mois par mois
- ouvrir un autre onglet, un autre fichier
- appeler une collègue pour savoir si quelqu'un l'a déjà contacté

**Avec** la plateforme, en 3 clics, elle a la situation complète.

### 🟠 Étape 4 — Mme LAMAGO agit

Elle crée une **action de recouvrement** dans la plateforme :

```
📞 ACTION DE RECOUVREMENT
   Client            : COMPLEXE HOTELIER B.S.P SARL
   Compte            : 4140073
   Type              : Appel téléphonique
   Date              : 2026-07-15
   Échéance          : 2026-07-20
   Priorité          : HAUTE
   Statut            : À faire
   Commentaire       : "Client injoignable, à retenter demain matin"
```

Cette action est **datée, attribuée, tracée**. Le lendemain, elle peut noter le résultat :
« Le client promet de payer 500 000 FCFA avant le 30 juillet. »

### 🔴 Étape 5 — Si rien ne marche

Si M. Dupont ne réagit pas après plusieurs relances, son dossier peut « escalader » :
- Lettre recommandée
- Suspension du service
- Procédure juridique

Ces étapes sont *hors périmètre MVP* de la plateforme, mais elles sont préparées : l'historique d'actions permet de justifier la procédure.

---

## Partie 3 — Le vocabulaire métier (sans se perdre)

Voici un lexique par ordre d'importance. Chaque mot est expliqué avec une analogie.

### 🏢 Les acteurs

| Terme | Explication simple | Analogie |
|---|---|---|
| **Client** | L'entité qui achète les services (personne ou entreprise) | C'est « qui paie » |
| **Compte** | Un contrat facturable rattaché à un client | C'est « quoi » (un numéro de téléphone, un abonnement fibre) |
| **Marché** | Catégorie de client (PTT, PRO, ENT, OFF, PAR) | Le « segment » commercial |
| **Centre de gestion** | Unité territoriale CAMTEL (ex. `MC-LITTORAL`, `MC-CENTRE`, `MC-DOUALA`) | L'« antenne régionale » |
| **Agence** | Sous-structure d'un centre (ex. `AGENCE AKWA NORD`) | L'« agence locale » |
| **Gestionnaire** | L'agent CAMTEL qui suit un portefeuille de clients | Le « conseiller recouvrement » |
| **Portefeuille** | L'ensemble des comptes suivis par un gestionnaire | Le « stock de dossiers » d'un agent |

> 💡 **Pour visualiser** : imagine un arbre.
> - **CAMTEL** (la racine)
>   - **18 centres** (les branches régionales)
>     - **~180 agences** (les sous-branches locales)
>       - **~X gestionnaires** (les feuilles, une par agent)
>         - **~Y clients** (les clients rattachés à chaque agent)

### 💰 L'argent

| Terme | Explication simple | Analogie |
|---|---|---|
| **Facture** | La note envoyée au client chaque mois | « Vous devez 280 000 FCFA pour le mois de mai. » |
| **Impayé** | Le montant qu'un client n'a pas payé | Le « restant dû » sur la facture |
| **Créance** | Exactement pareil qu'impayé, mais terme formel | Le mot qu'on met dans un rapport officiel |
| **Dette** | Pareil, vu côté client (« le client a une dette ») | Synonyme |
| **Balance** | La somme de tous les impayés accumulés sur un compte | Le « solde » (souvent négatif) du compte |
| **Encours total** | La somme de toutes les balances du portefeuille | L'« argent total qui dort chez les clients » |
| **Ancienneté (aging)** | Nombre de jours depuis qu'une facture est impayée | L'« âge de la dette » |
| **Taux de recouvrement** | % des factures qui ont été payées | La « performance » du recouvrement |

### 🛠️ Les actions

| Terme | Explication simple |
|---|---|
| **Action de recouvrement** | Une tâche faite par l'agent (appeler, visiter, envoyer un mail) |
| **Promesse de paiement** | Engagement du client à payer à une date donnée |
| **Relance** | Le fait de recontacter un client qui n'a pas payé |
| **Aging bucket** | Catégorie d'ancienneté (0-30j, 31-60j, 61-90j, 90+ j) |
| **Rejet d'import** | Une ligne Excel qui n'a pas pu être chargée en base |
| **Idempotence** | Propriété d'un import qu'on peut relancer sans créer de doublons |
| **Source de vérité** | Le « document de référence » — ici, le fichier Excel officiel |

---

## Partie 4 — Comprendre le fichier Excel colonne par colonne

Le fichier `database/GBL - Juillet 2026.xlsx` est **l'unique matière première** du système. Voici chaque colonne, regroupée par thème.

### Bloc 1 — Identité (qui ?)
| # | Colonne Excel | Signification |
|---|---|---|
| 1 | **Compte** | Numéro unique du compte (= `num_compte`) |
| 2 | **Marché** | Catégorie de client (PTT, PRO, OFF…) |
| 3 | **Code client** | Numéro unique du client |
| 4 | **E-Bill** | Le client a-t-il adhéré à la e-facture ? (`Oui` / `Non`) |
| 5 | **Raison sociale** | Le nom officiel du client (entreprise, administration…) |

### Bloc 2 — Organisation interne (qui s'en occupe ?)
| # | Colonne Excel | Signification |
|---|---|---|
| 6 | **Centre gestion** | Centre CAMTEL (MC-LITTORAL, MC-CENTRE…) |
| 7 | **Agence** | Agence locale (AGENCE AKWA NORD…) |
| 8 | **Mat. Gestionnaire** | Matricule de l'agent |
| 9 | **Gestionnaire** | Nom de l'agent de recouvrement |
| 10 | **Identification** | Statut d'identification du client (`Identifié` / `Non identifié` / `En cours de vérification`) |

### Bloc 3 — Services souscrits (quoi ?)
| # | Colonnes | Type de service |
|---|---|---|
| 11-18 | LS, Vobb, FTTx, TV, Tel, ADSL, Mobile, Autres | 8 types de services téléphoniques/internet |

> Ces colonnes contiennent les **numéros** associés à chaque service (ex. `233451097[A]`). C'est comme une « fiche de souscription ».

### Bloc 4 — Cycle de facturation (combien ?)
| # | Colonnes | Signification |
|---|---|---|
| 19-32 | **Décembre Facture 2025 → Juin Impayés 2026** | 14 colonnes = 7 mois × 2 (facturé / impayé) |

> C'est **le cœur financier du fichier**. C'est là qu'on voit l'argent.

### Bloc 5 — Indicateurs du compte (état)
| # | Colonne Excel | Signification |
|---|---|---|
| 33 | **Balance** | Le solde actuel du compte (= total impayés) |
| 34 | **Facturation** | Statut du compte (`Arrêt` / `En cours`) |

### Bloc 6 — Métadonnées (pas encore exploitées)
| # | Colonne Excel | Pourquoi on ne s'en sert pas encore |
|---|---|---|
| 35 | **Type** | « Postpaid » — pas critique pour le MVP |
| 36 | **Tax** | Détail fiscal — pas encore mappé |
| 37 | **Cycle** | Le cycle de facturation — déjà déduit via les colonnes mensuelles |
| 38 | **Model de control** | « Credit Control by Bill Cycle » — pas critique |
| 39 | **Credit Limit** | Limite de crédit — pas utilisé pour les calculs MVP |
| 40 | **Indv à contacter** | Personne à contacter — pas chargé en base |
| 41 | **Contact** | Téléphone réel — pas chargé en base |
| 42 | **Adresse** | Adresse postale — pas chargée en base |
| 43 | **Code postal** | Pas chargé en base |
| 44 | **Email** | ✅ Chargé en base |

> 💡 Ces colonnes « non mappées » sont des pistes d'amélioration : si on les charge en base, on pourra afficher l'adresse, le téléphone, etc. sur la fiche client.

---

## Partie 5 — Ce que la plateforme FAIT (vs ce qu'elle ne fait pas)

### ✅ Ce qu'elle fait aujourd'hui

1. **Importer** le fichier Excel chaque mois sans casser l'historique
2. **Afficher** chaque client avec sa situation complète (vue 360°)
3. **Calculer** automatiquement les KPI (encours, taux, top 20…)
4. **Identifier** les dossiers urgents (top des plus endettés, ancienneté 90+)
5. **Tracer** chaque action de recouvrement (qui, quand, quoi)
6. **Suivre** l'évolution dans le temps (courbe mensuelle)
7. **Détecter** les anomalies (soldes négatifs CAMTEL, doublons, etc.)
8. **Respecter** les permissions (un agent du MC-LITTORAL ne voit pas ce qui se passe à Garoua)

### ❌ Ce qu'elle ne fait pas (volontairement, pour l'instant)

- **Elle n'envoie pas de SMS/email** de relance automatiquement (sera ajouté en V2)
- **Elle ne génère pas de PDF** de lettre de relance
- **Elle ne prédit pas** avec de l'IA quels clients vont ne pas payer
- **Elle n'intègre pas** le système de paiement de CAMTEL en temps réel
- **Elle ne gère pas** le workflow d'escalade juridique

> 🎯 **La règle d'or du MVP** : on fait peu, mais on le fait bien et on le fait avec des données fiables. Pas de fonctionnalités tape-à-l'œil sans données solides derrière.

---

## Partie 6 — L'enjeu caché : pourquoi c'est plus important qu'il n'y paraît

### Le vrai sujet, c'est la **confiance dans les données**

Avant la plateforme, CAMTEL avait un gros problème : **personne ne savait vraiment combien d'argent était en jeu**. Les chiffres étaient dispersés, parfois contradictoires, souvent obsolètes.

GBLRecover résout ça en étant **la source de vérité opérationnelle** :
- Un seul fichier source (l'Excel mensuel)
- Une seule base de données
- Un seul tableau de bord qui dit la même chose à tout le monde

> 💡 C'est un changement philosophique : passer d'**« Excel + intuition »** à **« données + action »**.

### Le 2e enjeu : la **productivité des agents**

Sans outil :
- 30 minutes perdues par jour par agent à chercher l'info
- Multiplication des appels en double (deux agents qui relancent le même client)
- Aucune visibilité pour le manager

Avec l'outil :
- Recherche en 1 seconde
- Dossier client complet en 1 clic
- Manager voit l'état de l'équipe en temps réel

**Sur 50 agents × 30 min/jour = 25 heures/jour économisées**. C'est 3 ETP.

### Le 3e enjeu : la **conformité et la traçabilité**

Toutes les actions sont datées, attribuées, justifiables. Si un client conteste, on a l'historique. Si un auditeur demande, on a la trace. C'est ce que la table `AUDIT_EVENTS` prépare.

---

## Partie 7 — Le mot de la fin : pourquoi ton travail compte

Si tu rejoins ce projet, tu ne vas pas « juste » coder une appli. Tu vas aider :
- **M. Dupont** à être rappelé au bon moment (avant que sa situation ne devienne critique)
- **Mme LAMAGO** à ne plus perdre 2 heures par jour à chercher des fichiers
- **CAMTEL** à récupérer plus d'argent, donc à investir dans de meilleurs services
- **Le Cameroun** à avoir un opérateur télécom plus efficace

C'est ça, l'enjeu. Derrière chaque ligne d'Excel, il y a un client, un agent, une réalité économique.

**Bienvenue dans l'équipe.** 🌟

---

## Annexe — Résumé en 5 phrases

1. **GBLRecover** sert CAMTEL à transformer un fichier Excel mensuel de ~50 000 lignes en un outil de pilotage du recouvrement.
2. Un **client** peut avoir plusieurs **comptes**, et chaque compte a une **facture** chaque mois.
3. Quand un client ne paie pas, sa facture devient une **créance** (= impayé = dette), qui vieillit et coûte de plus en plus cher à récupérer.
4. La plateforme aide les **agents de recouvrement** à prioriser, agir et tracer leurs actions sur chaque dossier.
5. Le but final : **récupérer plus d'argent, plus vite, avec moins d'effort**, en s'appuyant sur des données fiables et centralisées.
