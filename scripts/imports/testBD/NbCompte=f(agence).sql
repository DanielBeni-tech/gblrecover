SELECT 
    a.nom_agence,
    a.nom_centre,
    COUNT(c.num_compte) AS total_comptes
FROM agence a
JOIN compte c ON a.id_agence = c.id_agence
GROUP BY a.nom_agence, a.nom_centre
ORDER BY total_comptes DESC
LIMIT 10;