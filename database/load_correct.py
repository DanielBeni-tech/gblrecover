"""
GBLRecover correct loader — merges Facture + Impayés into one invoice per month.
Uses pandas melt for fast vectorized processing.
paid_amount = montant_facture - outstanding (impayés).
"""
import os, re, hashlib
from datetime import datetime
from uuid import uuid4
import pandas as pd
from sqlalchemy import create_engine, text
from passlib.context import CryptContext

USER = os.getenv("POSTGRES_USER", "postgres")
PASSWORD = os.getenv("POSTGRES_PASSWORD", "Adzaba1983")
HOST = os.getenv("POSTGRES_HOST", "localhost")
PORT = os.getenv("POSTGRES_PORT", "5432")
DB = os.getenv("POSTGRES_DB", "gblrecover")
DEMO_EMAIL = os.getenv("DEMO_EMAIL", "agent@camtel.cm")
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "demo1234")

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
def hash_pw(pw):
    return pwd_ctx.hash(pw.encode("utf-8")[:72].decode("utf-8", errors="ignore"))

engine = create_engine(f"postgresql://{USER}:{PASSWORD}@{HOST}:{PORT}/{DB}")

# === STEP 1: Reset schema ===
print("[0] Resetting schema...")
with engine.begin() as conn:
    conn.execute(text("DROP SCHEMA public CASCADE"))
    conn.execute(text("CREATE SCHEMA public"))
    with open(os.path.join(os.path.dirname(__file__), "schema.sql"), "r", encoding="utf-8") as f:
        conn.execute(text(f.read()))
print("  Schema OK")

# === STEP 2: Read Excel ===
fp = os.path.join(os.path.dirname(__file__), "GBL - Juillet 2026.xlsx")
df = pd.read_excel(fp)
df.columns = df.columns.str.strip()
print(f"[1] Loaded {len(df)} rows, {len(df.columns)} columns")

CMAP = {'Code client':'code_client','Raison sociale':'raison_sociale','Marché':'marche',
        'Email':'email','Contact':'tel','Compte':'num_compte','Mat. Gestionnaire':'mat_gestionnaire',
        'Gestionnaire':'nom_gestionnaire','Agence':'nom_agence','Centre gestion':'nom_centre',
        'E-Bill':'e_bill','Facturation':'statut_facturation','Identification':'identification','Balance':'balance'}
df.rename(columns=CMAP, inplace=True)

# === Cleaning ===
def cs(v, mx=None):
    if pd.isna(v): return None
    s=str(v).strip(); return s[:mx] if mx and len(s)>mx else s or None
def cp(v):
    if pd.isna(v): return None
    d=re.sub(r'\D','',str(v).strip()); return int(d) if len(d)>=8 else None
def cb(v):
    if pd.isna(v): return 0.0
    try: return float(v)
    except: return 0.0
def cm(v):
    if pd.isna(v): return 'NON SPECIFIE'
    v=str(v).strip().upper(); return v or 'NON SPECIFIE'
def ci(v):
    if pd.isna(v): return 'Non identifié'
    s=str(v).strip().lower()
    if s.startswith('identifi') and 'non' not in s: return 'Identifié'
    if 'en cours' in s: return 'En cours de vérification'
    if 'non' in s: return 'Non identifié'
    return cs(v,128)
def safe(v):
    if pd.isna(v): return None
    if isinstance(v, float) and v != v: return None
    return v

df['code_client'] = df['code_client'].apply(lambda x: int(x) if pd.notna(x) else None)
df['num_compte'] = df['num_compte'].apply(lambda x: int(x) if pd.notna(x) else None)
for c in ['raison_sociale','email','mat_gestionnaire','nom_gestionnaire','nom_agence']:
    df[c] = df[c].apply(lambda x: cs(x, 128))
df['nom_centre'] = df['nom_centre'].apply(lambda x: cs(x,128) or 'NON SPECIFIE')
for c in ['e_bill','statut_facturation']:
    df[c] = df[c].apply(lambda x: cs(x, 50))
df['identification'] = df['identification'].apply(ci)
df['marche'] = df['marche'].apply(cm)
df['tel'] = df['tel'].apply(cp)
df['balance'] = df['balance'].apply(cb)
df['id_agence'] = 'AG_' + df['nom_agence'].astype(str)
print("[1] Cleaned")

# === Batch insert helper ===
def insert_batch(conn, sql, rows, label, size=5000):
    for i in range(0, len(rows), size):
        conn.execute(text(sql), rows[i:i+size])
    print(f"  {label}: {len(rows)}")

# === STEP 3: Import dimension tables ===
print("[2] Importing dimension tables...")
with engine.begin() as conn:
    centres = df[['nom_centre']].drop_duplicates().dropna()
    centres = centres[centres['nom_centre'] != '']
    insert_batch(conn, "INSERT INTO centre (nom_centre) VALUES (:nc) ON CONFLICT DO NOTHING",
                 [{'nc': r} for r in centres['nom_centre']], "CENTRES")

    agences = df[['nom_agence', 'nom_centre']].dropna(subset=['nom_agence']).drop_duplicates()
    agences['id_agence'] = 'AG_' + agences['nom_agence'].astype(str)
    agences = agences.drop_duplicates(subset=['id_agence'])
    agences = agences[agences['nom_centre'].isin(centres['nom_centre'])]
    insert_batch(conn, "INSERT INTO agence (id_agence, nom_agence, nom_centre) VALUES (:id, :na, :nc) ON CONFLICT DO NOTHING",
                 [{'id':r['id_agence'],'na':r['nom_agence'],'nc':r['nom_centre']} for _,r in agences.iterrows()], "AGENCES")

    gest = df[['mat_gestionnaire','nom_gestionnaire']].dropna(subset=['mat_gestionnaire']).copy()
    gest['mat_gestionnaire'] = gest['mat_gestionnaire'].astype(str)
    gest = gest.drop_duplicates(subset=['mat_gestionnaire'])
    insert_batch(conn, "INSERT INTO gestionnaire (mat_gestionnaire, nom_gestionnaire) VALUES (:m, :n) ON CONFLICT DO NOTHING",
                 [{'m':r['mat_gestionnaire'],'n':r['nom_gestionnaire']} for _,r in gest.iterrows()], "GESTIONNAIRES")

    cl = df[['code_client','raison_sociale','marche','email','tel']].dropna(subset=['code_client']).copy()
    cl['code_client'] = cl['code_client'].astype(int)
    cl = cl.drop_duplicates(subset=['code_client'])
    insert_batch(conn, "INSERT INTO client (code_client, raison_sociale, marche, email, tel) VALUES (:cc, :rs, :m, :e, :t) ON CONFLICT DO NOTHING",
                 [{'cc':int(r['code_client']),'rs':r['raison_sociale'],'m':r['marche'],'e':safe(r['email']),'t':safe(r['tel'])} for _,r in cl.iterrows()], "CLIENTS")

    co = df[['num_compte','mat_gestionnaire','id_agence','code_client','e_bill','statut_facturation','identification','balance']].copy()
    co = co.dropna(subset=['num_compte','code_client','id_agence'])
    co['num_compte'] = co['num_compte'].astype(int)
    co['code_client'] = co['code_client'].astype(int)
    co['mat_gestionnaire'] = co['mat_gestionnaire'].astype(str)
    co = co[co['id_agence'].isin(agences['id_agence'])]
    co = co[co['mat_gestionnaire'].isin(gest['mat_gestionnaire'])]
    co = co[co['code_client'].isin(cl['code_client'])]
    co = co.drop_duplicates(subset=['num_compte'])
    insert_batch(conn, "INSERT INTO compte (num_compte, mat_gestionnaire, id_agence, code_client, e_bill, statut_facturation, identification, balance) VALUES (:nc,:mg,:ia,:cc,:eb,:sf,:id,:bal) ON CONFLICT DO NOTHING",
                 [{'nc':int(r['num_compte']),'mg':str(r['mat_gestionnaire']),'ia':r['id_agence'],'cc':int(r['code_client']),
                   'eb':safe(r['e_bill']),'sf':safe(r['statut_facturation']),'id':safe(r['identification']),'bal':float(r['balance'])} for _,r in co.iterrows()], "COMPTES")
    print("  SERVICES: seeded")

# === STEP 4: Build factures using melt (fast vectorized) ===
print("[3] Building factures (Facture+Impayés merged)...")

mois_map = {'janvier':'01','février':'02','fevrier':'02','mars':'03','avril':'04','mai':'05',
            'juin':'06','juillet':'07','août':'08','aout':'08','septembre':'09','octobre':'10',
            'novembre':'11','décembre':'12','decembre':'12'}

def extract_date(lib):
    lib = str(lib).lower()
    m = re.search(r'20\d{2}', lib)
    annee = m.group(0) if m else '2026'
    mois = '01'
    for mn, n in mois_map.items():
        if mn in lib:
            mois = n
            break
    return f"{annee}-{mois}-01"

# Detect facture columns and their impaye pairs
fact_cols = [c for c in df.columns if re.match(r'.+\s+Facture\s+\d{4}', c, re.IGNORECASE)]
imp_cols_map = {}
for ic in df.columns:
    m = re.match(r'(.+?)\s+Impay', ic, re.IGNORECASE)
    if m:
        month_label = m.group(1).strip()
        for fc in fact_cols:
            if fc.startswith(month_label):
                imp_cols_map[fc] = ic
                break

print(f"  {len(fact_cols)} facture columns, {len(imp_cols_map)} with impayés pairing")

# Melt factures
df_fact = pd.melt(df, id_vars=['num_compte'], value_vars=fact_cols, var_name='col_facture', value_name='montant')
df_fact['montant'] = df_fact['montant'].apply(lambda x: 0.0 if pd.isna(x) else round(float(x), 2))
df_fact = df_fact[df_fact['montant'] > 0]
df_fact['date_emission'] = df_fact['col_facture'].apply(extract_date)
df_fact['lp'] = df_fact['col_facture']

# Melt impayés
if imp_cols_map:
    imp_cols_list = list(imp_cols_map.values())
    df_imp = pd.melt(df, id_vars=['num_compte'], value_vars=imp_cols_list, var_name='col_impaye', value_name='impaye')
    df_imp['impaye'] = df_imp['impaye'].apply(lambda x: 0.0 if pd.isna(x) else round(float(x), 2))
    # Map impaye col back to facture col
    imp_to_fact = {v: k for k, v in imp_cols_map.items()}
    df_imp['col_facture'] = df_imp['col_impaye'].map(imp_to_fact)

    # Merge facture + impaye on (num_compte, col_facture)
    df_fact = df_fact.merge(df_imp[['num_compte','col_facture','impaye']], on=['num_compte','col_facture'], how='left')
else:
    df_fact['impaye'] = df_fact['montant']

df_fact['impaye'] = df_fact['impaye'].fillna(df_fact['montant'])
# Cap impaye at montant
df_fact['impaye'] = df_fact[['impaye','montant']].min(axis=1)

# Calculate paid and status
df_fact['paid'] = (df_fact['montant'] - df_fact['impaye']).clip(lower=0).round(2)
df_fact['outstanding'] = df_fact['impaye']
df_fact['status'] = df_fact.apply(lambda r: 'PAID' if r['paid'] >= r['montant'] else ('PARTIAL' if r['paid'] > 0 else 'OPEN'), axis=1)

# Build IDs
df_fact['num_compte'] = df_fact['num_compte'].astype(int)
df_fact['id_facture'] = ('FAC_' + df_fact['num_compte'].astype(str) + '_' + df_fact['col_facture'].str.replace(' ', '_').str.replace('/', '_')).str[:128]

valid_comptes = set(co['num_compte'].unique())
df_fact = df_fact[df_fact['num_compte'].isin(valid_comptes)]
df_fact = df_fact.drop_duplicates(subset=['id_facture'])

print(f"  {len(df_fact)} factures ready")
print(f"  Sample: montant={df_fact['montant'].iloc[0]}, impaye={df_fact['outstanding'].iloc[0]}, paid={df_fact['paid'].iloc[0]}, status={df_fact['status'].iloc[0]}")

# Insert
with engine.begin() as conn:
    sql = ("INSERT INTO facture (id_facture, num_compte, date_emission, montant_facture, "
           "paid_amount, outstanding_amount, status, type_flux, libelle_periode) "
           "VALUES (:id,:nc,:de,:mf,:pa,:ou,:st,:tf,:lp) ON CONFLICT DO NOTHING")
    rows = [{'id':r['id_facture'],'nc':int(r['num_compte']),'de':r['date_emission'],
             'mf':r['montant'],'pa':r['paid'],'ou':r['outstanding'],
             'st':r['status'],'tf':'FACTURE','lp':r['lp']} for _, r in df_fact.iterrows()]
    insert_batch(conn, sql, rows, "FACTURES", size=10000)

# === STEP 5: Demo user ===
print("[4] Creating demo user...")
with engine.begin() as conn:
    exists = conn.execute(text("SELECT id FROM users WHERE email=:e"), {"e": DEMO_EMAIL}).fetchone()
    if exists:
        conn.execute(text("UPDATE users SET password_hash=:pw, full_name='Diane Mbarga', status='ACTIVE', must_change_password=false WHERE email=:e"),
                     {"pw": hash_pw(DEMO_PASSWORD), "e": DEMO_EMAIL})
    else:
        uid = str(uuid4())
        conn.execute(text("INSERT INTO users (id,email,password_hash,full_name,status,created_at,updated_at,must_change_password) VALUES (:i,:e,:pw,'Diane Mbarga','ACTIVE',now(),now(),false)"),
                     {"i": uid, "e": DEMO_EMAIL, "pw": hash_pw(DEMO_PASSWORD)})
        r = conn.execute(text("SELECT id FROM roles WHERE code='AGENT'")).fetchone()
        rid = str(r[0]) if r else str(uuid4())
        if not r:
            conn.execute(text("INSERT INTO roles (id,code,name,description,status,created_at,updated_at) VALUES (:i,'AGENT','Agent','Demo','ACTIVE',now(),now())"), {"i": rid})
        conn.execute(text("INSERT INTO user_roles (user_id,role_id,created_at) VALUES (:u,:r,now()) ON CONFLICT DO NOTHING"), {"u": uid, "r": rid})

# === STEP 6: Apply views ===
print("[5] Applying views...")
with engine.begin() as conn:
    with open(os.path.join(os.path.dirname(__file__), "views.sql"), "r", encoding="utf-8") as f:
        conn.execute(text(f.read()))

# === STEP 7: Summary ===
print("\n[6] SUMMARY")
with engine.connect() as conn:
    r = conn.execute(text("""
        SELECT (SELECT COUNT(*) FROM centre), (SELECT COUNT(*) FROM agence),
               (SELECT COUNT(*) FROM gestionnaire), (SELECT COUNT(*) FROM client),
               (SELECT COUNT(*) FROM compte), (SELECT COUNT(*) FROM facture)
    """)).fetchone()
    print(f"  Centre:{r[0]} Agence:{r[1]} Gestionnaire:{r[2]} Client:{r[3]} Compte:{r[4]} Facture:{r[5]}")

    r2 = conn.execute(text("SELECT SUM(montant_facture), SUM(paid_amount), SUM(outstanding_amount) FROM facture")).fetchone()
    total_fac = float(r2[0] or 0)
    total_paid = float(r2[1] or 0)
    total_outstanding = float(r2[2] or 0)
    taux = round(total_paid * 100.0 / total_fac, 2) if total_fac else 0
    print(f"  Total facturé: {total_fac:,.0f} FCFA")
    print(f"  Total payé:    {total_paid:,.0f} FCFA")
    print(f"  Total impayé:  {total_outstanding:,.0f} FCFA")
    print(f"  Taux recouvrement: {taux}%")

    r3 = conn.execute(text("SELECT status, COUNT(*) FROM facture GROUP BY status")).fetchone()
    print(f"  Status breakdown:")
    for row in conn.execute(text("SELECT status, COUNT(*) FROM facture GROUP BY status")):
        print(f"    {row[0]}: {row[1]}")

print(f"\n✅ {DEMO_EMAIL} / {DEMO_PASSWORD}")
print("✅ DONE!")
