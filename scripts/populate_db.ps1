# =============================================================================
# GBLRecover - Peuplement de la base de donnees (procedure officielle, Windows)
#
# Procedure complete pour preparer une base 'gblrecover' exploitable :
#   1. Verifie / demarre le cluster PostgreSQL dedie (~/.gblrecover, port 5433) ;
#   2. Cree la base 'gblrecover' si absente ;
#   3. Applique database/schema.sql puis database/views.sql (idempotent) ;
#   4. Charge les donnees reelles : database/load_data.py
#      (fichier << GBL - Juillet 2026.xlsx >> -> CENTRE, AGENCE, GESTIONNAIRE,
#       CLIENT, COMPTE, FACTURE + batch d'import trace dans IMPORT_BATCHES) ;
#   5. Seme les roles AGENT/ADMIN + comptes de demo (backend/scripts/seed_demo.py) ;
#   6. Affiche le resume des effectifs pour verification.
#
# Idempotent : rejouable sans creer de doublons (upserts ON CONFLICT cote
# loader ; bootstrap des comptes re-entrant).
#
# Usage :
#   powershell -ExecutionPolicy Bypass -File scripts\populate_db.ps1              # peuplement standard
#   powershell -ExecutionPolicy Bypass -File scripts\populate_db.ps1 -Clean       # RESET total (DROP SCHEMA public CASCADE) puis rechargement complet
#   powershell -ExecutionPolicy Bypass -File scripts\populate_db.ps1 -SkipData    # schema + vues uniquement (sans Excel ni comptes)
# =============================================================================

param(
    [string]$PgBin = "C:\Program Files\PostgreSQL\18\bin",
    [string]$BaseDir = "$env:USERPROFILE\.gblrecover",
    [string]$DataDir = "$env:USERPROFILE\.gblrecover\pgdata",
    [int]$Port = 5433,
    [string]$DbUser = "postgres",
    [string]$DbPass = "postgres",
    [string]$DbName = "gblrecover",
    [switch]$Clean,
    [switch]$SkipData
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot

function Wait-Ready {
    param([int]$TimeoutSec = 25)
    foreach ($i in 1..($TimeoutSec * 2)) {
        Start-Sleep -Milliseconds 500
        & "$PgBin\pg_isready.exe" -h 127.0.0.1 -p $Port *> $null
        if ($LASTEXITCODE -eq 0) { return $true }
    }
    return $false
}

if (-not (Test-Path "$PgBin\psql.exe")) {
    throw "psql.exe introuvable dans '$PgBin'. Ajustez le parametre -PgBin."
}

# --- Python a utiliser : venv du backend si present, sinon python global -----
$PyExe = Join-Path $RepoRoot 'backend\venv\Scripts\python.exe'
if (-not (Test-Path $PyExe)) { $PyExe = 'python' }

# --- 1. Cluster PostgreSQL ----------------------------------------------------
Write-Host "[gblrecover] 1/6 Cluster PostgreSQL ($Port) ..."
& "$PgBin\pg_isready.exe" -h 127.0.0.1 -p $Port *> $null
if ($LASTEXITCODE -ne 0) {
    if (-not (Test-Path "$DataDir\PG_VERSION")) {
        throw "Aucun cluster sur le port $Port et aucun cluster dedie dans '$DataDir'. Lancez d'abord scripts\start_local.ps1."
    }
    Write-Host '[gblrecover] Demarrage du cluster dedie ...'
    # Fenetre cachee separee : immunise contre la fermeture du terminal courant.
    $psi = New-Object Diagnostics.ProcessStartInfo
    $psi.FileName = "$env:SystemRoot\System32\cmd.exe"
    $psi.Arguments = "/c `"`"$PgBin\pg_ctl.exe`" -D `"$DataDir`" -o `"--port=$Port`" -l `"$BaseDir\pg.log`" start`""
    $psi.UseShellExecute = $true
    $psi.WindowStyle = 'Hidden'
    [void][Diagnostics.Process]::Start($psi)
    if (-not (Wait-Ready)) { throw "PostgreSQL ne repond pas apres demarrage. Voir $BaseDir\pg.log" }
} else {
    Write-Host "[gblrecover] Cluster actif sur le port $Port."
}

$env:PGPASSWORD = $DbPass
try {
    # --- 2. Creation de la base si absente -----------------------------------
    Write-Host "[gblrecover] 2/6 Base de donnees '$DbName' ..."
    $exists = (& "$PgBin\psql.exe" -h localhost -p $Port -U $DbUser -d postgres -tAc `
        "SELECT 1 FROM pg_database WHERE datname='$DbName'")
    if ($exists.Trim() -ne '1') {
        Write-Host "[gblrecover] Creation de la base $DbName ..."
        & "$PgBin\createdb.exe" -h localhost -p $Port -U $DbUser $DbName
    }

    # --- Reset optionnel (-Clean) --------------------------------------------
    if ($Clean) {
        Write-Host '[gblrecover] RESET : DROP SCHEMA public CASCADE ...'
        & "$PgBin\psql.exe" -h localhost -p $Port -U $DbUser -d $DbName `
            -v ON_ERROR_STOP=1 -P pager=off `
            -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
    }

    # --- 3. Schema officiel + vues (idempotent) ------------------------------
    Write-Host '[gblrecover] 3/6 Application schema.sql + views.sql ...'
    & "$PgBin\psql.exe" -h localhost -p $Port -U $DbUser -d $DbName `
        -v ON_ERROR_STOP=1 -P pager=off `
        -f (Join-Path $RepoRoot 'database\schema.sql')
    & "$PgBin\psql.exe" -h localhost -p $Port -U $DbUser -d $DbName `
        -v ON_ERROR_STOP=1 -P pager=off `
        -f (Join-Path $RepoRoot 'database\views.sql')

    if (-not $SkipData) {
        # --- 4. Donnees reelles (Excel) via database/load_data.py ------------
        Write-Host '[gblrecover] 4/6 Chargement des donnees reelles (GBL - Juillet 2026.xlsx) ...'
        Push-Location (Join-Path $RepoRoot 'database')
        try {
            # Le loader lit l'Excel par chemin relatif -> s'executer depuis database/.
            # Le DDL est deja gere ci-dessus => CLEAN_DB=false (evite un appel
            # subprocess a psql, absent du PATH).
            $env:POSTGRES_USER = $DbUser
            $env:POSTGRES_PASSWORD = $DbPass
            $env:POSTGRES_HOST = 'localhost'
            $env:POSTGRES_PORT = "$Port"
            $env:POSTGRES_DB = $DbName
            $env:CLEAN_DB = 'false'
            & $PyExe load_data.py
            if ($LASTEXITCODE -ne 0) { throw "load_data.py a echoue." }
        } finally {
            Pop-Location
        }

        # --- 5. Roles AGENT/ADMIN + comptes de demo ---------------------------
        Write-Host '[gblrecover] 5/6 Roles + comptes de demonstration ...'
        Push-Location (Join-Path $RepoRoot 'backend')
        try {
            $env:DATABASE_URL = "postgresql://${DbUser}:${DbPass}@localhost:${Port}/${DbName}"
            & $PyExe -m scripts.seed_demo
            if ($LASTEXITCODE -ne 0) { throw "seed_demo.py a echoue." }
        } finally {
            Pop-Location
        }
    } else {
        Write-Host '[gblrecover] 4-5/6 Ignores (-SkipData).'
    }

    # --- 6. Verification ------------------------------------------------------
    Write-Host '[gblrecover] 6/6 Verification des effectifs ...'
    & "$PgBin\psql.exe" -h localhost -p $Port -U $DbUser -d $DbName -P pager=off -c `
        "SELECT 'CENTRE' AS table_name, COUNT(*) AS effectif FROM centre UNION ALL SELECT 'AGENCE', COUNT(*) FROM agence UNION ALL SELECT 'GESTIONNAIRE', COUNT(*) FROM gestionnaire UNION ALL SELECT 'CLIENT', COUNT(*) FROM client UNION ALL SELECT 'COMPTE', COUNT(*) FROM compte UNION ALL SELECT 'FACTURE', COUNT(*) FROM facture UNION ALL SELECT 'SERVICE', COUNT(*) FROM service UNION ALL SELECT 'USERS', COUNT(*) FROM users ORDER BY 1;"
}
finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host "[gblrecover] Base prete : postgresql://$DbUser`:***@localhost:$Port/$DbName"
Write-Host '[gblrecover] Comptes de demo : agent@camtel.cm / demo1234  |  admin@camtel.cm / admin1234'
Write-Host '[gblrecover] Demarrez le backend : cd backend ; uvicorn app.main:app --reload --host 0.0.0.0 --port 8000'

