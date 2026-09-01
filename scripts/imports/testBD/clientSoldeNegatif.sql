SELECT 
    cl.code_client,
    cl.raison_sociale,
    ROUND(SUM(c.balance)::numeric, 2) AS solde_crediteur_fcfa
FROM client cl
JOIN compte c ON cl.code_client = c.code_client
WHERE c.balance < 0
GROUP BY cl.code_client, cl.raison_sociale
ORDER BY solde_crediteur_fcfa ASC
LIMIT 10;