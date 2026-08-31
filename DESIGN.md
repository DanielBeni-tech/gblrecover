# DESIGN.md — GBLRecover, Canopée CAMTEL

Direction visuelle de la refonte UI/UX. Source de vérité des tokens : `frontend/src/index.css`. Complète `docs/Design System officiel`.

## Promesse

**Voir juste. Comprendre vite. Agir.** Chaque écran répond à : où suis-je, quoi regarder, quoi cliquer.

## Palette Canopée

| Rôle | Hex | Usage |
|---|---|---|
| Ivoire | `#F6F3EC` | Fond de page, surface |
| Encre | `#14221F` | Titres, texte prioritaire |
| Teal profond | `#0F5C56` | Marque, navigation active, actions métier |
| Cuivre | `#C45C26` | CTA public, créances, accent d’action |
| Vert succès | `#16A34A` | Paiement, état sain |
| Ambre warning | `#D97706` | Attention, donnée incomplète |
| Rouge danger | `#DC2626` | Critique, destructif |

Les états sémantiques ne changent pas de sens : le rouge n’est jamais décoratif.

## Typographie

Inter (400–700) pour l’UI. JetBrains Mono pour identifiants, montants tabulaires. Mesure de lecture ~65 ch sur la landing. Titres de pages métier : 24 px semibold. Display landing : 40–56 px.

## Pages

| Route | Accès | Rôle |
|---|---|---|
| `/` | Public | Landing illustrée, équipe, CTA unique « Se connecter » |
| `/login` | Public | Connexion illustrée (split 3:4) |
| `/vue-nationale` | Auth | KPI nationaux, Top 20, prochaine action |
| `/analyse-dette` | Auth | Aging, priorisation des tranches |
| `/centres` `/agences` `/gestionnaires` | Auth | Performance par périmètre |
| `/referentiels` | Auth | Structure organisationnelle |
| `/clients` `/clients/:id` | Auth | Portefeuille et fiche 360° |
| `/factures` `/paiements` `/imports` | Auth | Dossiers opérationnels |

Connecté qui arrive sur `/` : CTA « Ouvrir l’espace » vers `/vue-nationale`.

## Shell

Sidebar 260 px, fond ivoire, groupes **Pilotage / Performance / Dossiers / Référentiels**. Libellés actionnables (verbe + objet). Lien discret vers la landing. Topbar : recherche globale, fil d’Ariane, session.

## Illustrations

Placeholders remplaçables dans `frontend/public/` :

- `illustrations/hero-gblrecover.png` — hero 16:9
- `illustrations/login-gblrecover.png` — login 3:4
- `team/team-*.png` — portraits 1:1

## Équipe

| Nom | Rôle |
|---|---|
| Daniel Beni Mpodol Welisan | Fullstack JS, frontend, responsable UI/UX |
| Nkoumou Tsade Nikaise Germain | Fullstack Python, backend, responsable des API |
| Evijo Evina | Backend Python, logique métier et base de données |
| Kegne Ange | Architecture globale de la base de données |
| Soudjonk Divine | Recette, documentation utilisateur et qualité des parcours |
| Balawe Chips | DevOps, Docker et mise en production |
