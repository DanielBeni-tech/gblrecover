SELECT 
    a.nom_centre,
    f.type_flux,
    COUNT(f.id_facture) AS nb_dossiers,
    SUM(f.montant_facture) AS total_montant
FROM facture f
JOIN compte cp ON f.num_compte = cp.num_compte
JOIN agence a ON cp.id_agence = a.id_agence
WHERE f.date_emission = '2025-12-01'
GROUP BY a.nom_centre, f.type_flux
ORDER BY a.nom_centre ASC;