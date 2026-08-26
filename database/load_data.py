"""
LOAD_DATA - Import complet depuis un fichier Excel unique
Correspond EXACTEMENT au schéma schema.sql
Version: 2.0 - Vérifié et corrigé
"""

import pandas as pd
import re
import hashlib
from datetime import datetime
from sqlalchemy import create_engine, text
from uuid import uuid4
import subprocess
from passlib.context import CryptContext

# ============================================================
# 1. CONNEXION À POSTGRESQL
# ============================================================

import os

USER = os.getenv("POSTGRES_USER", "postgres")
PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
HOST = os.getenv("POSTGRES_HOST", "localhost")
PORT = os.getenv("POSTGRES_PORT", "5433")
DB_NAME = os.getenv("POSTGRES_DB", "gblrecover")

DEMO_EMAIL = os.getenv("DEMO_EMAIL", "agent@camtel.cm")
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "demo1234")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# bcrypt impose une limite stricte de 72 octets (sinon `ValueError: password
# cannot be longer than 72 bytes` à partir de bcrypt >= 4.0). On tronque donc
# les secrets en UTF-8 avant de les hacher / vérifier.
_BCRYPT_MAX_BYTES = 72


def _truncate_for_bcrypt(password: str) -> str:
    encoded = password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    return encoded.decode("utf-8", errors="ignore")


def hash_password(password: str) -> str:
    return pwd_context.hash(_truncate_for_bcrypt(password))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(_truncate_for_bcrypt(plain_password), hashed_password)


engine = create_engine(f"postgresql://{USER}:{PASSWORD}@{HOST}:{PORT}/{DB_NAME}")
BATCH_ID = str(uuid4())

CLEAN_DB = os.getenv('CLEAN_DB', 'true').lower() in ('1', 'true', 'yes')

if CLEAN_DB:
    schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
    if os.path.exists(schema_path):
        print("🧹 Nettoyage de la base de données (DROP SCHEMA public CASCADE)")
        env = os.environ.copy()
        env['PGPASSWORD'] = PASSWORD
        try:
            subprocess.run([
                'psql', '-h', HOST, '-p', PORT, '-U', USER, '-d', DB_NAME,
                '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
            ], check=True, env=env)
            print(f"📦 Application du schéma depuis {schema_path}")
            subprocess.run([
                'psql', '-h', HOST, '-p', PORT, '-U', USER, '-d', DB_NAME,
                '-f', schema_path
            ], check=True, env=env)
        except subprocess.CalledProcessError as e:
            print("Erreur lors de l'initialisation du schéma :", e)
            raise
    else:
        print(f"Aucun fichier de schéma trouvé à {schema_path}, saut du nettoyage.")

print("🚀 Démarrage de l'import GBLRecover")
print(f"📁 Fichier: GBL - Juillet 2026.xlsx")
print(f"🔑 Batch ID: {BATCH_ID}")
print("-" * 60)

def ensure_demo_user(engine):
    """Crée ou met à jour le compte de démonstration utilisé par le front."""
    with engine.begin() as conn:
        exists = conn.execute(
            text("SELECT id, password_hash FROM users WHERE email = :email"),
            {"email": DEMO_EMAIL},
        ).fetchone()

        if exists:
            user_id = str(exists[0])
            if not verify_password(DEMO_PASSWORD, exists[1]):
                conn.execute(
                    text("""
                        UPDATE users
                        SET password_hash = :password_hash,
                            full_name = :full_name,
                            status = 'ACTIVE',
                            must_change_password = false,
                            updated_at = now()
                        WHERE email = :email
                    """),
                    {
                        "password_hash": hash_password(DEMO_PASSWORD),
                        "full_name": "Diane Mbarga",
                        "email": DEMO_EMAIL,
                    },
                )
            return user_id

        user_id = str(uuid4())
        conn.execute(
            text("""
                INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at, must_change_password)
                VALUES (:id, :email, :password_hash, :full_name, 'ACTIVE', now(), now(), false)
            """),
            {
                "id": user_id,
                "email": DEMO_EMAIL,
                "password_hash": hash_password(DEMO_PASSWORD),
                "full_name": "Diane Mbarga",
            },
        )

        role_exists = conn.execute(
            text("SELECT id FROM roles WHERE code = :code LIMIT 1"),
            {"code": "AGENT"},
        ).fetchone()

        if role_exists is None:
            role_id = str(uuid4())
            conn.execute(
                text("""
                    INSERT INTO roles (id, code, name, description, status, created_at, updated_at)
                    VALUES (:id, :code, :name, :description, 'ACTIVE', now(), now())
                """),
                {
                    "id": role_id,
                    "code": "AGENT",
                    "name": "Agent",
                    "description": "Compte de démonstration",
                },
            )
        else:
            role_id = str(role_exists[0])

        conn.execute(
            text("""
                INSERT INTO user_roles (user_id, role_id, created_at)
                VALUES (:user_id, :role_id, now())
                ON CONFLICT (user_id, role_id) DO NOTHING
            """),
            {"user_id": user_id, "role_id": role_id},
        )

        print(f"✅ Compte démo créé/mis à jour: {DEMO_EMAIL} / {DEMO_PASSWORD}")
        return user_id


# ============================================================
# 2. CHARGEMENT DU FICHIER EXCEL
# ============================================================

def main():
    file_path = "GBL - Juillet 2026.xlsx"
    df = pd.read_excel(file_path)

    print("🚀 Démarrage de l'import GBLRecover")
    print(f"📁 Fichier: GBL - Juillet 2026.xlsx")
    print(f"🔑 Batch ID: {BATCH_ID}")
    print(f"📊 Fichier chargé: {len(df)} lignes")
    print(f"📋 Colonnes disponibles: {list(df.columns)}")

    # Normalisation des noms de colonnes
    df.columns = df.columns.str.strip()

    # Mapping des colonnes du fichier Excel vers les colonnes de la BD
    COLUMN_MAPPING = {
        'Code client': 'code_client',
        'Raison sociale': 'raison_sociale',
        'Marché': 'marche',
        'Email': 'email',
        'Contact': 'tel',
        'Compte': 'num_compte',
        'Mat. Gestionnaire': 'mat_gestionnaire',
        'Gestionnaire': 'nom_gestionnaire',
        'Agence': 'nom_agence',
        'Centre gestion': 'nom_centre',
        'E-Bill': 'e_bill',
        'Facturation': 'statut_facturation',
        'Identification': 'identification',
        'Balance': 'balance'
    }

    # Renommer les colonnes
    df.rename(columns=COLUMN_MAPPING, inplace=True)

    # ============================================================
    # 3. FONCTIONS DE NETTOYAGE
    # ============================================================

    def clean_string(value, max_length=None):
        """Nettoie une chaîne de caractères"""
        if pd.isna(value) or value is None:
            return None
        result = str(value).strip()
        if max_length and len(result) > max_length:
            result = result[:max_length]
        return result if result else None

    def clean_identification(value):
        """Nettoie et standardise l'identification"""
        if pd.isna(value):
            return 'Non identifié'
        val_str = str(value).strip()
        val_lower = val_str.lower()

        if val_lower.startswith('identifi') and 'non' not in val_lower:
            return 'Identifié'
        if 'en cours' in val_lower:
            return 'En cours de vérification'
        if 'non' in val_lower:
            return 'Non identifié'
        return clean_string(value, max_length=128)

    def clean_phone(value):
        """Nettoie un numéro de téléphone (int8)"""
        if pd.isna(value) or value is None:
            return None
        phone_str = str(value).strip()
        digits = re.sub(r'\D', '', phone_str)
        if len(digits) >= 8:
            return int(digits)
        return None

    def clean_balance(value):
        """Nettoie le balance (float4)"""
        if pd.isna(value) or value is None:
            return 0.0
        try:
            return float(value)
        except (ValueError, TypeError):
            return 0.0

    def clean_amount(value):
        """Nettoie un montant (numeric(14,2))"""
        if pd.isna(value) or value is None:
            return 0.0
        try:
            return round(float(value), 2)
        except (ValueError, TypeError):
            return 0.0

    def clean_marche(value):
        """Conserve la valeur Excel réelle (PAR, PRO, PTT, OFF, ENT, …)."""
        if pd.isna(value) or value is None:
            return 'NON SPECIFIE'
        val = str(value).strip().upper()
        return val or 'NON SPECIFIE'

    def detect_type_flux(libelle):
        """Détecte le type de flux"""
        if pd.isna(libelle):
            return 'FACTURE'
        lib = str(libelle).lower()
        if 'impaye' in lib or 'impayé' in lib:
            return 'IMPAYE'
        return 'FACTURE'

    def extract_date_from_libelle(libelle):
        """Extrait une date à partir du libellé de période"""
        lib = str(libelle).lower()

        mois_map = {
            'janvier': '01', 'février': '02', 'fevrier': '02', 'mars': '03',
            'avril': '04', 'mai': '05', 'juin': '06', 'juillet': '07',
            'août': '08', 'aout': '08', 'septembre': '09', 'octobre': '10',
            'novembre': '11', 'décembre': '12', 'decembre': '12'
        }

        annee_match = re.search(r'20\d{2}', lib)
        annee = annee_match.group(0) if annee_match else '2026'

        mois = '01'
        for m_nom, m_num in mois_map.items():
            if m_nom in lib:
                mois = m_num
                break

        return f"{annee}-{mois}-01"

    # ============================================================
    # 4. NETTOYAGE DES DONNÉES
    # ============================================================

    print("\n🧹 Nettoyage des données...")

    df['code_client'] = df['code_client'].apply(lambda x: int(x) if pd.notna(x) else None)
    df['num_compte'] = df['num_compte'].apply(lambda x: int(x) if pd.notna(x) else None)
    df['raison_sociale'] = df['raison_sociale'].apply(lambda x: clean_string(x, max_length=128))
    df['marche'] = df['marche'].apply(clean_marche)
    df['email'] = df['email'].apply(lambda x: clean_string(x, max_length=128))
    df['tel'] = df['tel'].apply(clean_phone)
    df['mat_gestionnaire'] = df['mat_gestionnaire'].apply(lambda x: clean_string(x, max_length=128))
    df['nom_gestionnaire'] = df['nom_gestionnaire'].apply(lambda x: clean_string(x, max_length=128))
    df['nom_agence'] = df['nom_agence'].apply(lambda x: clean_string(x, max_length=128))
    df['nom_centre'] = df['nom_centre'].apply(lambda x: clean_string(x, max_length=128) or 'NON SPECIFIE')
    df['e_bill'] = df['e_bill'].apply(lambda x: clean_string(x, max_length=50))
    df['statut_facturation'] = df['statut_facturation'].apply(lambda x: clean_string(x, max_length=50))
    df['identification'] = df['identification'].apply(clean_identification)
    df['balance'] = df['balance'].apply(clean_balance)

    df['id_agence'] = 'AG_' + df['nom_agence'].astype(str)

    print("✅ Nettoyage terminé")

    # ============================================================
    # 5. IMPORTATION DES TABLES (ORDRE LOGIQUE)
    # ============================================================

    print("\n📥 Importation des données dans PostgreSQL...")
    print("⚠️  Ordre d'import respectant les contraintes de clés étrangères")

    print("  → Table CENTRE...")
    centres = df[['nom_centre']].drop_duplicates().dropna()
    centres = centres[centres['nom_centre'] != '']
    with engine.begin() as conn:
        for _, row in centres.iterrows():
            conn.execute(text('INSERT INTO centre (nom_centre) VALUES (:nc) ON CONFLICT (nom_centre) DO NOTHING'), {'nc': row['nom_centre']})
    print(f"    ✅ {len(centres)} centres importés")

    print("  → Table AGENCE...")
    agences = df[['nom_agence', 'nom_centre']].dropna(subset=['nom_agence']).drop_duplicates()
    agences['id_agence'] = 'AG_' + agences['nom_agence'].astype(str)
    agences = agences.drop_duplicates(subset=['id_agence'])
    agences = agences[agences['nom_centre'].isin(centres['nom_centre'])]
    with engine.begin() as conn:
        for _, row in agences.iterrows():
            conn.execute(text('INSERT INTO agence (id_agence, nom_agence, nom_centre) VALUES (:id, :na, :nc) ON CONFLICT (id_agence) DO NOTHING'), {'id': row['id_agence'], 'na': row['nom_agence'], 'nc': row['nom_centre']})
    print(f"    ✅ {len(agences)} agences importées")

    print("  → Table GESTIONNAIRE...")
    gestionnaires = df[['mat_gestionnaire', 'nom_gestionnaire']].dropna(subset=['mat_gestionnaire']).copy()
    gestionnaires['mat_gestionnaire'] = gestionnaires['mat_gestionnaire'].astype(str)
    gestionnaires = gestionnaires.drop_duplicates(subset=['mat_gestionnaire'])
    with engine.begin() as conn:
        for _, row in gestionnaires.iterrows():
            conn.execute(text('INSERT INTO gestionnaire (mat_gestionnaire, nom_gestionnaire) VALUES (:mat, :nom) ON CONFLICT (mat_gestionnaire) DO NOTHING'), {'mat': row['mat_gestionnaire'], 'nom': row['nom_gestionnaire']})
    print(f"    ✅ {len(gestionnaires)} gestionnaires importés")

    print("  → Table CLIENT...")
    clients = df[['code_client', 'raison_sociale', 'marche', 'email', 'tel']].dropna(subset=['code_client']).copy()
    clients['code_client'] = clients['code_client'].astype(int)
    clients = clients.drop_duplicates(subset=['code_client'])
    with engine.begin() as conn:
        for _, row in clients.iterrows():
            conn.execute(text('INSERT INTO client (code_client, raison_sociale, marche, email, tel) VALUES (:cc, :rs, :m, :e, :t) ON CONFLICT (code_client) DO NOTHING'),
                {'cc': int(row['code_client']), 'rs': row['raison_sociale'], 'm': row['marche'], 'e': None if pd.isna(row['email']) else row['email'], 't': None if pd.isna(row['tel']) else int(row['tel']) if isinstance(row['tel'], (int, float)) and row['tel'] == row['tel'] else None})
    print(f"    ✅ {len(clients)} clients importés")

    print("  → Table COMPTE...")
    comptes = df[['num_compte', 'mat_gestionnaire', 'id_agence', 'code_client',
                  'e_bill', 'statut_facturation', 'identification', 'balance']].copy()
    comptes = comptes.dropna(subset=['num_compte', 'code_client', 'id_agence'])
    comptes['num_compte'] = comptes['num_compte'].astype(int)
    comptes['code_client'] = comptes['code_client'].astype(int)
    comptes['mat_gestionnaire'] = comptes['mat_gestionnaire'].astype(str)
    comptes = comptes[comptes['id_agence'].isin(agences['id_agence'])]
    comptes = comptes[comptes['mat_gestionnaire'].isin(gestionnaires['mat_gestionnaire'])]
    comptes = comptes[comptes['code_client'].isin(clients['code_client'])]
    comptes = comptes.drop_duplicates(subset=['num_compte'])
    with engine.begin() as conn:
        for _, row in comptes.iterrows():
            conn.execute(text('INSERT INTO compte (num_compte, mat_gestionnaire, id_agence, code_client, e_bill, statut_facturation, identification, balance) VALUES (:nc, :mg, :ia, :cc, :eb, :sf, :id, :bal) ON CONFLICT (num_compte) DO NOTHING'),
                {'nc': int(row['num_compte']), 'mg': str(row['mat_gestionnaire']), 'ia': row['id_agence'], 'cc': int(row['code_client']),
                 'eb': None if pd.isna(row['e_bill']) else row['e_bill'],
                 'sf': None if pd.isna(row['statut_facturation']) else row['statut_facturation'],
                 'id': None if pd.isna(row['identification']) else row['identification'],
                 'bal': 0.0 if pd.isna(row['balance']) else float(row['balance'])})
    print(f"    ✅ {len(comptes)} comptes importés")

    print("  → Table SERVICE (référentiel)...")
    services = pd.DataFrame([
        {'type_service': 'LS', 'libelle_service': 'Ligne Spécialisée'},
        {'type_service': 'Vobb', 'libelle_service': 'Voice over Broadband'},
        {'type_service': 'FTTx', 'libelle_service': 'Fibre Optique'},
        {'type_service': 'TV', 'libelle_service': 'Télévision'},
        {'type_service': 'ADSL', 'libelle_service': 'Haut Débit ADSL'},
        {'type_service': 'Mobile', 'libelle_service': 'Réseau Mobile'},
        {'type_service': 'Autres', 'libelle_service': 'Autres Services'}
    ])
    try:
        existing = pd.read_sql("SELECT type_service FROM service", engine)
        existing_types = set(existing['type_service'].astype(str).tolist())
    except Exception:
        existing_types = set()

    to_insert = services[~services['type_service'].isin(existing_types)]
    if not to_insert.empty:
        to_insert.to_sql('service', engine, if_exists='append', index=False)
    print(f"    ✅ {len(to_insert)} services importés (skipped {len(services) - len(to_insert)} existing)")

    print("  → Table FACTURE...")
    colonnes_mois = [col for col in df.columns if re.search(r'(Facture|Impayé|Impayes|Décembre|Janvier|Février)', str(col), re.IGNORECASE)]

    if colonnes_mois:
        print(f"    📋 {len(colonnes_mois)} colonnes mensuelles détectées")
        df_long = pd.melt(df, id_vars=['num_compte'], value_vars=colonnes_mois, var_name='libelle_periode', value_name='montant_facture')
        df_long['montant_facture'] = df_long['montant_facture'].apply(clean_amount)
        df_long = df_long[df_long['montant_facture'] != 0]
        df_long['type_flux'] = df_long['libelle_periode'].apply(detect_type_flux)
        df_long['date_emission'] = df_long['libelle_periode'].apply(extract_date_from_libelle)
        df_long['num_compte'] = df_long['num_compte'].astype(str)
        df_long['id_facture'] = 'FAC_' + df_long['num_compte'] + '_' + df_long['libelle_periode'].str.replace(' ', '_').replace('/', '_')
        df_long['id_facture'] = df_long['id_facture'].str.slice(0, 128)
        df_long['paid_amount'] = 0.0
        df_long['outstanding_amount'] = df_long['montant_facture']
        df_long['status'] = 'OPEN'

        factures = df_long[['id_facture', 'num_compte', 'date_emission', 'montant_facture', 'paid_amount', 'outstanding_amount', 'status', 'type_flux', 'libelle_periode']].drop_duplicates(subset=['id_facture'])
        factures['num_compte'] = factures['num_compte'].astype(int)
        comptes_valides = comptes['num_compte'].unique()
        factures = factures[factures['num_compte'].isin(comptes_valides)]
        factures.to_sql('temp_facture_import', engine, if_exists='replace', index=False)

        upsert_query = """
        INSERT INTO facture (id_facture, num_compte, date_emission, montant_facture,
                             paid_amount, outstanding_amount, status, type_flux, libelle_periode)
        SELECT
            id_facture,
            CAST(num_compte AS BIGINT),
            CAST(date_emission AS DATE),
            montant_facture,
            paid_amount,
            outstanding_amount,
            status,
            type_flux,
            libelle_periode
        FROM temp_facture_import
        ON CONFLICT (id_facture)
        DO UPDATE SET
            montant_facture = EXCLUDED.montant_facture,
            paid_amount = EXCLUDED.paid_amount,
            outstanding_amount = EXCLUDED.outstanding_amount,
            status = EXCLUDED.status,
            type_flux = EXCLUDED.type_flux,
            date_emission = EXCLUDED.date_emission,
            libelle_periode = EXCLUDED.libelle_periode;

        DROP TABLE temp_facture_import;
        """

        with engine.begin() as conn:
            conn.execute(text(upsert_query))

        print(f"    ✅ {len(factures)} factures importées")
    else:
        print("    ⚠️ Aucune colonne mensuelle détectée")

    print("  → Table SOUSCRIRE (si données disponibles)...")
    print("  → Table PAIEMENT (si données disponibles)...")

    ensure_demo_user(engine)

    print("\n📝 Enregistrement du batch d'import...")
    system_email = 'system@local'
    system_id = None
    with engine.begin() as conn:
        res = conn.execute(text("SELECT id FROM users WHERE email = :email"), {"email": system_email})
        row = res.fetchone()
        if row:
            system_id = str(row[0])
        else:
            system_id = str(uuid4())
            conn.execute(text("""
                INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at, MUST_CHANGE_PASSWORD)
                VALUES (:id, :email, :pwd, :full_name, 'ACTIVE', now(), now(), false)
            """), {"id": system_id, "email": system_email, "pwd": '', "full_name": 'system'})

    batch_data = {
        'id': BATCH_ID,
        'filename': 'GBL - Juillet 2026.xlsx',
        'file_checksum': hashlib.md5(open(file_path, 'rb').read()).hexdigest(),
        'entity_type': 'multiple',
        'status': 'COMPLETED',
        'total_rows': len(df),
        'processed_rows': len(df),
        'accepted_rows': len(df),
        'rejected_rows': 0,
        'completed_at': datetime.now(),
        'created_by': system_id
    }

    try:
        batch_df = pd.DataFrame([batch_data])
        batch_df.to_sql('import_batches', engine, if_exists='append', index=False)
        print("✅ Batch enregistré")
    except Exception as e:
        print(f"⚠️ Erreur lors de l'enregistrement du batch: {e}")

    print("\n" + "=" * 60)
    print("📊 RÉSUMÉ DE L'IMPORT")
    print("=" * 60)

    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT
                (SELECT COUNT(*) FROM centre) AS centres,
                (SELECT COUNT(*) FROM agence) AS agences,
                (SELECT COUNT(*) FROM gestionnaire) AS gestionnaires,
                (SELECT COUNT(*) FROM client) AS clients,
                (SELECT COUNT(*) FROM compte) AS comptes,
                (SELECT COUNT(*) FROM facture) AS factures,
                (SELECT COUNT(*) FROM service) AS services
        """))
        row = result.fetchone()

    print(f"""
┌─────────────────┬────────────┐
│ Table           │ Effectif   │
├─────────────────┼────────────┤
│ CENTRE          │ {row[0]:>10} │
│ AGENCE          │ {row[1]:>10} │
│ GESTIONNAIRE    │ {row[2]:>10} │
│ CLIENT          │ {row[3]:>10} │
│ COMPTE          │ {row[4]:>10} │
│ FACTURE         │ {row[5]:>10} │
│ SERVICE         │ {row[6]:>10} │
└─────────────────┴────────────┘
""")

    print("✅ Import terminé avec succès !")
    print(f"🔑 Batch ID: {BATCH_ID}")
    print("📌 Les tables SOUSCRIRE et PAIEMENT peuvent être importées depuis des fichiers séparés si nécessaire.")


if __name__ == "__main__":
    main()