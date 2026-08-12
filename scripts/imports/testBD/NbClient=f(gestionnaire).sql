SELECT 
    g.mat_gestionnaire,
    g.nom_gestionnaire,
    COUNT(DISTINCT c.code_client) AS nb_clients
FROM gestionnaire g
JOIN compte c ON g.mat_gestionnaire = c.mat_gestionnaire
GROUP BY g.mat_gestionnaire, g.nom_gestionnaire
ORDER BY nb_clients DESC
LIMIT 10;