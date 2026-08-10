import pandas as pd
import re
from sqlalchemy import create_engine, text

# --- 1. CONNEXION A POSTGRESQL ---
USER = "postgres"
PASSWORD = "Adzaba1983"
HOST = "localhost"
PORT = "5432"
DB_NAME = "MLR2"

engine = create_engine(f"postgresql://{USER}:{PASSWORD}@{HOST}:{PORT}/{DB_NAME}")

print("Chargement du fichier Excel (patientez quelques secondes)...")
file_path = "GBL - Juillet 2026.xlsx"
df = pd.read_excel(file_path)

# --- 2. NETTOYAGE ET GESTION DES VALEURS MANQUANTES ---
def nettoyer_identification(valeur):
    if pd.isna(valeur):
        return 'Non identifié'
    val_str = str(valeur).strip()
    if val_str.lower().startswith('identifi') and 'non' not in val_str.lower():
        return 'Identifié'
    if 'en cours' in val_str.lower():
        return 'En cours de vérification'
    return val_str

print("Nettoyage des données...")
df['Identification'] = df['Identification'].apply(nettoyer_identification)
df['Centre gestion'] = df['Centre gestion'].fillna('NON SPÉCIFIÉ')

# --- 3. IMPORTATION DANS LES TABLES DE BASE ---

# A. Table CENTRE
print("Importation des Centres...")
centres = df[['Centre gestion']].drop_duplicates().dropna()
centres.columns = ['nom_centre']
centres.to_sql('centre', engine, if_exists='append', index=False)

# B. Table AGENCE
print("Importation des Agences...")
agences = df[['Agence', 'Centre gestion']].dropna(subset=['Agence']).drop_duplicates()
agences.columns = ['nom_agence', 'nom_centre']
agences['id_agence'] = 'AG_' + agences['nom_agence'].astype(str)
agences = agences.drop_duplicates(subset=['id_agence'])
agences.to_sql('agence', engine, if_exists='append', index=False)

# C. Table GESTIONNAIRE (Déduplication sur le matricule)
print("Importation des Gestionnaires...")
gestionnaires = df[['Mat. Gestionnaire', 'Gestionnaire']].dropna(subset=['Mat. Gestionnaire']).copy()
gestionnaires.columns = ['mat_gestionnaire', 'nom_gestionnaire']
gestionnaires['mat_gestionnaire'] = gestionnaires['mat_gestionnaire'].astype(str)
gestionnaires = gestionnaires.drop_duplicates(subset=['mat_gestionnaire'])
gestionnaires.to_sql('gestionnaire', engine, if_exists='append', index=False)

# D. Table CLIENT
print("Importation des Clients...")
clients = df[['Code client', 'Raison sociale', 'Marché', 'Email', 'Contact']].dropna(subset=['Code client']).copy()
clients.columns = ['code_client', 'raison_sociale', 'marche', 'email', 'tel']
clients['code_client'] = clients['code_client'].astype(int)
clients['tel'] = pd.to_numeric(clients['tel'], errors='coerce')
clients['raison_sociale'] = clients['raison_sociale'].astype(str).str.slice(0, 128)
clients = clients.drop_duplicates(subset=['code_client'])
clients.to_sql('client', engine, if_exists='append', index=False, chunksize=2000)

# E. Table COMPTE (50 000+ lignes)
print("Importation des 50 000+ Comptes...")
comptes = df[['Compte', 'Mat. Gestionnaire', 'Agence', 'Code client', 'E-Bill', 'Facturation', 'Identification', 'Balance']].copy()
comptes.columns = ['num_compte', 'mat_gestionnaire', 'nom_agence', 'code_client', 'e_bill', 'statut_facturation', 'identification', 'balance']

comptes['id_agence'] = 'AG_' + comptes['nom_agence'].astype(str)
comptes['mat_gestionnaire'] = comptes['mat_gestionnaire'].astype(str)
comptes['num_compte'] = comptes['num_compte'].astype('int64')
comptes['code_client'] = comptes['code_client'].astype(int)
comptes['balance'] = comptes['balance'].fillna(0.0)

# Filtrage pour garantir l'intégrité référentielle
comptes = comptes[comptes['id_agence'].isin(agences['id_agence'])]
comptes = comptes[comptes['mat_gestionnaire'].isin(gestionnaires['mat_gestionnaire'])]
comptes = comptes[comptes['code_client'].isin(clients['code_client'])]

comptes_final = comptes.drop_duplicates(subset=['num_compte'])[['num_compte', 'mat_gestionnaire', 'id_agence', 'code_client', 'e_bill', 'statut_facturation', 'identification', 'balance']]
comptes_final.to_sql('compte', engine, if_exists='append', index=False, chunksize=2000)

# --- 4. TRAITEMENT ET IMPORTATION DES FACTURES ET IMPAYES MENSUELS ---
print("\nExtraction et dépilage des colonnes de factures/impayés mensuels...")

# Détection automatique des colonnes
colonnes_mois = [col for col in df.columns if re.search(r'(Facture|Impayé|Impayes)', str(col), re.IGNORECASE)]

if colonnes_mois:
    # Transformation du format horizontal vers vertical
    df_long = pd.melt(
        df, 
        id_vars=['Compte'], 
        value_vars=colonnes_mois,
        var_name='libelle_periode', 
        value_name='montant'
    )

    # Nettoyage des montants
    df_long['montant'] = pd.to_numeric(df_long['montant'], errors='coerce').fillna(0.0)
    df_long = df_long[df_long['montant'] != 0]

    # Détection du type de flux
    df_long['type_flux'] = df_long['libelle_periode'].apply(
        lambda x: 'FACTURE' if 'facture' in str(x).lower() else 'IMPAYE'
    )

    # Conversion de libelle_periode (ex: "Décembre Facture 2025") vers une date réelle
    mois_map = {
        'janvier': '01', 'février': '02', 'fevrier': '02', 'mars': '03', 
        'avril': '04', 'mai': '05', 'juin': '06', 'juillet': '07', 
        'août': '08', 'aout': '08', 'septembre': '09', 'octobre': '10', 
        'novembre': '11', 'décembre': '12', 'decembre': '12'
    }

    def convertir_en_date(libelle):
        lib = str(libelle).lower()
        annee_match = re.search(r'20\d{2}', lib)
        annee = annee_match.group(0) if annee_match else '2026'
        
        mois = '01'
        for m_nom, m_num in mois_map.items():
            if m_nom in lib:
                mois = m_num
                break
        return f"{annee}-{mois}-01"

    df_long['date_emission'] = df_long['libelle_periode'].apply(convertir_en_date)

    # Génération des IDs uniques
    df_long['num_compte'] = df_long['Compte'].astype(str)
    df_long['id_facture'] = 'FAC_' + df_long['num_compte'] + '_' + df_long['libelle_periode'].str.replace(' ', '_')

    factures_finales = df_long[['id_facture', 'num_compte', 'libelle_periode', 'type_flux', 'montant', 'date_emission']].drop_duplicates(subset=['id_facture'])

    print("Insertion dynamique dans PostgreSQL avec date d'émission...")
    factures_finales.to_sql('temp_facture_import', engine, if_exists='replace', index=False)

    upsert_query = """
    INSERT INTO facture (id_facture, num_compte, libelle_periode, type_flux, montant_facture, date_emission)
    SELECT 
        t.id_facture, 
        CAST(t.num_compte AS BIGINT), 
        t.libelle_periode, 
        t.type_flux, 
        t.montant, 
        CAST(t.date_emission AS DATE)
    FROM temp_facture_import t
    INNER JOIN compte c ON CAST(t.num_compte AS BIGINT) = c.num_compte
    ON CONFLICT (id_facture) 
    DO UPDATE SET 
        montant_facture = EXCLUDED.montant_facture,
        type_flux = EXCLUDED.type_flux,
        date_emission = EXCLUDED.date_emission;

    DROP TABLE temp_facture_import;
    """

    with engine.begin() as conn:
        conn.execute(text(upsert_query))
    print("Table Factures mise à jour avec succès !")