# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Stack officielle imposée par GBLContext.md et le TRD (ADR-001/002/003), à ne pas contredire sans ADR motivé :

- **Frontend** : React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui (composants versionnés dans le projet), TanStack Query (état serveur), React Hook Form + Zod (formulaires).
- **Backend** : FastAPI, Python 3.12, SQLAlchemy 2.0, Alembic, Pydantic v2, Uvicorn, JWT, Passlib/bcrypt.
- **Données / import** : PostgreSQL 16, Pandas, OpenPyXL (pipeline d'import Excel).
- **Déploiement** : frontend Vercel, backend Railway, base Railway PostgreSQL.

État réel au 11 août 2026 : le frontend n'est pas encore implémenté (répertoire `frontend/` vide hormis `readme.txt`). Le backend est un socle précoce : `backend/app/models.py`, scaffold Alembic, `database/schema.sql` et `database/views.sql`.

## Users

Utilisateur principal : **agent / gestionnaire de recouvrement** — traite quotidiennement un portefeuille de dossiers, doit retrouver un client en quelques secondes, comprendre sa dette (composition, ancienneté, échéance), consigner les actions et connaître la prochaine action attendue. Priorités : productivité, fiabilité des données, simplicité du parcours.

Autres audiences confirmées : responsable de centre de gestion (pilotage d'équipe et de portefeuille), responsable d'agence (supervision locale), manager Revenue Assurance (pilotage transverse et reporting), analyste Finance/Comptabilité (lecture et rapprochement), administrateur fonctionnel et administrateur sécurité (référentiels, utilisateurs, rôles), auditeur (lecture contrôlée de l'audit). Langue de travail : français professionnel.

## Product Purpose

GBLRecover est la plateforme web de Revenue Assurance de CAMTEL qui centralise, fiabilise et rend actionnables les données de facturation, de paiement et de créances, pour passer d'un recouvrement fondé sur des fichiers Excel dispersés à un recouvrement **consolidé, priorisé et mesurable**. Promesse produit : « Voir juste. Comprendre vite. Agir avec confiance. » Le succès se mesure par la réduction du temps d'accès à l'information, la maîtrise de la dette, la traçabilité des actions et un pilotage fondé sur des indicateurs partagés.

## Positioning

Point de référence opérationnel unique de CAMTEL pour comprendre la dette client, prioriser les actions de recouvrement et piloter la performance Revenue Assurance. Le mécanisme différenciant est la consolidation métier : une vue client 360° reliant comptes, services, factures, paiements et créances, avec un pipeline d'import Excel contrôlé (validation, rejets, idempotence), des habilitations par rôle et périmètre, et une traçabilité de bout en bout. La promesse de « source de vérité opérationnelle » repose sur des données rapprochables avec les sources, pas sur des calculs propriétaires.

## Operating Context

- Environnement : plateforme web métier interne, données sensibles et volumineuses ; travail quotidien sur poste (desktop d'abord, adaptation mobile contrôlée — sidebar persistante desktop, drawer mobile).
- Cycle métier : réception des rapports Excel → contrôle du format → import et normalisation → centralisation → rapprochement des paiements → calcul des soldes et créances → dashboard et analyse → priorisation → action du gestionnaire → suivi et pilotage.
- Livraison : MVP démontrable en vertical slice (login → dashboard → recherche → fiche client → factures/paiements → import Excel + rapport de rejets), déployé et présentable dans un délai de 7 jours.
- Décision retenue (assomption) : la livraison actuelle est un **prototype/démo** (Vercel/Railway), pas un déploiement interne CAMTEL de production.

## Capabilities and Constraints

Capacités confirmées (périmètre MVP) :

- **Authentification** : login, session JWT, rôles de base, déconnexion.
- **Dashboard** : KPI (encours total, créances échues, taux de recouvrement, actions en retard), tendances, aging, liste prioritaire, filtres de période et de périmètre.
- **Clients** : recherche multicritère (identifiant, compte, facture, paiement, téléphone), liste, fiche consolidée avec onglets (résumé, comptes, services, factures, paiements, créances, historique).
- **Factures et paiements** : consultation, statuts, montants, échéances, imputations.
- **Import Excel** : type de données, modèle téléchargeable, contrôles format/taille, prévisualisation, mapping, validation, rapport de rejets (ligne/colonne/valeur/motif), lot et audit.
- **Organisation** : centres, agences, gestionnaires en lecture ou administration limitée.
- **API** : REST versionnée `/api/v1`, documentation OpenAPI 3.1 (Swagger UI / ReDoc), pagination, erreurs structurées, `X-Request-ID`.
- **Qualité** : tests essentiels, CI/CD, logs structurés, healthcheck.

Contraintes durables :

- **Sécurité** : RBAC + filtrage par centre/agence/portefeuille vérifiés côté backend uniquement ; messages d'erreur ne révélant jamais l'existence de données hors périmètre ; secrets jamais committés ; données de démonstration fictives ou anonymisées.
- **Données financières** : montants en `NUMERIC` à précision documentée ; aucune suppression physique en fonctionnement courant ; imports idempotents préservant les identifiants sources ; date de fraîcheur affichée pour les données non temps réel.
- **Validation** : à chaque frontière (Zod frontend, Pydantic backend, contraintes base) ; le backend fait autorité.
- **Hors périmètre MVP / V2 reporté** : relances automatiques omnicanal, workflow complet de recouvrement et d'escalade, intégrations temps réel, scoring prédictif, IA générative, application mobile native, data warehouse, exports planifiés, moteur de règles utilisateur, prévisions financières avancées, automatisation complète.

Terminologie métier (glossaire GBLContext §16) : Revenue Assurance, client, compte, service, souscription, facture, paiement, imputation, créance, balance, centre, agence, gestionnaire, portefeuille, encours, échéance, périmètre, source système.

Facts volontairement non tranchés (questions ouvertes de GBLContext §19, à confirmer avec le métier) : définition officielle de la balance ; source de vérité des paiements ; stabilité des identifiants client/compte ; règles de créance échue ; multi-devise ; SSO ; matrice exacte des rôles MVP ; taille maximale des fichiers Excel ; acceptation d'un import partiel ; politiques d'archivage/rétention.

## Brand Commitments

- Nom : GBLRecover. Client : CAMTEL. Langue : français professionnel.
- Personnalité de marque documentée : fiable, analytique, pragmatique (DESIGN.md des maquettes) — Information Density, professionnalisme fonctionnel.
- Design System officiel : `docs/Design System officiel` et `docs/Design_System_officiel.pdf` ; tokens Material-style dans `gbl maquette/*/DESIGN.md` (bleu corporatif profond `#004085`, ambre doré `#FFC107` en accent secondaire, Inter + JetBrains Mono, tables denses, rayon 4px, sidebar 260px, grille 12 colonnes / 1440px). Les couleurs fonctionnelles ont un sens stable ; le rouge est réservé au critique/destructif.
- Logo : `gbl maquette/gblrecover_official_logo/`.

## Evidence on Hand

- Documentation produit : `docs/GBLContext.md` (source de vérité), `docs/Product Requirements Document (PRD).md`, `docs/Technical Requirements Document (TRD) officiel.md`, `docs/Document UX officiel — Parcours utilisateurs.md`.
- Maquettes HTML + captures : `gbl maquette/` (dashboard_gblrecover, fiche_client_consolid_e, importation_excel, gestionnaire, recherche_liste_clients, gblrecover_official_logo, gblrecover_narrative) ; DESIGN.md sidecars dans `gestionnaire/` et `gblrecover_narrative/`.
- Données de démonstration : `scripts/imports/GBL - Juillet 2026.xlsx` et résultats d'exploration `scripts/imports/testBD/` — traités comme **données anonymisées/démo** (décision retenue ; ne pas les traiter comme données réelles de production).
- Backend : `backend/app/models.py`, scaffold Alembic, `database/schema.sql`, `database/views.sql`, `scripts/imports/charger_donnees.py`.

Absences à ne pas fabriquer : pas de témoignages clients réels, pas de seuils KPI validés, pas de règles de gestion officiellement validées par CAMTEL, pas de données réelles de production.

## Product Principles

1. **La donnée avant tout** : une source de vérité unique et rapprochable ; la compréhension métier et la qualité des données priment sur la sophistication technique.
2. **Orienté action** : chaque créance mène à une action, un responsable, une échéance et un statut ; l'interface fait ressortir la prochaine action.
3. **La sécurité par conception** : accès refusé sans permission explicite, vérification backend, périmètres, données de démo fictives, traçabilité des opérations sensibles.
4. **La confiance par l'explicite** : date de fraîcheur, unités, états complets (chargement, vide, erreur, refus) ; jamais présenter comme fiable une donnée absente, obsolète ou hors permission.
5. **Pragmatisme et réversibilité** : vertical slice MVP, solution la moins complexe qui satisfait le besoin, décisions critiques documentées (ADR) et réversibles.

## Accessibility & Inclusion

Engagements du Document UX officiel (niveau requis pour le MVP — décision retenue) : navigation clavier complète, focus visible, contrastes respectés, libellés accessibles, messages non dépendants de la couleur seule, états complets (loading, empty, error, success, accès refusé), réduction de mouvement honorée, adaptation mobile contrôlée. Aucun standard externe contraignant (WCAG/RGAA) n'est exigé au-delà de ces engagements à ce stade.
