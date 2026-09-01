-- Creation des vues

-- vues globale du porte feuille
CREATE OR REPLACE VIEW vw_globale_portefeuille AS
SELECT 
    c.NOM_CENTRE,
    a.ID_AGENCE,
    a.NOM_AGENCE,
    cl.MARCHE,
    cp.STATUT_FACTURATION,
    f.DATE_EMISSION AS mois_emission,
    
    -- KPI 1 : Total des comptes
    COUNT(DISTINCT cp.NUM_COMPTE) AS total_comptes,
    
    -- KPI 2 : Balance globale des comptes
    SUM(cp.BALANCE) AS balance_globale,
    
    -- KPI 3 : Facturation du mois
    SUM(COALESCE(f.MONTANT_FACTURE, 0)) AS total_facture_mois,
    
    -- KPI 4 : Impayés du mois
    SUM(COALESCE(f.OUTSTANDING_AMOUNT, 0)) AS total_impaye_mois

FROM COMPTE cp
JOIN CLIENT cl ON cp.CODE_CLIENT = cl.CODE_CLIENT
JOIN AGENCE a ON cp.ID_AGENCE = a.ID_AGENCE
JOIN CENTRE c ON a.NOM_CENTRE = c.NOM_CENTRE
LEFT JOIN FACTURE f ON cp.NUM_COMPTE = f.NUM_COMPTE AND (f.STATUS <> 'CANCELLED' OR f.STATUS IS NULL)

WHERE f.STATUS <> 'CANCELLED' OR f.STATUS IS NULL

GROUP BY 
    c.NOM_CENTRE,
    a.ID_AGENCE,
    a.NOM_AGENCE,
    cl.MARCHE,
    cp.STATUT_FACTURATION,
    f.DATE_EMISSION;

--EXECUTION DE LA VUE
-- SELECT * FROM vw_globale_portefeuille;












-- vues impayes critques

DROP VIEW IF EXISTS vw_impayes_critiques CASCADE;

CREATE OR REPLACE VIEW vw_impayes_critiques AS
WITH max_ref AS (
    SELECT COALESCE(MAX(DATE_EMISSION), CURRENT_DATE) AS max_date FROM FACTURE WHERE STATUS <> 'CANCELLED'
)
SELECT 
    cp.NUM_COMPTE,
    cl.RAISON_SOCIALE,
    cl.MARCHE,
    c.NOM_CENTRE,
    a.NOM_AGENCE,
    cp.BALANCE AS balance_compte,
    
    SUM(COALESCE(f.OUTSTANDING_AMOUNT, 0)) AS total_montant_impaye,
    SUM(COALESCE(f.MONTANT_FACTURE, 0)) AS total_montant_facture,
    
    (EXTRACT(YEAR FROM AGE((SELECT max_date FROM max_ref), MIN(f.DATE_EMISSION))) * 12) +
    EXTRACT(MONTH FROM AGE((SELECT max_date FROM max_ref), MIN(f.DATE_EMISSION))) AS anciennete_max_mois,
    
    MIN(f.DATE_EMISSION) AS date_facture_la_plus_ancienne

FROM COMPTE cp
JOIN CLIENT cl ON cp.CODE_CLIENT = cl.CODE_CLIENT
JOIN AGENCE a ON cp.ID_AGENCE = a.ID_AGENCE
JOIN CENTRE c ON a.NOM_CENTRE = c.NOM_CENTRE
JOIN FACTURE f ON cp.NUM_COMPTE = f.NUM_COMPTE AND f.STATUS <> 'CANCELLED'
WHERE f.STATUS <> 'CANCELLED'

GROUP BY 
    cp.NUM_COMPTE,
    cl.RAISON_SOCIALE,
    cl.MARCHE,
    c.NOM_CENTRE,
    a.NOM_AGENCE,
    cp.BALANCE;


-- execution de la vue
-- SELECT * FROM vw_impayes_critiques;











-- vues performance_gestionnaire

DROP VIEW IF EXISTS vw_performance_gestionnaires CASCADE;

CREATE OR REPLACE VIEW vw_performance_gestionnaires AS
SELECT 
    g.MAT_GESTIONNAIRE,
    g.NOM_GESTIONNAIRE,
    a.NOM_AGENCE,
    c.NOM_CENTRE,
    f.DATE_EMISSION AS periode,
    
    -- Volume de comptes gérés par le gestionnaire
    COUNT(DISTINCT cp.NUM_COMPTE) AS volume_comptes,
    
    -- Volume total de factures associées
    COUNT(DISTINCT f.ID_FACTURE) AS volume_factures,
    
    -- Indicateurs financiers
    SUM(COALESCE(f.MONTANT_FACTURE, 0)) AS total_facture,
    SUM(COALESCE(f.OUTSTANDING_AMOUNT, 0)) AS total_impaye,
    SUM(COALESCE(f.MONTANT_FACTURE, 0)) - SUM(COALESCE(f.OUTSTANDING_AMOUNT, 0)) AS total_recouvre,
    
    -- Taux de recouvrement du gestionnaire en %
    ROUND(
        (
            (SUM(COALESCE(f.MONTANT_FACTURE, 0)) - SUM(COALESCE(f.OUTSTANDING_AMOUNT, 0))) 
            / NULLIF(SUM(COALESCE(f.MONTANT_FACTURE, 0)), 0)::numeric
        ) * 100, 2
    ) AS taux_recouvrement_pct

FROM GESTIONNAIRE g
JOIN COMPTE cp ON g.MAT_GESTIONNAIRE = cp.MAT_GESTIONNAIRE
JOIN AGENCE a ON cp.ID_AGENCE = a.ID_AGENCE
JOIN CENTRE c ON a.NOM_CENTRE = c.NOM_CENTRE
JOIN FACTURE f ON cp.NUM_COMPTE = f.NUM_COMPTE AND f.STATUS <> 'CANCELLED'
WHERE f.STATUS <> 'CANCELLED'

GROUP BY 
    g.MAT_GESTIONNAIRE,
    g.NOM_GESTIONNAIRE,
    a.NOM_AGENCE,
    c.NOM_CENTRE,
    f.DATE_EMISSION;


-- execution de la vue
--  SELECT * 
--  FROM vw_performance_gestionnaires 
--  ORDER BY total_recouvre DESC 
--  LIMIT 20;













-- EVOLUTION MENSUELLE 
DROP VIEW IF EXISTS vw_evolution_mensuelle CASCADE;

CREATE OR REPLACE VIEW vw_evolution_mensuelle AS
SELECT 
    f.DATE_EMISSION AS mois_emission,
    TRIM(REPLACE(REPLACE(f.LIBELLE_PERIODE, 'Facture', ''), 'Impaye', '')) AS mois_annee,
    cp.NUM_COMPTE,
    cl.CODE_CLIENT,
    cl.RAISON_SOCIALE,
    c.NOM_CENTRE,
    a.NOM_AGENCE,
    
    -- Volume d'opérations
    COUNT(f.ID_FACTURE) AS volume_total_transactions,
    
    -- Facturation
    SUM(CASE WHEN f.TYPE_FLUX = 'FACTURE' THEN COALESCE(f.MONTANT_FACTURE, 0) ELSE 0 END) AS total_facture,
    
    -- Impayés
    SUM(CASE WHEN f.TYPE_FLUX = 'IMPAYE' THEN COALESCE(f.MONTANT_FACTURE, 0) ELSE 0 END) AS total_impaye,
    
    -- Recouvrement = Facturé - Impayé
    SUM(CASE WHEN f.TYPE_FLUX = 'FACTURE' THEN COALESCE(f.MONTANT_FACTURE, 0) ELSE 0 END) - 
    SUM(CASE WHEN f.TYPE_FLUX = 'IMPAYE' THEN COALESCE(f.MONTANT_FACTURE, 0) ELSE 0 END) AS total_recouvre

FROM FACTURE f
JOIN COMPTE cp ON f.NUM_COMPTE = cp.NUM_COMPTE
JOIN CLIENT cl ON cp.CODE_CLIENT = cl.CODE_CLIENT
JOIN AGENCE a ON cp.ID_AGENCE = a.ID_AGENCE
JOIN CENTRE c ON a.NOM_CENTRE = c.NOM_CENTRE

WHERE f.DATE_EMISSION >= '2025-12-01'

GROUP BY 
    f.DATE_EMISSION,
    TRIM(REPLACE(REPLACE(f.LIBELLE_PERIODE, 'Facture', ''), 'Impaye', '')),
    cp.NUM_COMPTE,
    cl.CODE_CLIENT,
    cl.RAISON_SOCIALE,
    c.NOM_CENTRE,
    a.NOM_AGENCE;


    -- Execution de la vue
    /*
    SELECT 
        mois_emission,
        SUM(total_facture) AS facture_globale,
        SUM(total_impaye) AS impaye_global,
        SUM(total_recouvre) AS recouvre_global,
        
        ROUND(
            (SUM(total_recouvre) * 100.0 / NULLIF(SUM(total_facture), 0))::numeric, 
            2
        ) AS taux_recouvrement_pct

    FROM vw_evolution_mensuelle
    GROUP BY mois_emission
    ORDER BY mois_emission ASC;
    
    */ 















-- VUES DE LA CARTOGRAPHIE DES CLIENTS

DROP VIEW IF EXISTS vw_cartographie_clients CASCADE;

CREATE OR REPLACE VIEW vw_cartographie_clients AS
SELECT 
    c.NOM_CENTRE AS region_centre,
    a.NOM_AGENCE,
    cl.MARCHE AS type_marche,
    
    -- Volume de clients et de comptes
    COUNT(DISTINCT cl.CODE_CLIENT) AS nombre_clients,
    COUNT(DISTINCT cp.NUM_COMPTE) AS nombre_comptes,
    
    -- Encours global (Dette / Balance des comptes)
    SUM(COALESCE(cp.BALANCE, 0)) AS total_dette_fcfa,
    
    -- Volume et montants des opérations (Factures vs Impayés via TYPE_FLUX)
    COUNT(f.ID_FACTURE) AS volume_transactions,
    SUM(CASE WHEN f.TYPE_FLUX = 'FACTURE' THEN COALESCE(f.MONTANT_FACTURE, 0) ELSE 0 END) AS total_facture,
    SUM(CASE WHEN f.TYPE_FLUX = 'IMPAYE' THEN COALESCE(f.MONTANT_FACTURE, 0) ELSE 0 END) AS total_impaye,
    
    -- Taux de recouvrement par secteur / agence
    ROUND(
        (
            (
                SUM(CASE WHEN f.TYPE_FLUX = 'FACTURE' THEN COALESCE(f.MONTANT_FACTURE, 0) ELSE 0 END) - 
                SUM(CASE WHEN f.TYPE_FLUX = 'IMPAYE' THEN COALESCE(f.MONTANT_FACTURE, 0) ELSE 0 END)
            ) * 100.0 / 
            NULLIF(SUM(CASE WHEN f.TYPE_FLUX = 'FACTURE' THEN COALESCE(f.MONTANT_FACTURE, 0) ELSE 0 END), 0)
        )::numeric, 2
    ) AS taux_recouvrement_pct

FROM CLIENT cl
JOIN COMPTE cp ON cl.CODE_CLIENT = cp.CODE_CLIENT
JOIN AGENCE a ON cp.ID_AGENCE = a.ID_AGENCE
JOIN CENTRE c ON a.NOM_CENTRE = c.NOM_CENTRE
LEFT JOIN FACTURE f ON cp.NUM_COMPTE = f.NUM_COMPTE AND (f.STATUS <> 'CANCELLED' OR f.STATUS IS NULL)

GROUP BY 
    c.NOM_CENTRE,
    a.NOM_AGENCE,
    cl.MARCHE;
    



-- EXECUTION DE LA VUE
/*
SELECT * 
FROM vw_cartographie_clients 
ORDER BY region_centre ASC, total_dette_fcfa DESC;
*/













-- analyse par marché

DROP VIEW IF EXISTS vw_analyse_marches CASCADE;

CREATE OR REPLACE VIEW vw_analyse_marches AS
WITH stats_clients AS (
    -- Identification des clients multi-comptes au sein d'un même marché
    SELECT 
        cl.marche,
        cl.code_client,
        COUNT(cp.num_compte) AS nb_comptes
    FROM client cl
    JOIN compte cp ON cl.code_client = cp.code_client
    GROUP BY cl.marche, cl.code_client
)
SELECT 
    COALESCE(cl.marche, 'NON SPECIFIE') AS marche,
    
    -- Volume de clients et de comptes
    COUNT(DISTINCT cl.code_client) AS total_clients,
    COUNT(DISTINCT cp.num_compte) AS total_comptes,
    
    -- Clients multi-comptes
    COUNT(DISTINCT CASE WHEN sc.nb_comptes > 1 THEN cl.code_client END) AS nombre_clients_multi_comptes,
    
    -- Concentration des impayés (via TYPE_FLUX = 'IMPAYE')
    SUM(CASE WHEN f.type_flux = 'IMPAYE' THEN COALESCE(f.montant_facture, 0) ELSE 0 END) AS total_impayes_fcfa,
    
    -- Taux de pénétration E-Bill
    COUNT(DISTINCT CASE WHEN LOWER(cp.e_bill::text) IN ('true', '1', 'oui', 'y', 'yes') THEN cp.num_compte END) AS comptes_ebill,
    ROUND(
        (
            COUNT(DISTINCT CASE WHEN LOWER(cp.e_bill::text) IN ('true', '1', 'oui', 'y', 'yes') THEN cp.num_compte END) * 100.0 / 
            NULLIF(COUNT(DISTINCT cp.num_compte), 0)
        )::numeric, 2
    ) AS taux_penetration_ebill_pct,
    
    -- Encours global (Balance Réelle)
    SUM(COALESCE(cp.balance, 0)) AS total_balance_reelle

FROM client cl
JOIN compte cp ON cl.code_client = cp.code_client
LEFT JOIN stats_clients sc ON cl.code_client = sc.code_client AND cl.marche = sc.marche
LEFT JOIN facture f ON cp.num_compte = f.num_compte AND (f.status <> 'CANCELLED' OR f.status IS NULL)

GROUP BY COALESCE(cl.marche, 'NON SPECIFIE');


-- execution de la vue
/*
SELECT * 
FROM vw_analyse_marches 
ORDER BY total_impayes_fcfa DESC;
*/











-- analyse des dettes par centre et agence 

DROP VIEW IF EXISTS vw_analyse_centres_agences CASCADE;

CREATE OR REPLACE VIEW vw_analyse_centres_agences AS
WITH stats_factures_agence AS (
    SELECT 
        cp.id_agence,
        SUM(CASE WHEN f.type_flux = 'FACTURE' THEN COALESCE(f.montant_facture, 0) ELSE 0 END) AS total_facture_fcfa,
        SUM(CASE WHEN f.type_flux = 'IMPAYE' THEN COALESCE(f.montant_facture, 0) ELSE 0 END) AS total_impaye_flux_fcfa
    FROM compte cp
    JOIN facture f ON cp.num_compte = f.num_compte AND f.status <> 'CANCELLED'
    GROUP BY cp.id_agence
),
stats_gestionnaires AS (
    SELECT 
        id_agence,
        COUNT(DISTINCT mat_gestionnaire) AS nb_gestionnaires
    FROM compte
    WHERE mat_gestionnaire IS NOT NULL AND TRIM(mat_gestionnaire) <> ''
    GROUP BY id_agence
)
SELECT 
    c.nom_centre AS region_centre,
    a.id_agence,
    a.nom_agence,
    
    -- Volumes d'entités
    COUNT(DISTINCT cl.code_client) AS total_clients,
    COUNT(DISTINCT cp.num_compte) AS total_comptes,
    
    -- Répartition Actifs vs Arrêtés (basé sur 'Arrêt' et 'En cours')
    COUNT(DISTINCT CASE WHEN LOWER(TRIM(cp.statut_facturation::text)) = 'arrêt' THEN cp.num_compte END) AS nb_comptes_arretes,
    COUNT(DISTINCT CASE WHEN LOWER(TRIM(cp.statut_facturation::text)) = 'en cours' THEN cp.num_compte END) AS nb_comptes_actifs,
    
    -- Pourcentage de comptes arrêtés
    ROUND(
        (
            COUNT(DISTINCT CASE WHEN LOWER(TRIM(cp.statut_facturation::text)) = 'arrêt' THEN cp.num_compte END) * 100.0 / 
            NULLIF(COUNT(DISTINCT cp.num_compte), 0)
        )::numeric, 2
    ) AS taux_comptes_arretes_pct,
    
    -- Gestions / Charge de travail (nb comptes 'En cours' par gestionnaire)
    COALESCE(sg.nb_gestionnaires, 0) AS nb_gestionnaires,
    ROUND(
        (
            COUNT(DISTINCT CASE WHEN LOWER(TRIM(cp.statut_facturation::text)) = 'en cours' THEN cp.num_compte END) * 1.0 / 
            NULLIF(sg.nb_gestionnaires, 0)
        )::numeric, 2
    ) AS ratio_comptes_actifs_par_gestionnaire,
    
    -- Encours d'impayés cumulés
    SUM(COALESCE(cp.balance, 0)) AS total_dette_balance_fcfa,
    
    -- Flux de facturation mensuelle
    COALESCE(sf.total_facture_fcfa, 0) AS total_facture_fcfa,
    COALESCE(sf.total_impaye_flux_fcfa, 0) AS total_impaye_flux_fcfa,
    
    -- Taux de recouvrement
    CASE 
        WHEN COALESCE(sf.total_facture_fcfa, 0) = 0 THEN NULL
        ELSE ROUND(
            (
                (sf.total_facture_fcfa - COALESCE(sf.total_impaye_flux_fcfa, 0)) * 100.0 / 
                sf.total_facture_fcfa
            )::numeric, 2
        )
    END AS taux_recouvrement_pct

FROM centre c
JOIN agence a ON c.nom_centre = a.nom_centre
JOIN compte cp ON a.id_agence = cp.id_agence
JOIN client cl ON cp.code_client = cl.code_client
LEFT JOIN stats_gestionnaires sg ON a.id_agence = sg.id_agence
LEFT JOIN stats_factures_agence sf ON a.id_agence = sf.id_agence

GROUP BY 
    c.nom_centre,
    a.id_agence,
    a.nom_agence,
    sg.nb_gestionnaires,
    sf.total_facture_fcfa,
    sf.total_impaye_flux_fcfa;


-- execution de la vue
/*
SELECT 
    region_centre,
    nom_agence,
    total_comptes,
    total_dette_balance_fcfa,
    taux_comptes_arretes_pct,
    ratio_comptes_actifs_par_gestionnaire,
    DENSE_RANK() OVER (ORDER BY total_dette_balance_fcfa DESC) AS rang_dette
FROM vw_analyse_centres_agences
ORDER BY total_dette_balance_fcfa DESC;
*/














-- analyse meilleurs gestionnaires

DROP VIEW IF EXISTS vw_analyse_gestionnaires CASCADE;

CREATE OR REPLACE VIEW vw_analyse_gestionnaires AS
WITH stats_factures_gest AS (
    SELECT 
        cp.mat_gestionnaire,
        SUM(CASE WHEN f.type_flux = 'FACTURE' THEN COALESCE(f.montant_facture, 0) ELSE 0 END) AS total_facture_fcfa,
        SUM(CASE WHEN f.type_flux = 'IMPAYE' THEN COALESCE(f.montant_facture, 0) ELSE 0 END) AS total_impaye_flux_fcfa
    FROM compte cp
    JOIN facture f ON cp.num_compte = f.num_compte AND f.status <> 'CANCELLED'
    WHERE cp.mat_gestionnaire IS NOT NULL AND TRIM(cp.mat_gestionnaire) <> ''
    GROUP BY cp.mat_gestionnaire
)
SELECT 
    COALESCE(NULLIF(TRIM(cp.mat_gestionnaire), ''), 'NON ASSIGNE') AS mat_gestionnaire,
    COALESCE(g.nom_gestionnaire, 'INCONNU') AS nom_gestionnaire,
    
    -- Portefeuille
    COUNT(DISTINCT cp.code_client) AS total_clients,
    COUNT(DISTINCT cp.num_compte) AS total_comptes,
    COUNT(DISTINCT CASE WHEN LOWER(TRIM(cp.statut_facturation::text)) = 'en cours' THEN cp.num_compte END) AS comptes_actifs,
    
    -- Charge de travail
    CASE 
        WHEN COUNT(DISTINCT CASE WHEN LOWER(TRIM(cp.statut_facturation::text)) = 'en cours' THEN cp.num_compte END) > 150 THEN 'SURCHARGÉ'
        WHEN COUNT(DISTINCT CASE WHEN LOWER(TRIM(cp.statut_facturation::text)) = 'en cours' THEN cp.num_compte END) < 30 THEN 'SOUS-CHARGÉ'
        ELSE 'OPTIMAL'
    END AS statut_charge,
    
    -- Taux d'identification
    ROUND(
        (
            COUNT(DISTINCT CASE WHEN cl.raison_sociale IS NOT NULL AND TRIM(cl.raison_sociale) <> '' THEN cl.code_client END) * 100.0 / 
            NULLIF(COUNT(DISTINCT cl.code_client), 0)
        )::numeric, 2
    ) AS taux_identification_pct,
    
    -- Encours d'impayés cumulés
    SUM(COALESCE(cp.balance, 0)) AS total_dette_balance_fcfa,
    
    -- Flux de facturation
    COALESCE(sf.total_facture_fcfa, 0) AS total_facture_fcfa,
    COALESCE(sf.total_impaye_flux_fcfa, 0) AS total_impaye_flux_fcfa,
    
    -- Pourcentages
    CASE 
        WHEN COALESCE(sf.total_facture_fcfa, 0) = 0 THEN 0
        ELSE ROUND(((sf.total_facture_fcfa - sf.total_impaye_flux_fcfa) * 100.0 / sf.total_facture_fcfa)::numeric, 2)
    END AS taux_recouvrement_pct,
    
    CASE 
        WHEN COALESCE(sf.total_facture_fcfa, 0) = 0 THEN 0
        ELSE ROUND((sf.total_impaye_flux_fcfa * 100.0 / sf.total_facture_fcfa)::numeric, 2)
    END AS taux_impayes_pct,
    
    -- Score de Performance Individuel
    ROUND(
        (
            (
                CASE 
                    WHEN COALESCE(sf.total_facture_fcfa, 0) = 0 THEN 0
                    ELSE ((sf.total_facture_fcfa - sf.total_impaye_flux_fcfa) * 100.0 / sf.total_facture_fcfa)
                END
            ) - 
            (
                CASE 
                    WHEN COALESCE(sf.total_facture_fcfa, 0) = 0 THEN 0
                    ELSE (sf.total_impaye_flux_fcfa * 100.0 / sf.total_facture_fcfa)
                END
            ) + 
            LOG(10, GREATEST(sf.total_facture_fcfa - sf.total_impaye_flux_fcfa, 0) + 1)
        )::numeric, 2
    ) AS score_performance

FROM compte cp
JOIN client cl ON cp.code_client = cl.code_client
LEFT JOIN gestionnaire g ON cp.mat_gestionnaire = g.mat_gestionnaire
LEFT JOIN stats_factures_gest sf ON cp.mat_gestionnaire = sf.mat_gestionnaire

GROUP BY 
    COALESCE(NULLIF(TRIM(cp.mat_gestionnaire), ''), 'NON ASSIGNE'),
    COALESCE(g.nom_gestionnaire, 'INCONNU'),
    sf.total_facture_fcfa,
    sf.total_impaye_flux_fcfa;


-- execution de la vue
/*
SELECT 
    mat_gestionnaire,
	nom_gestionnaire,
    total_comptes,
    comptes_actifs,
    statut_charge,
    taux_identification_pct,
    total_dette_balance_fcfa,
    taux_recouvrement_pct,
    score_performance,
    DENSE_RANK() OVER (ORDER BY score_performance DESC) AS rang_performance
FROM vw_analyse_gestionnaires
ORDER BY score_performance DESC;
*/














-- analyse performance gestionnaire avec aumoins un impaye
DROP VIEW IF EXISTS vw_analyse_gestionnaires_avec_impaye CASCADE;

CREATE OR REPLACE VIEW vw_analyse_gestionnaires_avec_impaye AS
WITH stats_factures_gest AS (
    SELECT 
        cp.mat_gestionnaire,
        SUM(CASE WHEN f.type_flux = 'FACTURE' THEN COALESCE(f.montant_facture, 0) ELSE 0 END) AS total_facture_fcfa,
        SUM(CASE WHEN f.type_flux = 'IMPAYE' THEN COALESCE(f.montant_facture, 0) ELSE 0 END) AS total_impaye_flux_fcfa
    FROM compte cp
    JOIN facture f ON cp.num_compte = f.num_compte AND f.status <> 'CANCELLED'
    WHERE cp.mat_gestionnaire IS NOT NULL AND TRIM(cp.mat_gestionnaire) <> ''
    GROUP BY cp.mat_gestionnaire
)
SELECT 
    COALESCE(NULLIF(TRIM(cp.mat_gestionnaire), ''), 'NON ASSIGNE') AS mat_gestionnaire,
    
    -- Portefeuille
    COUNT(DISTINCT cp.code_client) AS total_clients,
    COUNT(DISTINCT cp.num_compte) AS total_comptes,
    COUNT(DISTINCT CASE WHEN LOWER(TRIM(cp.statut_facturation::text)) = 'en cours' THEN cp.num_compte END) AS comptes_actifs,
    
    -- Charge de travail
    CASE 
        WHEN COUNT(DISTINCT CASE WHEN LOWER(TRIM(cp.statut_facturation::text)) = 'en cours' THEN cp.num_compte END) > 150 THEN 'SURCHARGÉ'
        WHEN COUNT(DISTINCT CASE WHEN LOWER(TRIM(cp.statut_facturation::text)) = 'en cours' THEN cp.num_compte END) < 30 THEN 'SOUS-CHARGÉ'
        ELSE 'OPTIMAL'
    END AS statut_charge,
    
    -- Identification
    ROUND(
        (
            COUNT(DISTINCT CASE WHEN cl.raison_sociale IS NOT NULL AND TRIM(cl.raison_sociale) <> '' THEN cl.code_client END) * 100.0 / 
            NULLIF(COUNT(DISTINCT cl.code_client), 0)
        )::numeric, 2
    ) AS taux_identification_pct,
    
    -- Dette globale accumulée (BALANCE)
    SUM(COALESCE(cp.balance, 0)) AS total_dette_balance_fcfa,
    
    -- Flux du mois
    COALESCE(sf.total_facture_fcfa, 0) AS total_facture_fcfa,
    COALESCE(sf.total_impaye_flux_fcfa, 0) AS total_impaye_flux_fcfa,
    
    -- TAUX DE RECOUVREMENT RÉEL : Ratio Facturation / (Facturation + Dette Balance)
    ROUND(
        (
            COALESCE(sf.total_facture_fcfa, 0) * 100.0 / 
            NULLIF(COALESCE(sf.total_facture_fcfa, 0) + SUM(COALESCE(cp.balance, 0)), 0)
        )::numeric, 2
    ) AS taux_recouvrement_reel_pct,
    
    -- TAUX D'IMPAYÉ (Poids de la dette sur l'activité)
    ROUND(
        (
            SUM(COALESCE(cp.balance, 0)) * 100.0 / 
            NULLIF(COALESCE(sf.total_facture_fcfa, 0) + SUM(COALESCE(cp.balance, 0)), 0)
        )::numeric, 2
    ) AS taux_poids_dette_pct,
    
    -- SCORE DE PERFORMANCE CORRIGÉ : (Taux Recouvrement Réel % - Taux Dette %) + LOG10(Facturé + 1)
    ROUND(
        (
            (
                COALESCE(sf.total_facture_fcfa, 0) * 100.0 / 
                NULLIF(COALESCE(sf.total_facture_fcfa, 0) + SUM(COALESCE(cp.balance, 0)), 0)
            ) - 
            (
                SUM(COALESCE(cp.balance, 0)) * 100.0 / 
                NULLIF(COALESCE(sf.total_facture_fcfa, 0) + SUM(COALESCE(cp.balance, 0)), 0)
            ) + 
            LOG(10, GREATEST(sf.total_facture_fcfa, 0) + 1)
        )::numeric, 2
    ) AS score_performance

FROM compte cp
JOIN client cl ON cp.code_client = cl.code_client
LEFT JOIN stats_factures_gest sf ON cp.mat_gestionnaire = sf.mat_gestionnaire

GROUP BY 
    COALESCE(NULLIF(TRIM(cp.mat_gestionnaire), ''), 'NON ASSIGNE'),
    sf.total_facture_fcfa,
    sf.total_impaye_flux_fcfa;



-- EXECUTION DE LA VUE 
/*
SELECT 
    mat_gestionnaire,
	nom_gestionnaire,
    total_comptes,
    comptes_actifs,
    statut_charge,
    taux_identification_pct,
    total_dette_balance_fcfa,
    taux_recouvrement_pct,
    score_performance,
    DENSE_RANK() OVER (ORDER BY score_performance DESC) AS rang_performance
FROM vw_analyse_gestionnaires_avec_impaye
ORDER BY score_performance DESC;
*/





-- vue client multicompte 

DROP VIEW IF EXISTS vw_clients_multi_comptes CASCADE;

CREATE OR REPLACE VIEW vw_clients_multi_comptes AS
SELECT 
    cl.code_client,
    cl.raison_sociale,
    COUNT(DISTINCT cp.num_compte) AS nb_comptes,
    STRING_AGG(cp.num_compte::text, ', ') AS liste_comptes,
    SUM(GREATEST(COALESCE(cp.balance, 0), 0)) AS total_dette_fcfa
FROM client cl
JOIN compte cp ON cl.code_client = cp.code_client
GROUP BY cl.code_client, cl.raison_sociale
HAVING COUNT(DISTINCT cp.num_compte) > 1;

-- execution de la vue 
-- select * from vw_clients_multi_comptes














-- vue client balance negative

DROP VIEW IF EXISTS vw_clients_balance_negative CASCADE;

CREATE OR REPLACE VIEW vw_clients_balance_negative AS
SELECT 
    cl.code_client,
    cl.raison_sociale,
    COUNT(cp.num_compte) AS total_comptes,
    SUM(cp.balance) AS solde_crediteur_fcfa
FROM client cl
JOIN compte cp ON cl.code_client = cp.code_client
GROUP BY cl.code_client, cl.raison_sociale
HAVING SUM(cp.balance) < 0;



-- execution de la vue 
 -- select * from vw_clients_balance_negative;

















/*
  la vue « vw_tendance_deterioration » n'existe pas, poursuite du traitement
  la vue « vw_spirale_negative » n'existe pas, poursuite du traitement
  la vue « vw_saisonnalite_impayes » n'existe pas, poursuite du traitement
  la vue « vw_cohortes_facturation » n'existe pas, poursuite du traitement
  la vue « vw_aging_impayes » n'existe pas, poursuite du traitement
  la vue « vw_prevision_balance » n'existe pas, poursuite du traitement
  la vue « vw_detection_anomalies_facturation » n'existe pas, poursuite du traitement
*/


-- =============================================================================
-- 1. Tendance de détérioration
-- =============================================================================
DROP VIEW IF EXISTS vw_tendance_deterioration CASCADE;

CREATE OR REPLACE VIEW vw_tendance_deterioration AS
WITH impayes_mensuels AS (
    SELECT 
        num_compte,
        DATE_TRUNC('month', date_emission) AS mois,
        SUM(montant_facture) AS impaye_mois
    FROM facture
    WHERE type_flux = 'IMPAYE'
    GROUP BY num_compte, DATE_TRUNC('month', date_emission)
),
comparaison_mensuelle AS (
    SELECT 
        num_compte,
        mois,
        impaye_mois,
        LAG(impaye_mois) OVER (PARTITION BY num_compte ORDER BY mois) AS impaye_mois_precedent
    FROM impayes_mensuels
)
SELECT 
    num_compte,
    mois,
    impaye_mois_precedent,
    impaye_mois,
    (impaye_mois - COALESCE(impaye_mois_precedent, 0)) AS hausse_impaye_fcfa
FROM comparaison_mensuelle
WHERE impaye_mois > COALESCE(impaye_mois_precedent, 0) 
  AND impaye_mois_precedent IS NOT NULL;


-- =============================================================================
-- 2. Comptes en « spirale négative »
-- =============================================================================
DROP VIEW IF EXISTS vw_spirale_negative CASCADE;

CREATE OR REPLACE VIEW vw_spirale_negative AS
WITH flux_mensuels AS (
    SELECT 
        num_compte,
        DATE_TRUNC('month', date_emission) AS mois,
        SUM(CASE WHEN type_flux = 'FACTURE' THEN montant_facture ELSE 0 END) AS total_facture,
        SUM(CASE WHEN type_flux = 'IMPAYE' THEN montant_facture ELSE 0 END) AS total_impaye
    FROM facture
    GROUP BY num_compte, DATE_TRUNC('month', date_emission)
),
variation_mensuelle AS (
    SELECT 
        num_compte,
        mois,
        total_facture,
        LAG(total_facture) OVER (PARTITION BY num_compte ORDER BY mois) AS fact_prev,
        total_impaye,
        LAG(total_impaye) OVER (PARTITION BY num_compte ORDER BY mois) AS impaye_prev
    FROM flux_mensuels
)
SELECT 
    num_compte,
    mois,
    fact_prev AS facture_mois_prec,
    total_facture AS facture_mois_actuel,
    impaye_prev AS impaye_mois_prec,
    total_impaye AS impaye_mois_actuel
FROM variation_mensuelle
WHERE total_facture < fact_prev 
  AND total_impaye > impaye_prev;


-- =============================================================================
-- 3. Saisonnalité des impayés
-- =============================================================================
DROP VIEW IF EXISTS vw_saisonnalite_impayes CASCADE;

CREATE OR REPLACE VIEW vw_saisonnalite_impayes AS
SELECT 
    EXTRACT(MONTH FROM date_emission) AS numero_mois,
    TO_CHAR(date_emission, 'Month') AS nom_mois,
    COUNT(DISTINCT num_compte) AS nb_comptes_impactes,
    SUM(CASE WHEN type_flux = 'FACTURE' THEN montant_facture ELSE 0 END) AS total_facture_fcfa,
    SUM(CASE WHEN type_flux = 'IMPAYE' THEN montant_facture ELSE 0 END) AS total_impaye_fcfa,
    ROUND(
        (
            SUM(CASE WHEN type_flux = 'IMPAYE' THEN montant_facture ELSE 0 END) * 100.0 / 
            NULLIF(SUM(CASE WHEN type_flux = 'FACTURE' THEN montant_facture ELSE 0 END), 0)
        )::numeric, 2
    ) AS taux_impaye_mensuel_pct
FROM facture
GROUP BY EXTRACT(MONTH FROM date_emission), TO_CHAR(date_emission, 'Month')
ORDER BY total_impaye_fcfa DESC;


-- =============================================================================
-- 4. Cohortes de facturation
-- =============================================================================
DROP VIEW IF EXISTS vw_cohortes_facturation CASCADE;

CREATE OR REPLACE VIEW vw_cohortes_facturation AS
WITH premiere_facture AS (
    SELECT 
        cp.code_client,
        DATE_TRUNC('month', MIN(f.date_emission)) AS cohorte_mois
    FROM compte cp
    JOIN facture f ON cp.num_compte = f.num_compte AND f.status <> 'CANCELLED'
    GROUP BY cp.code_client
)
SELECT 
    pf.cohorte_mois,
    COUNT(DISTINCT pf.code_client) AS taille_cohorte_clients,
    SUM(CASE WHEN f.type_flux = 'FACTURE' THEN f.montant_facture ELSE 0 END) AS volume_facture_total_fcfa,
    SUM(CASE WHEN f.type_flux = 'IMPAYE' THEN f.montant_facture ELSE 0 END) AS volume_impaye_total_fcfa,
    ROUND(
        (
            SUM(CASE WHEN type_flux = 'IMPAYE' THEN f.montant_facture ELSE 0 END) * 100.0 / 
            NULLIF(SUM(CASE WHEN type_flux = 'FACTURE' THEN f.montant_facture ELSE 0 END), 0)
        )::numeric, 2
    ) AS taux_impaye_cohorte_pct
FROM premiere_facture pf
JOIN compte cp ON pf.code_client = cp.code_client
JOIN facture f ON cp.num_compte = f.num_compte AND f.status <> 'CANCELLED'
GROUP BY pf.cohorte_mois
ORDER BY pf.cohorte_mois ASC;


-- =============================================================================
-- 5. Aging des impayés (Balance Âgée)
-- =============================================================================
DROP VIEW IF EXISTS vw_aging_impayes CASCADE;

CREATE OR REPLACE VIEW vw_aging_impayes AS
SELECT 
    cp.code_client,
    cp.num_compte,
    SUM(CASE WHEN (CURRENT_DATE - f.date_emission) BETWEEN 0 AND 30 THEN f.montant_facture ELSE 0 END) AS tranche_0_30_j,
    SUM(CASE WHEN (CURRENT_DATE - f.date_emission) BETWEEN 31 AND 60 THEN f.montant_facture ELSE 0 END) AS tranche_31_60_j,
    SUM(CASE WHEN (CURRENT_DATE - f.date_emission) BETWEEN 61 AND 90 THEN f.montant_facture ELSE 0 END) AS tranche_61_90_j,
    SUM(CASE WHEN (CURRENT_DATE - f.date_emission) > 90 THEN f.montant_facture ELSE 0 END) AS tranche_plus_90_j,
    SUM(f.montant_facture) AS total_impaye_cumule_fcfa
FROM compte cp
JOIN facture f ON cp.num_compte = f.num_compte AND f.status <> 'CANCELLED'
WHERE f.type_flux = 'IMPAYE'
GROUP BY cp.code_client, cp.num_compte;


-- =============================================================================
-- 6. Prévision de balance (Régression linéaire)
-- =============================================================================
DROP VIEW IF EXISTS vw_prevision_balance CASCADE;

CREATE OR REPLACE VIEW vw_prevision_balance AS
WITH historique_indexe AS (
    SELECT 
        num_compte,
        DATE_TRUNC('month', date_emission) AS mois,
        DENSE_RANK() OVER (PARTITION BY num_compte ORDER BY DATE_TRUNC('month', date_emission)) AS x_mois,
        SUM(montant_facture) AS y_montant
    FROM facture
    GROUP BY num_compte, DATE_TRUNC('month', date_emission)
),
statistiques_regression AS (
    SELECT 
        num_compte,
        COUNT(*) AS nombre_mois_obs,
        MAX(x_mois) AS dernier_x,
        REGR_SLOPE(y_montant, x_mois) AS pente_slope,
        REGR_INTERCEPT(y_montant, x_mois) AS ordonnee_intercept
    FROM historique_indexe
    GROUP BY num_compte
    HAVING COUNT(*) >= 2
)
SELECT 
    num_compte,
    nombre_mois_obs,
    ROUND(pente_slope::numeric, 2) AS tendance_variation_mensuelle,
    GREATEST(ROUND((ordonnee_intercept + (pente_slope * (dernier_x + 1)))::numeric, 2), 0) AS projection_mois_suivant_fcfa
FROM statistiques_regression;


-- =============================================================================
-- 7. Détection d’anomalies de facturation
-- =============================================================================
DROP VIEW IF EXISTS vw_detection_anomalies_facturation CASCADE;

CREATE OR REPLACE VIEW vw_detection_anomalies_facturation AS
WITH factures_mensuelles AS (
    SELECT 
        num_compte,
        DATE_TRUNC('month', date_emission) AS mois,
        SUM(montant_facture) AS total_facture
    FROM facture
    WHERE type_flux = 'FACTURE'
    GROUP BY num_compte, DATE_TRUNC('month', date_emission)
),
variations AS (
    SELECT 
        num_compte,
        mois,
        total_facture AS facture_actuelle,
        LAG(total_facture) OVER (PARTITION BY num_compte ORDER BY mois) AS facture_precedente
    FROM factures_mensuelles
)
SELECT 
    num_compte,
    mois,
    facture_precedente,
    facture_actuelle,
    CASE 
        WHEN facture_actuelle >= (facture_precedente * 2) THEN 'AUGMENTATION ANORMALE (X2+)'
        WHEN facture_actuelle <= (facture_precedente / 2) THEN 'CHUTE ANORMALE (/2)'
    END AS type_anomalie,
    ROUND(((facture_actuelle - facture_precedente) * 100.0 / NULLIF(facture_precedente, 0))::numeric, 2) AS variation_pct
FROM variations
WHERE facture_precedente > 0 
  AND (facture_actuelle >= (facture_precedente * 2) OR facture_actuelle <= (facture_precedente / 2));




  -- execution des vues respectivement
  /*
  -- =============================================================================
-- REQUÊTES D'EXÉCUTION ET CONSULTATION DES 7 VUES TEMPORELLES AVANCÉES
-- =============================================================================

-- 1. Consultation de la tendance de détérioration
-- (Affiche les comptes dont les impayés augmentent mois après mois, triés par hausse)
SELECT 
    num_compte,
    mois,
    impaye_mois_precedent,
    impaye_mois,
    hausse_impaye_fcfa
FROM vw_tendance_deterioration
ORDER BY hausse_impaye_fcfa DESC;


-- 2. Consultation des comptes en spirale négative
-- (Affiche les comptes avec baisse de facturation et hausse des impayés)
SELECT 
    num_compte,
    mois,
    facture_mois_prec,
    facture_mois_actuel,
    impaye_mois_prec,
    impaye_mois_actuel
FROM vw_spirale_negative
ORDER BY mois DESC, impaye_mois_actuel DESC;


-- 3. Consultation de la saisonnalité des impayés
-- (Affiche la répartition mensuelle et identifie les mois d'explosion des impayés)
SELECT 
    numero_mois,
    nom_mois,
    nb_comptes_impactes,
    total_facture_fcfa,
    total_impaye_fcfa,
    taux_impaye_mensuel_pct
FROM vw_saisonnalite_impayes
ORDER BY total_impaye_fcfa DESC;


-- 4. Consultation des cohortes de facturation
-- (Analyse le comportement des clients selon leur mois d'acquisition/première facture)
SELECT 
    cohorte_mois,
    taille_cohorte_clients,
    volume_facture_total_fcfa,
    volume_impaye_total_fcfa,
    taux_impaye_cohorte_pct
FROM vw_cohortes_facturation
ORDER BY cohorte_mois ASC;


-- 5. Consultation du Aging des impayés (Balance Âgée)
-- (Ventile les retards de paiement par tranche : 0-30j, 31-60j, 61-90j, +90j)
SELECT 
    code_client,
    num_compte,
    tranche_0_30_j,
    tranche_31_60_j,
    tranche_61_90_j,
    tranche_plus_90_j,
    total_impaye_cumule_fcfa
FROM vw_aging_impayes
ORDER BY total_impaye_cumule_fcfa DESC;


-- 6. Consultation des prévisions de balance
-- (Calcul de la tendance par régression linéaire et projection pour le mois N+1)
SELECT 
    num_compte,
    nombre_mois_obs,
    tendance_variation_mensuelle,
    projection_mois_suivant_fcfa
FROM vw_prevision_balance
ORDER BY projection_mois_suivant_fcfa DESC;


-- 7. Consultation des détections d'anomalies de facturation
-- (Identifie les variations brutales : factures x2 ou /2 d'un mois à l'autre)
SELECT 
    num_compte,
    mois,
    facture_precedente,
    facture_actuelle,
    type_anomalie,
    variation_pct
FROM vw_detection_anomalies_facturation
ORDER BY mois DESC, ABS(variation_pct) DESC;

*/














/*
Qualité Identification : % Non identifié / Identifié / En cours de vérification

Complétude des contacts : comptes sans Email, sans Téléphone, sans Adresse

Doublons potentiels : même Code client + raisons sociales différentes

Comptes orphelins : sans Gestionnaire ou sans Agence

Incohérences : Facture > 0 mais Statut = Arrêt

E-Bill adoption : Oui vs Non + corrélation avec le taux d’impayés 

*/


-- =============================================================================
-- VUES OPÉRATIONNELLES & QUALITÉ DE DONNÉES
-- =============================================================================

-- 1. Qualité Identification : % Non identifié / Identifié / En cours
DROP VIEW IF EXISTS vw_qualite_identification CASCADE;

CREATE OR REPLACE VIEW vw_qualite_identification AS
SELECT 
    COALESCE(identification, 'Non renseigné') AS status_identification,
    COUNT(num_compte) AS nb_comptes,
    ROUND((COUNT(num_compte) * 100.0 / SUM(COUNT(num_compte)) OVER ()), 2) AS pourcentage_pct
FROM compte
GROUP BY identification
ORDER BY nb_comptes DESC;


-- 2. Complétude des contacts : clients/comptes sans Email, sans Téléphone
DROP VIEW IF EXISTS vw_completude_contacts CASCADE;

CREATE OR REPLACE VIEW vw_completude_contacts AS
SELECT 
    cl.code_client,
    cl.raison_sociale,
    cp.num_compte,
    CASE WHEN cl.email IS NULL OR TRIM(cl.email) = '' THEN 'Email Manquant' ELSE 'OK' END AS statut_email,
    CASE WHEN cl.tel IS NULL THEN 'Téléphone Manquant' ELSE 'OK' END AS statut_tel
FROM client cl
JOIN compte cp ON cl.code_client = cp.code_client
WHERE cl.email IS NULL OR TRIM(cl.email) = '' OR cl.tel IS NULL;


-- 3. Doublons potentiels : même raison sociale attribuée à des codes clients différents
DROP VIEW IF EXISTS vw_doublons_potentiels CASCADE;

CREATE OR REPLACE VIEW vw_doublons_potentiels AS
SELECT 
    LOWER(TRIM(raison_sociale)) AS raison_sociale_nettoyee,
    COUNT(DISTINCT code_client) AS nombre_codes_clients_differents,
    STRING_AGG(DISTINCT code_client::text, ' | ') AS codes_clients_associes
FROM client
GROUP BY LOWER(TRIM(raison_sociale))
HAVING COUNT(DISTINCT code_client) > 1;


-- 4. Comptes orphelins : détection des valeurs génériques ou non attribuées (nan, None, NON SPÉCIFIÉ)
DROP VIEW IF EXISTS vw_comptes_orphelins CASCADE;

CREATE OR REPLACE VIEW vw_comptes_orphelins AS
SELECT 
    cp.num_compte,
    cp.code_client,
    cp.mat_gestionnaire,
    cp.id_agence,
    CASE 
        WHEN (cp.mat_gestionnaire IS NULL OR cp.mat_gestionnaire IN ('nan', 'None', '', 'NON SPÉCIFIÉ'))
         AND (cp.id_agence IS NULL OR cp.id_agence IN ('AG_nan', 'AG_None', '', 'AG_NON SPÉCIFIÉ'))
        THEN 'Sans Gestionnaire ET Sans Agence'
        WHEN cp.mat_gestionnaire IS NULL OR cp.mat_gestionnaire IN ('nan', 'None', '', 'NON SPÉCIFIÉ')
        THEN 'Gestionnaire Non Défini'
        WHEN cp.id_agence IS NULL OR cp.id_agence IN ('AG_nan', 'AG_None', '', 'AG_NON SPÉCIFIÉ')
        THEN 'Agence Non Définie'
    END AS motif_orphelin
FROM compte cp
WHERE cp.mat_gestionnaire IS NULL 
   OR cp.mat_gestionnaire IN ('nan', 'None', '', 'NON SPÉCIFIÉ')
   OR cp.id_agence IS NULL 
   OR cp.id_agence IN ('AG_nan', 'AG_None', '', 'AG_NON SPÉCIFIÉ');


-- 5. Incohérences : Facture > 0 mais Statut = Arrêt
DROP VIEW IF EXISTS vw_incoherences_facturation CASCADE;

CREATE OR REPLACE VIEW vw_incoherences_facturation AS
SELECT 
    cp.num_compte,
    cp.code_client,
    cp.statut_facturation,
    f.id_facture,
    f.libelle_periode,
    f.montant_facture
FROM compte cp
JOIN facture f ON cp.num_compte = f.num_compte AND f.status <> 'CANCELLED'
WHERE (UPPER(cp.statut_facturation) LIKE '%ARRÊT%' OR UPPER(cp.statut_facturation) LIKE '%ARRET%')
  AND f.type_flux = 'FACTURE'
  AND f.montant_facture > 0;


-- 6. E-Bill adoption : Oui vs Non + corrélation avec le taux d'impayés
DROP VIEW IF EXISTS vw_ebill_adoption CASCADE;

CREATE OR REPLACE VIEW vw_ebill_adoption AS
SELECT 
    COALESCE(cp.e_bill, 'NON SPÉCIFIÉ') AS statut_ebill,
    COUNT(DISTINCT cp.num_compte) AS nb_comptes,
    SUM(CASE WHEN f.type_flux = 'FACTURE' THEN f.montant_facture ELSE 0 END) AS total_facture_fcfa,
    SUM(CASE WHEN f.type_flux = 'IMPAYE' THEN f.montant_facture ELSE 0 END) AS total_impaye_fcfa,
    ROUND(
        (
            SUM(CASE WHEN f.type_flux = 'IMPAYE' THEN f.montant_facture ELSE 0 END) * 100.0 / 
            NULLIF(SUM(CASE WHEN f.type_flux = 'FACTURE' THEN f.montant_facture ELSE 0 END), 0)
        )::numeric, 2
    ) AS taux_impaye_pct
FROM compte cp
LEFT JOIN facture f ON cp.num_compte = f.num_compte AND (f.status <> 'CANCELLED' OR f.status IS NULL)
GROUP BY cp.e_bill;




-- execution des vues
/*

-- =============================================================================
-- REQUÊTES D'EXÉCUTION ET CONSULTATION DES 6 VUES OPÉRATIONNELLES & QUALITÉ
-- =============================================================================

-- 1. Consultation de la Qualité d'Identification
SELECT * 
FROM vw_qualite_identification;

-- 2. Consultation de la Complétude des Contacts
SELECT * 
FROM vw_completude_contacts 
LIMIT 100;

-- 3. Consultation des Doublons Potentiels (raisons sociales identiques sur plusieurs codes)
SELECT * 
FROM vw_doublons_potentiels;

-- 4. Consultation des Comptes Orphelins (gestionnaire ou agence non définis)
SELECT * 
FROM vw_comptes_orphelins;

-- 5. Consultation des Incohérences de Facturation (comptes en arrêt facturés)
SELECT * 
FROM vw_incoherences_facturation;

-- 6. Consultation de l'Adoption E-Bill et Taux d'Impayés
SELECT * 
FROM vw_ebill_adoption;

*/














/*
Indice de fragilité du portefeuille

Mesure la concentration des impayés sur un petit nombre de gros clients (Pareto).

Matrice de migration d’état

Combien de comptes sont passés de « En cours » → « Arrêt » et inversement entre deux mois.

Corrélation Gestionnaire × Marché

Quels gestionnaires performent mieux sur quel type de marché (PRO vs PAR vs OFF).

Détection de « comptes zombies »

Facture = 0 + Impayés = 0 + Balance > 0 depuis plusieurs mois.

Score d’effort de recouvrement

Ratio (Impayés actuels) / (moyenne des factures des 3 derniers mois).

Réseau de clients liés

Clients partageant le même numéro de téléphone, email ou adresse (graphe de relations).

Prédiction de passage en impayé

Sur la base du comportement des 3-4 mois précédents.

Vue « Shadow » des résiliations

Comptes qui ont une balance élevée au moment du passage en « Arrêt ».

Analyse de la fiscalité

Répartition Full Tax / No Tax / vide + impact sur le recouvrement.

Cycle de facturation vs performance

Les clients en cycle 1 vs cycle 15 : qui paie mieux ?

Vue temporelle inversée

Au lieu de regarder l’évolution des impayés, regarder l’évolution de la capacité de paiement (Facture – Impayés).

Détection de pics artificiels

Mois où beaucoup de factures ont exactement le même montant (possible régularisation massive). 


*/


-- =============================================================================
-- VUES « GÉNIE » (ANALYTIQUE AVANCÉE ET DÉTECTION ANOMALIES)
-- =============================================================================

-- 1. Indice de fragilité du portefeuille (Concentration Pareto des impayés par client)
DROP VIEW IF EXISTS vw_indice_fragilite CASCADE;

CREATE OR REPLACE VIEW vw_indice_fragilite AS
WITH impayes_clients AS (
    SELECT 
        cp.code_client,
        cl.raison_sociale,
        SUM(f.montant_facture) AS total_impaye_client
    FROM compte cp
    JOIN client cl ON cp.code_client = cl.code_client
    JOIN facture f ON cp.num_compte = f.num_compte AND f.status <> 'CANCELLED'
    WHERE f.type_flux = 'IMPAYE'
    GROUP BY cp.code_client, cl.raison_sociale
),
cumul_impayes AS (
    SELECT 
        code_client,
        raison_sociale,
        total_impaye_client,
        SUM(total_impaye_client) OVER (ORDER BY total_impaye_client DESC) AS cumul_impaye,
        SUM(total_impaye_client) OVER () AS grand_total_impaye
    FROM impayes_clients
)
SELECT 
    code_client,
    raison_sociale,
    total_impaye_client,
    ROUND((total_impaye_client * 100.0 / NULLIF(grand_total_impaye, 0))::numeric, 2) AS part_impaye_pct,
    ROUND((cumul_impaye * 100.0 / NULLIF(grand_total_impaye, 0))::numeric, 2) AS part_cumulee_pct,
    CASE 
        WHEN (cumul_impaye * 100.0 / NULLIF(grand_total_impaye, 0)) <= 80 THEN 'Top 80% (Critique - Pareto)'
        ELSE 'Reste du Portefeuille'
    END AS categorie_criticitie
FROM cumul_impayes
ORDER BY total_impaye_client DESC;


-- 2. Matrice de migration d'état (Suivi des changements de statut d'un mois à l'autre)
DROP VIEW IF EXISTS vw_matrice_migration_etat CASCADE;

CREATE OR REPLACE VIEW vw_matrice_migration_etat AS
WITH historique_statut AS (
    SELECT DISTINCT
        f.num_compte,
        DATE_TRUNC('month', f.date_emission) AS mois,
        cp.statut_facturation AS statut_actuel
    FROM facture f
    JOIN compte cp ON f.num_compte = cp.num_compte
),
migrations AS (
    SELECT 
        num_compte,
        mois,
        LAG(statut_actuel) OVER (PARTITION BY num_compte ORDER BY mois) AS statut_precedent,
        statut_actuel
    FROM historique_statut
)
SELECT 
    mois,
    COALESCE(statut_precedent, 'Nouveau / Inconnu') AS ancien_statut,
    statut_actuel,
    COUNT(DISTINCT num_compte) AS nb_comptes_migres
FROM migrations
WHERE statut_precedent IS DISTINCT FROM statut_actuel
GROUP BY mois, statut_precedent, statut_actuel
ORDER BY mois DESC, nb_comptes_migres DESC;


-- 3. Corrélation Gestionnaire × Marché
DROP VIEW IF EXISTS vw_performance_gestionnaire_marche CASCADE;

CREATE OR REPLACE VIEW vw_performance_gestionnaire_marche AS
SELECT 
    g.mat_gestionnaire,
    g.nom_gestionnaire,
    cl.marche,
    COUNT(DISTINCT cp.num_compte) AS nb_comptes_geres,
    SUM(CASE WHEN f.type_flux = 'FACTURE' THEN f.montant_facture ELSE 0 END) AS total_facture_fcfa,
    SUM(CASE WHEN f.type_flux = 'IMPAYE' THEN f.montant_facture ELSE 0 END) AS total_impaye_fcfa,
    ROUND(
        (
            SUM(CASE WHEN f.type_flux = 'IMPAYE' THEN f.montant_facture ELSE 0 END) * 100.0 / 
            NULLIF(SUM(CASE WHEN f.type_flux = 'FACTURE' THEN f.montant_facture ELSE 0 END), 0)
        )::numeric, 2
    ) AS taux_impaye_pct
FROM gestionnaire g
JOIN compte cp ON g.mat_gestionnaire = cp.mat_gestionnaire
JOIN client cl ON cp.code_client = cl.code_client
LEFT JOIN facture f ON cp.num_compte = f.num_compte AND (f.status <> 'CANCELLED' OR f.status IS NULL)
GROUP BY g.mat_gestionnaire, g.nom_gestionnaire, cl.marche
ORDER BY total_impaye_fcfa DESC;


-- 4. Détection de « comptes zombies » (Balance > 0 sans aucune facture/impayé récent)
DROP VIEW IF EXISTS vw_comptes_zombies CASCADE;

CREATE OR REPLACE VIEW vw_comptes_zombies AS
WITH activite_facture AS (
    SELECT 
        num_compte,
        SUM(montant_facture) AS flux_total
    FROM facture
    GROUP BY num_compte
)
SELECT 
    cp.num_compte,
    cp.code_client,
    cp.balance AS balance_inactif,
    cp.statut_facturation,
    COALESCE(af.flux_total, 0) AS total_flux_factures
FROM compte cp
LEFT JOIN activite_facture af ON cp.num_compte = af.num_compte
WHERE cp.balance > 0 
  AND (af.flux_total IS NULL OR af.flux_total = 0);


-- 5. Score d'effort de recouvrement (Impayé actuel / Moyenne facturation 3 derniers mois)
DROP VIEW IF EXISTS vw_score_effort_recouvrement CASCADE;

CREATE OR REPLACE VIEW vw_score_effort_recouvrement AS
WITH moyennes_factures AS (
    SELECT 
        num_compte,
        AVG(montant_facture) AS moyenne_facture_mensuelle
    FROM facture
    WHERE type_flux = 'FACTURE'
    GROUP BY num_compte
),
totaux_impayes AS (
    SELECT 
        num_compte,
        SUM(montant_facture) AS impaye_total
    FROM facture
    WHERE type_flux = 'IMPAYE'
    GROUP BY num_compte
)
SELECT 
    cp.num_compte,
    cp.code_client,
    COALESCE(ti.impaye_total, 0) AS impaye_total_fcfa,
    ROUND(COALESCE(mf.moyenne_facture_mensuelle, 0)::numeric, 2) AS moy_facture_mensuelle_fcfa,
    ROUND(
        (COALESCE(ti.impaye_total, 0) / NULLIF(mf.moyenne_facture_mensuelle, 0))::numeric, 2
    ) AS score_effort_recouvrement
FROM compte cp
JOIN moyennes_factures mf ON cp.num_compte = mf.num_compte
JOIN totaux_impayes ti ON cp.num_compte = ti.num_compte
WHERE mf.moyenne_facture_mensuelle > 0
ORDER BY score_effort_recouvrement DESC;


-- 6. Réseau de clients liés (Graphe de relations par Téléphone ou Email)
DROP VIEW IF EXISTS vw_reseau_clients_lies CASCADE;

CREATE OR REPLACE VIEW vw_reseau_clients_lies AS
SELECT 
    c1.code_client AS client_source,
    c1.raison_sociale AS nom_client_source,
    c2.code_client AS client_lie,
    c2.raison_sociale AS nom_client_lie,
    CASE 
        WHEN c1.email = c2.email AND c1.tel = c2.tel THEN 'Email ET Téléphone identiques'
        WHEN c1.email = c2.email THEN 'Même Email'
        WHEN c1.tel = c2.tel THEN 'Même Téléphone'
    END AS lien_detecte,
    COALESCE(c1.email, 'N/A') AS email_commun,
    COALESCE(c1.tel::text, 'N/A') AS tel_commun
FROM client c1
JOIN client c2 ON (c1.email = c2.email OR c1.tel = c2.tel) AND c1.code_client < c2.code_client
WHERE (c1.email IS NOT NULL AND c1.email != '') OR c1.tel IS NOT NULL;


-- 7. Prédiction de passage en impayé (Inflexion du taux d'impayé sur les mois récents)
DROP VIEW IF EXISTS vw_prediction_passage_impaye CASCADE;

CREATE OR REPLACE VIEW vw_prediction_passage_impaye AS
WITH historique_mensuel AS (
    SELECT 
        num_compte,
        DATE_TRUNC('month', date_emission) AS mois,
        SUM(CASE WHEN type_flux = 'FACTURE' THEN montant_facture ELSE 0 END) AS fact,
        SUM(CASE WHEN type_flux = 'IMPAYE' THEN montant_facture ELSE 0 END) AS imp
    FROM facture
    GROUP BY num_compte, DATE_TRUNC('month', date_emission)
),
tendances AS (
    SELECT 
        num_compte,
        mois,
        imp,
        LAG(imp, 1) OVER (PARTITION BY num_compte ORDER BY mois) AS imp_m1,
        LAG(imp, 2) OVER (PARTITION BY num_compte ORDER BY mois) AS imp_m2
    FROM historique_mensuel
)
SELECT 
    num_compte,
    mois AS dernier_mois_consulte,
    imp_m2 AS impaye_mois_m2,
    imp_m1 AS impaye_mois_m1,
    imp AS impaye_mois_actuel,
    CASE 
        WHEN imp > imp_m1 AND imp_m1 > COALESCE(imp_m2, 0) THEN 'RISQUE ÉLEVÉ : Dégradation Continue'
        WHEN imp > 0 AND COALESCE(imp_m1, 0) = 0 THEN 'ATTENTION : Premier Décrochage'
        ELSE 'Risque Modéré / Stable'
    END AS niveau_risque_impaye
FROM tendances
WHERE imp > imp_m1;


-- 8. Vue « Shadow » des résiliations (Balance élevée au moment de l'Arrêt)
DROP VIEW IF EXISTS vw_shadow_resiliations CASCADE;

CREATE OR REPLACE VIEW vw_shadow_resiliations AS
SELECT 
    cp.num_compte,
    cp.code_client,
    cl.raison_sociale,
    cp.statut_facturation,
    cp.balance AS balance_au_passage_arret,
    g.nom_gestionnaire,
    a.nom_agence
FROM compte cp
JOIN client cl ON cp.code_client = cl.code_client
LEFT JOIN gestionnaire g ON cp.mat_gestionnaire = g.mat_gestionnaire
LEFT JOIN agence a ON cp.id_agence = a.id_agence
WHERE (UPPER(cp.statut_facturation) LIKE '%ARRÊT%' OR UPPER(cp.statut_facturation) LIKE '%ARRET%')
  AND cp.balance > 0
ORDER BY cp.balance DESC;


-- 9. Analyse de la fiscalité / Facturation (Impact sur le recouvrement)
DROP VIEW IF EXISTS vw_analyse_fiscalite_recouvrement CASCADE;

CREATE OR REPLACE VIEW vw_analyse_fiscalite_recouvrement AS
SELECT 
    COALESCE(cp.statut_facturation, 'NON SPÉCIFIÉ') AS type_facturation,
    COUNT(DISTINCT cp.num_compte) AS nb_comptes,
    SUM(CASE WHEN f.type_flux = 'FACTURE' THEN f.montant_facture ELSE 0 END) AS total_facture_fcfa,
    SUM(CASE WHEN f.type_flux = 'IMPAYE' THEN f.montant_facture ELSE 0 END) AS total_impaye_fcfa,
    ROUND(
        (
            SUM(CASE WHEN f.type_flux = 'IMPAYE' THEN f.montant_facture ELSE 0 END) * 100.0 / 
            NULLIF(SUM(CASE WHEN f.type_flux = 'FACTURE' THEN f.montant_facture ELSE 0 END), 0)
        )::numeric, 2
    ) AS taux_impaye_pct
FROM compte cp
LEFT JOIN facture f ON cp.num_compte = f.num_compte AND (f.status <> 'CANCELLED' OR f.status IS NULL)
GROUP BY cp.statut_facturation
ORDER BY total_impaye_fcfa DESC;


-- 10. Cycle de facturation vs performance
DROP VIEW IF EXISTS vw_cycle_facturation_performance CASCADE;

CREATE OR REPLACE VIEW vw_cycle_facturation_performance AS
SELECT 
    cp.statut_facturation AS cycle_ou_statut_facturation,
    COUNT(DISTINCT cp.num_compte) AS nombre_comptes,
    SUM(CASE WHEN f.type_flux = 'FACTURE' THEN f.montant_facture ELSE 0 END) AS total_facture_fcfa,
    SUM(CASE WHEN f.type_flux = 'IMPAYE' THEN f.montant_facture ELSE 0 END) AS total_impaye_fcfa,
    ROUND(
        (
            SUM(CASE WHEN f.type_flux = 'IMPAYE' THEN f.montant_facture ELSE 0 END) * 100.0 / 
            NULLIF(SUM(CASE WHEN f.type_flux = 'FACTURE' THEN f.montant_facture ELSE 0 END), 0)
        )::numeric, 2
    ) AS taux_impaye_pct
FROM compte cp
LEFT JOIN facture f ON cp.num_compte = f.num_compte AND (f.status <> 'CANCELLED' OR f.status IS NULL)
GROUP BY cp.statut_facturation
ORDER BY total_facture_fcfa DESC;


-- 11. Vue temporelle inversée (Capacité de paiement = Facture - Impayés)
DROP VIEW IF EXISTS vw_capacite_paiement_temporelle CASCADE;

CREATE OR REPLACE VIEW vw_capacite_paiement_temporelle AS
SELECT 
    DATE_TRUNC('month', date_emission) AS mois,
    SUM(CASE WHEN type_flux = 'FACTURE' THEN montant_facture ELSE 0 END) AS total_facture_fcfa,
    SUM(CASE WHEN type_flux = 'IMPAYE' THEN montant_facture ELSE 0 END) AS total_impaye_fcfa,
    (
        SUM(CASE WHEN type_flux = 'FACTURE' THEN montant_facture ELSE 0 END) - 
        SUM(CASE WHEN type_flux = 'IMPAYE' THEN montant_facture ELSE 0 END)
    ) AS capacite_paiement_encaissee_fcfa,
    ROUND(
        (
            (
                SUM(CASE WHEN type_flux = 'FACTURE' THEN montant_facture ELSE 0 END) - 
                SUM(CASE WHEN type_flux = 'IMPAYE' THEN montant_facture ELSE 0 END)
            ) * 100.0 / 
            NULLIF(SUM(CASE WHEN type_flux = 'FACTURE' THEN montant_facture ELSE 0 END), 0)
        )::numeric, 2
    ) AS taux_recouvrement_effectif_pct
FROM facture
WHERE status <> 'CANCELLED'
GROUP BY DATE_TRUNC('month', date_emission)
ORDER BY mois ASC;


-- 12. Détection de pics artificiels (Factures récurrentes ayant un montant identique au FCFA près)
DROP VIEW IF EXISTS vw_detection_pics_artificiels CASCADE;

CREATE OR REPLACE VIEW vw_detection_pics_artificiels AS
SELECT 
    montant_facture,
    COUNT(*) AS nombre_occurrences,
    COUNT(DISTINCT num_compte) AS nombre_comptes_touches,
    SUM(montant_facture) AS volume_financier_total_fcfa
FROM facture
WHERE type_flux = 'FACTURE' AND montant_facture > 0
GROUP BY montant_facture
HAVING COUNT(*) > 50
ORDER BY nombre_occurrences DESC;


-- execution 

/*
-- =============================================================================
-- REQUÊTES D'EXÉCUTION ET CONSULTATION DES 12 VUES « GÉNIE »
-- =============================================================================

-- 1. Concentration Pareto des impayés
SELECT * FROM vw_indice_fragilite LIMIT 100;

-- 2. Migrations de statuts entre mois
SELECT * FROM vw_matrice_migration_etat;

-- 3. Matrice Gestionnaire x Marché
SELECT * FROM vw_performance_gestionnaire_marche;

-- 4. Comptes Zombies (Balance isolée sans flux)
SELECT * FROM vw_comptes_zombies;

-- 5. Score d'effort de recouvrement
SELECT * FROM vw_score_effort_recouvrement LIMIT 100;

-- 6. Réseau de clients liés
SELECT * FROM vw_reseau_clients_lies;

-- 7. Détection prédictive du passage en impayé
SELECT * FROM vw_prediction_passage_impaye LIMIT 100;

-- 8. Vue Shadow des comptes arrêtés avec solde débiteur
SELECT * FROM vw_shadow_resiliations LIMIT 100;

-- 9. Impact Fiscalité / Statut de Facturation
SELECT * FROM vw_analyse_fiscalite_recouvrement;

-- 10. Performance selon Cycle/Statut
SELECT * FROM vw_cycle_facturation_performance;

-- 11. Capacité de paiement et encaissement réel
SELECT * FROM vw_capacite_paiement_temporelle;

-- 12. Repérage des montants identiques répétés (Régularisations)
SELECT * FROM vw_detection_pics_artificiels;
*/


















-- =============================================================================
-- REQUÊTES ET VUES TRANSVERSALES ULTRA-PUISSANTES (PRÊTES POUR BACKEND)
-- =============================================================================

-- 1. Multi-sélection Centre + Agence + Gestionnaire
-- (Exemple de requête paramétrable pour API/Backend)
SELECT 
    cp.num_compte,
    cp.code_client,
    cl.raison_sociale,
    c.nom_centre,
    a.nom_agence,
    g.nom_gestionnaire,
    cp.balance
FROM compte cp
JOIN client cl ON cp.code_client = cl.code_client
JOIN agence a ON cp.id_agence = a.id_agence
JOIN centre c ON a.nom_centre = c.nom_centre
JOIN gestionnaire g ON cp.mat_gestionnaire = g.mat_gestionnaire
WHERE c.nom_centre IN ('CENTRE_EXEMPLE')      -- Remplacer ou passer dynamiquement depuis l'API
  AND a.id_agence IN ('AG_EXEMPLE')            -- Remplacer par la liste sélectionnée
  AND g.mat_gestionnaire IN ('MAT_EXEMPLE');   -- Remplacer par la liste sélectionnée


-- 2. Segmentation par Plage de Balance
DROP VIEW IF EXISTS vw_segmentation_plage_balance CASCADE;

CREATE OR REPLACE VIEW vw_segmentation_plage_balance AS
SELECT 
    num_compte,
    code_client,
    balance,
    CASE 
        WHEN balance <= 0 THEN '01. Solde Nul ou Créditeur'
        WHEN balance > 0 AND balance <= 100000 THEN '02. Petit Solde (0 - 100k FCFA)'
        WHEN balance > 100000 AND balance <= 1000000 THEN '03. Solde Moyen (100k - 1M FCFA)'
        WHEN balance > 1000000 THEN '04. Solde Majeur (> 1M FCFA)'
    END AS tranche_balance
FROM compte;


-- 3. Ancienneté maximale des impayés par compte (Calculée)
DROP VIEW IF EXISTS vw_anciennete_max_impayes CASCADE;

CREATE OR REPLACE VIEW vw_anciennete_max_impayes AS
SELECT 
    num_compte,
    COUNT(id_facture) AS nb_factures_impayees,
    SUM(montant_facture) AS total_impaye_fcfa,
    MIN(date_emission) AS date_premiere_facture_impayee,
    (CURRENT_DATE - MIN(date_emission)) AS anciennete_max_jours
FROM facture
WHERE type_flux = 'IMPAYE'
GROUP BY num_compte;


-- 4. Cible prioritaire : E-Bill = Oui + Non Identifié
DROP VIEW IF EXISTS vw_cible_prioritaire_ebill_non_identifie CASCADE;

CREATE OR REPLACE VIEW vw_cible_prioritaire_ebill_non_identifie AS
SELECT 
    cp.num_compte,
    cp.code_client,
    cl.raison_sociale,
    cl.email,
    cl.tel,
    cp.e_bill,
    cp.identification,
    cp.balance
FROM compte cp
JOIN client cl ON cp.code_client = cl.code_client
WHERE UPPER(cp.e_bill) LIKE '%OUI%'
  AND UPPER(cp.identification) LIKE '%NON%';


-- 5. Multi-comptes : Même Code Client rattaché à plusieurs comptes
DROP VIEW IF EXISTS vw_multi_comptes_client CASCADE;

CREATE OR REPLACE VIEW vw_multi_comptes_client AS
SELECT 
    cl.code_client,
    cl.raison_sociale,
    COUNT(cp.num_compte) AS nb_comptes_rattaches,
    SUM(cp.balance) AS balance_cumulee_client
FROM client cl
JOIN compte cp ON cl.code_client = cp.code_client
GROUP BY cl.code_client, cl.raison_sociale
HAVING COUNT(cp.num_compte) > 1;


-- 6. Marché Public (OFF) avec impayés de plus de 3 mois (90 jours)
DROP VIEW IF EXISTS vw_marche_off_impayes_3mois CASCADE;

CREATE OR REPLACE VIEW vw_marche_off_impayes_3mois AS
SELECT 
    cl.code_client,
    cl.raison_sociale,
    cl.marche,
    cp.num_compte,
    f.id_facture,
    f.outstanding_amount AS montant_impaye,
    f.date_emission,
    (CURRENT_DATE - f.date_emission) AS retard_jours
FROM client cl
JOIN compte cp ON cl.code_client = cp.code_client
JOIN facture f ON cp.num_compte = f.num_compte AND f.status <> 'CANCELLED'
WHERE UPPER(cl.marche) LIKE '%OFF%'
  AND f.type_flux = 'IMPAYE'
  AND (CURRENT_DATE - f.date_emission) > 90;


-- =============================================================================
-- REQUÊTES D'EXÉCUTION ET CONSULTATION
-- =============================================================================
/*
-- 1. Consultation des Tranches de Balance
SELECT tranche_balance, COUNT(*) AS nb_comptes, SUM(balance) AS total_balance 
FROM vw_segmentation_plage_balance 
GROUP BY tranche_balance 
ORDER BY tranche_balance;

-- 2. Consultation des comptes avec leur Ancienneté d'Impayé (en jours)
SELECT * FROM vw_anciennete_max_impayes ORDER BY anciennete_max_jours DESC LIMIT 100;

-- 3. Consultation de la Cible Prioritaire (E-Bill + Non Identifié)
SELECT * FROM vw_cible_prioritaire_ebill_non_identifie;

-- 4. Consultation des Clients ayant plusieurs Comptes
SELECT * FROM vw_multi_comptes_client ORDER BY nb_comptes_rattaches DESC;

-- 5. Consultation du Marché Public (OFF) en retard > 90 jours
SELECT * FROM vw_marche_off_impayes_3mois ORDER BY retard_jours DESC;

*/



