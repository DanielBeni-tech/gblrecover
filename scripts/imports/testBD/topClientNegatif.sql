SELECT 
    cl.code_client,
    cl.raison_sociale,
    ROUND(SUM(c.balance)::numeric, 2) AS solde_net_global
FROM client cl
JOIN compte c ON cl.code_client = c.code_client
GROUP BY cl.code_client, cl.raison_sociale
HAVING SUM(c.balance) < 0
ORDER BY solde_net_global ASC
LIMIT 5;