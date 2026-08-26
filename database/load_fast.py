"""
Fast batch loader for GBLRecover — uses executemany with ON CONFLICT.
"""
import os, sys, re, hashlib
from datetime import datetime
from uuid import uuid4
import pandas as pd
from sqlalchemy import create_engine, text
from passlib.context import CryptContext

# --- Config ---
USER = os.getenv("POSTGRES_USER", "postgres")
PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
HOST = os.getenv("POSTGRES_HOST", "localhost")
PORT = os.getenv("POSTGRES_PORT", "5432")
DB_NAME = os.getenv("POSTGRES_DB", "gblrecover")
DEMO_EMAIL = os.getenv("DEMO_EMAIL", "agent@camtel.cm")
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "demo1234")
BATCH_ID = str(uuid4())
DATABASE_URL = os.getenv("DATABASE_URL")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
_BCRYPT_MAX_BYTES = 72

def _truncate_for_bcrypt(pw):
    return pw.encode("utf-8")[:_BCRYPT_MAX_BYTES].decode("utf-8", errors="ignore")

def hash_password(pw):
    return pwd_context.hash(_truncate_for_bcrypt(pw))

engine = create_engine(
    DATABASE_URL or f"postgresql://{USER}:{PASSWORD}@{HOST}:{PORT}/{DB_NAME}"
)

file_path = os.path.join(os.path.dirname(__file__), "GBL - Juillet 2026.xlsx")
if os.getenv("LOAD_IF_EMPTY", "").lower() in ("1", "true", "yes"):
    with engine.connect() as conn:
        n = conn.execute(text("SELECT COUNT(*) FROM compte")).scalar() or 0
    if n:
        print(f"Portefeuille déjà chargé ({n} comptes) — import ignoré.")
        sys.exit(0)

if not os.path.isfile(file_path):
    print(f"Fichier Excel introuvable : {file_path}", file=sys.stderr)
    sys.exit(1)

# --- Read Excel ---
df = pd.read_excel(file_path)
df.columns = df.columns.str.strip()
print(f"Loaded {len(df)} rows, {len(df.columns)} columns")

COLUMN_MAPPING = {
    'Code client': 'code_client', 'Raison sociale': 'raison_sociale',
    'Marché': 'marche', 'Email': 'email', 'Contact': 'tel',
    'Compte': 'num_compte', 'Mat. Gestionnaire': 'mat_gestionnaire',
    'Gestionnaire': 'nom_gestionnaire', 'Agence': 'nom_agence',
    'Centre gestion': 'nom_centre', 'E-Bill': 'e_bill',
    'Facturation': 'statut_facturation', 'Identification': 'identification',
    'Balance': 'balance'
}
df.rename(columns=COLUMN_MAPPING, inplace=True)

# --- Cleaning ---
def clean_string(v, mx=None):
    if pd.isna(v): return None
    s = str(v).strip()
    return s[:mx] if mx and len(s) > mx else s or None

def clean_phone(v):
    if pd.isna(v): return None
    d = re.sub(r'\D', '', str(v).strip())
    return int(d) if len(d) >= 8 else None

def clean_balance(v):
    if pd.isna(v): return 0.0
    try: return float(v)
    except: return 0.0

def clean_marche(v):
    """Conserve la valeur Excel réelle (PAR, PRO, PTT, OFF, ENT, …)."""
    if pd.isna(v):
        return "NON SPECIFIE"
    s = str(v).strip().upper()
    return s or "NON SPECIFIE"

def clean_identification(v):
    if pd.isna(v): return 'Non identifié'
    s = str(v).strip().lower()
    if s.startswith('identifi') and 'non' not in s: return 'Identifié'
    if 'en cours' in s: return 'En cours de vérification'
    if 'non' in s: return 'Non identifié'
    return clean_string(v, 128)

df['code_client'] = df['code_client'].apply(lambda x: int(x) if pd.notna(x) else None)
df['num_compte'] = df['num_compte'].apply(lambda x: int(x) if pd.notna(x) else None)
df['raison_sociale'] = df['raison_sociale'].apply(lambda x: clean_string(x, 128))
df['marche'] = df['marche'].apply(clean_marche)
df['email'] = df['email'].apply(lambda x: clean_string(x, 128))
df['tel'] = df['tel'].apply(clean_phone)
df['mat_gestionnaire'] = df['mat_gestionnaire'].apply(lambda x: clean_string(x, 128))
df['nom_gestionnaire'] = df['nom_gestionnaire'].apply(lambda x: clean_string(x, 128))
df['nom_agence'] = df['nom_agence'].apply(lambda x: clean_string(x, 128))
df['nom_centre'] = df['nom_centre'].apply(lambda x: clean_string(x, 128) or 'NON SPECIFIE')
df['e_bill'] = df['e_bill'].apply(lambda x: clean_string(x, 50))
df['statut_facturation'] = df['statut_facturation'].apply(lambda x: clean_string(x, 50))
df['identification'] = df['identification'].apply(clean_identification)
df['balance'] = df['balance'].apply(clean_balance)
df['id_agence'] = 'AG_' + df['nom_agence'].astype(str)

# --- Batch insert helper ---
def batch_insert(conn, sql, data_list, batch_size=2000):
    for i in range(0, len(data_list), batch_size):
        batch = data_list[i:i+batch_size]
        conn.execute(text(sql), batch)

# --- Import ---
with engine.begin() as conn:
    # CENTRES
    centres = df[['nom_centre']].drop_duplicates().dropna()
    centres = centres[centres['nom_centre'] != '']
    batch_insert(conn, "INSERT INTO centre (nom_centre) VALUES (:nc) ON CONFLICT (nom_centre) DO NOTHING",
                 [{'nc': r['nom_centre']} for _, r in centres.iterrows()])
    print(f"  CENTRES: {len(centres)}")

    # AGENCES
    agences = df[['nom_agence', 'nom_centre']].dropna(subset=['nom_agence']).drop_duplicates()
    agences['id_agence'] = 'AG_' + agences['nom_agence'].astype(str)
    agences = agences.drop_duplicates(subset=['id_agence'])
    agences = agences[agences['nom_centre'].isin(centres['nom_centre'])]
    batch_insert(conn, "INSERT INTO agence (id_agence, nom_agence, nom_centre) VALUES (:id, :na, :nc) ON CONFLICT (id_agence) DO NOTHING",
                 [{'id': r['id_agence'], 'na': r['nom_agence'], 'nc': r['nom_centre']} for _, r in agences.iterrows()])
    print(f"  AGENCES: {len(agences)}")

    # GESTIONNAIRES
    gestionnaires = df[['mat_gestionnaire', 'nom_gestionnaire']].dropna(subset=['mat_gestionnaire']).copy()
    gestionnaires['mat_gestionnaire'] = gestionnaires['mat_gestionnaire'].astype(str)
    gestionnaires = gestionnaires.drop_duplicates(subset=['mat_gestionnaire'])
    batch_insert(conn, "INSERT INTO gestionnaire (mat_gestionnaire, nom_gestionnaire) VALUES (:mat, :nom) ON CONFLICT (mat_gestionnaire) DO NOTHING",
                 [{'mat': r['mat_gestionnaire'], 'nom': r['nom_gestionnaire']} for _, r in gestionnaires.iterrows()])
    print(f"  GESTIONNAIRES: {len(gestionnaires)}")

    # CLIENTS
    clients = df[['code_client', 'raison_sociale', 'marche', 'email', 'tel']].dropna(subset=['code_client']).copy()
    clients['code_client'] = clients['code_client'].astype(int)
    clients = clients.drop_duplicates(subset=['code_client'])
    batch_insert(conn, "INSERT INTO client (code_client, raison_sociale, marche, email, tel) VALUES (:cc, :rs, :m, :e, :t) ON CONFLICT (code_client) DO NOTHING",
                 [{'cc': int(r['code_client']), 'rs': r['raison_sociale'], 'm': r['marche'],
                   'e': None if pd.isna(r['email']) else r['email'],
                   't': None if pd.isna(r['tel']) else int(r['tel'])} for _, r in clients.iterrows()])
    print(f"  CLIENTS: {len(clients)}")

    # COMPTES
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
    batch_insert(conn, "INSERT INTO compte (num_compte, mat_gestionnaire, id_agence, code_client, e_bill, statut_facturation, identification, balance) VALUES (:nc, :mg, :ia, :cc, :eb, :sf, :id, :bal) ON CONFLICT (num_compte) DO NOTHING",
                 [{'nc': int(r['num_compte']), 'mg': str(r['mat_gestionnaire']), 'ia': r['id_agence'],
                   'cc': int(r['code_client']),
                   'eb': None if pd.isna(r['e_bill']) else r['e_bill'],
                   'sf': None if pd.isna(r['statut_facturation']) else r['statut_facturation'],
                   'id': None if pd.isna(r['identification']) else r['identification'],
                   'bal': 0.0 if pd.isna(r['balance']) else float(r['balance'])} for _, r in comptes.iterrows()])
    print(f"  COMPTES: {len(comptes)}")

    # SERVICES (already in schema.sql, skip if exists)
    print("  SERVICES: already seeded")

    # FACTURES
    colonnes_mois = [col for col in df.columns if re.search(r'(Facture|Impay)', str(col), re.IGNORECASE)]
    if colonnes_mois:
        print(f"  {len(colonnes_mois)} monthly columns detected")
        df_long = pd.melt(df, id_vars=['num_compte'], value_vars=colonnes_mois, var_name='libelle_periode', value_name='montant_facture')
        df_long['montant_facture'] = df_long['montant_facture'].apply(lambda x: 0.0 if pd.isna(x) else round(float(x), 2))
        df_long = df_long[df_long['montant_facture'] != 0]
        df_long['type_flux'] = df_long['libelle_periode'].apply(lambda x: 'IMPAYE' if 'mpay' in str(x).lower() else 'FACTURE')

        mois_map = {'janvier': '01', 'février': '02', 'fevrier': '02', 'mars': '03', 'avril': '04', 'mai': '05', 'juin': '06', 'juillet': '07', 'août': '08', 'aout': '08', 'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12', 'decembre': '12'}
        def extract_date(lib):
            lib = str(lib).lower()
            annee = (re.search(r'20\d{2}', lib) or type('', (), {'group': lambda self, n: '2026'})()).group(0)
            mois = '01'
            for m, n in mois_map.items():
                if m in lib:
                    mois = n
                    break
            return f"{annee}-{mois}-01"
        df_long['date_emission'] = df_long['libelle_periode'].apply(extract_date)
        df_long['num_compte'] = df_long['num_compte'].astype(str)
        df_long['id_facture'] = ('FAC_' + df_long['num_compte'] + '_' + df_long['libelle_periode'].str.replace(' ', '_').replace('/', '_')).str[:128]
        factures = df_long[['id_facture', 'num_compte', 'date_emission', 'montant_facture', 'type_flux', 'libelle_periode']].drop_duplicates(subset=['id_facture'])
        factures['num_compte'] = factures['num_compte'].astype(int)
        factures = factures[factures['num_compte'].isin(comptes['num_compte'].unique())]

        batch_insert(conn,
            "INSERT INTO facture (id_facture, num_compte, date_emission, montant_facture, paid_amount, outstanding_amount, status, type_flux, libelle_periode) "
            "VALUES (:id, :nc, :de, :mf, 0, :mf, 'OPEN', :tf, :lp) ON CONFLICT (id_facture) DO NOTHING",
            [{'id': r['id_facture'], 'nc': int(r['num_compte']), 'de': r['date_emission'],
              'mf': r['montant_facture'], 'tf': r['type_flux'], 'lp': r['libelle_periode']} for _, r in factures.iterrows()])
        print(f"  FACTURES: {len(factures)}")
    else:
        print("  No monthly columns found")

# --- Create demo user ---
with engine.begin() as conn:
    exists = conn.execute(text("SELECT id, password_hash FROM users WHERE email = :email"), {"email": DEMO_EMAIL}).fetchone()
    if exists:
        conn.execute(text("UPDATE users SET password_hash=:pw, full_name='Diane Mbarga', status='ACTIVE', must_change_password=false, updated_at=now() WHERE email=:email"),
                     {"pw": hash_password(DEMO_PASSWORD), "email": DEMO_EMAIL})
    else:
        uid = str(uuid4())
        conn.execute(text("INSERT INTO users (id, email, password_hash, full_name, status, created_at, updated_at, must_change_password) VALUES (:id, :email, :pw, 'Diane Mbarga', 'ACTIVE', now(), now(), false)"),
                     {"id": uid, "email": DEMO_EMAIL, "pw": hash_password(DEMO_PASSWORD)})
        role = conn.execute(text("SELECT id FROM roles WHERE code='AGENT' LIMIT 1")).fetchone()
        if not role:
            rid = str(uuid4())
            conn.execute(text("INSERT INTO roles (id, code, name, description, status, created_at, updated_at) VALUES (:id, 'AGENT', 'Agent', 'Demo', 'ACTIVE', now(), now())"), {"id": rid})
        else:
            rid = str(role[0])
        conn.execute(text("INSERT INTO user_roles (user_id, role_id, created_at) VALUES (:u, :r, now()) ON CONFLICT DO NOTHING"), {"u": uid, "r": rid})

print(f"\n✅ Demo user: {DEMO_EMAIL} / {DEMO_PASSWORD}")

# --- Summary ---
with engine.connect() as conn:
    r = conn.execute(text("""
        SELECT (SELECT COUNT(*) FROM centre), (SELECT COUNT(*) FROM agence),
               (SELECT COUNT(*) FROM gestionnaire), (SELECT COUNT(*) FROM client),
               (SELECT COUNT(*) FROM compte), (SELECT COUNT(*) FROM facture)
    """)).fetchone()
print(f"Centre:{r[0]}  Agence:{r[1]}  Gestionnaire:{r[2]}  Client:{r[3]}  Compte:{r[4]}  Facture:{r[5]}")
print("✅ Import done!")
