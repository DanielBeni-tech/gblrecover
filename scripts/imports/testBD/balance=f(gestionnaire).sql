SELECT 
    g.mat_gestionnaire,
    g.nom_gestionnaire,
    COUNT(c.num_compte) AS nb_comptes,
    SUM(c.balance) AS balance_totale
FROM gestionnaire g
JOIN compte c ON g.mat_gestionnaire = c.mat_gestionnaire
GROUP BY g.mat_gestionnaire, g.nom_gestionnaire
ORDER BY balance_totale DESC
LIMIT 10;