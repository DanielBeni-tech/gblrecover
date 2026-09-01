SELECT 
    CASE 
        WHEN balance < 0 THEN 'Comptes Créditeurs (Balance < 0)'
        ELSE 'Comptes Débiteurs (Balance > 0)'
    END AS type_solde,
    COUNT(*) AS nombre_comptes,
    ROUND(SUM(balance)::numeric, 2) AS montant_total_fcfa
FROM compte
GROUP BY 
    CASE 
        WHEN balance < 0 THEN 'Comptes Créditeurs (Balance < 0)'
        ELSE 'Comptes Débiteurs (Balance > 0)'
    END;