SELECT 
    identification,
    COUNT(*) AS nombre_comptes,
    ROUND(SUM(balance)::numeric, 2) AS solde_total
FROM compte
GROUP BY identification
ORDER BY nombre_comptes DESC;