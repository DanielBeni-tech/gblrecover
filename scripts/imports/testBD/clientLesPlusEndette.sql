SELECT 
    cl.code_client,
    cl.raison_sociale,
    ROUND(SUM(c.balance)::numeric, 2) AS total_dette_fcfa
FROM client cl
JOIN compte c ON cl.code_client = c.code_client
GROUP BY cl.code_client, cl.raison_sociale
ORDER BY total_dette_fcfa DESC
LIMIT 5;