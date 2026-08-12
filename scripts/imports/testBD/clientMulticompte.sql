SELECT 
    cl.code_client,
    cl.raison_sociale,
    COUNT(c.num_compte) AS nombre_de_comptes,
    ROUND(SUM(c.balance)::numeric, 2) AS dette_totale
FROM client cl
JOIN compte c ON cl.code_client = c.code_client
GROUP BY cl.code_client, cl.raison_sociale
HAVING COUNT(c.num_compte) > 5
ORDER BY nombre_de_comptes DESC
LIMIT 10;