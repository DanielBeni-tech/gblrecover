# =============================================================================
# GBLRecover - Demarrage de la base dediee (cluster PostgreSQL local, Windows)
#
# Reproduit scripts/start_local.sh sous Windows :
#   1. Initialise le cluster dedie si absent (~/.gblrecover/pgdata, port 5433,
#      superuser postgres / mot de passe postgres) ;
#   2. Dmarre le cluster si ncessaire ;
#   3. Applique database/schema.sql + database/views.sql (idempotent) ;
#   4. (Le bootstrap FastAPI au dmarrage seme ensuite roles + comptes de dmo.)
#
# Usage :
#   powershell -ExecutionPolicy Bypass -File scripts\start_local.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\start_local.ps1 -SkipSchema
# =============================================================================
param(
    [string]$PgBin = "C:\Program Files\PostgreSQL\18\bin",
    [string]$BaseDir = "$env:USERPROFILE\.gblrecover",
    [string]$DataDir = "$env:USERPROFILE\.gblrecover\pgdata",
    [int]$Port = 5433,
    [switch]$SkipSchema
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path "$PgBin\pg_ctl.exe")) {
    throw "pg_ctl.exe introuvable dans '$PgBin'. Ajustez le parametre -PgBin."
}

function Wait-Ready {
    param([int]$TimeoutSec = 25)
    foreach ($i in 1..($TimeoutSec * 2)) {
        Start-Sleep -Milliseconds 500
        & "$PgBin\pg_isready.exe" -h 127.0.0.1 -p $Port *> $null
        if ($LASTEXITCODE -eq 0) { return $true }
    }
    return $false
}

# --- 1. Initialisation du cluster (une seule fois) ---------------------------
if (-not (Test-Path "$DataDir\PG_VERSION")) {
    New-Item -ItemType Directory -Force -Path $BaseDir | Out-Null
    Write-Host "[gblrecover] Initialisation du cluster dans $DataDir ..."
    $pwFile = Join-Path $BaseDir 'pw.tmp'
    [IO.File]::WriteAllText($pwFile, "postgres`n")
    try {
        & "$PgBin\initdb.exe" -D $DataDir -U postgres -E UTF8 `
            -A scram-sha-256 --pwfile="$pwFile"
        if ($LASTEXITCODE -ne 0) { throw "initdb a echoue." }
    } finally {
        Remove-Item $pwFile -Force -ErrorAction SilentlyContinue
    }
}

# --- 2. Demarrage (si besoin) -----------------------------------------------
& "$PgBin\pg_isready.exe" -h 127.0.0.1 -p $Port *> $null
if ($LASTEXITCODE -eq 0) {
    Write-Host "[gblrecover] PostgreSQL deja actif sur le port $Port."
} else {
    Write-Host "[gblrecover] Demarrage du cluster sur le port $Port ..."
    # Fenetre cachee separee : immunise contre la fermeture du terminal courant
    # (un Ctrl+C / fermeture de console tuerait un postgres attache a celle-ci).
    $psi = New-Object Diagnostics.ProcessStartInfo
    $psi.FileName = "$env:SystemRoot\System32\cmd.exe"
    $psi.Arguments = "/c `"`"$PgBin\pg_ctl.exe`" -D `"$DataDir`" -o `"--port=$Port`" -l `"$BaseDir\pg.log`" start`""
    $psi.UseShellExecute = $true          # -> nouveau groupe de processus
    $psi.WindowStyle = 'Hidden'
    [void][Diagnostics.Process]::Start($psi)

    if (-not (Wait-Ready)) { throw "PostgreSQL ne repond pas apres demarrage. Voir $BaseDir\pg.log" }
}

# --- 3. Creation base + schema officiel --------------------------------------
$env:PGPASSWORD = 'postgres'
try {
    $exists = (& "$PgBin\psql.exe" -h localhost -p $Port -U postgres -d postgres -tAc `
        "SELECT 1 FROM pg_database WHERE datname='gblrecover'")
    if ($exists.Trim() -ne '1') {
        Write-Host '[gblrecover] Creation de la base gblrecover ...'
        & "$PgBin\createdb.exe" -h localhost -p $Port -U postgres gblrecover
    }

    if (-not $SkipSchema) {
        Write-Host '[gblrecover] Application schema.sql + views.sql (idempotent) ...'
        & "$PgBin\psql.exe" -h localhost -p $Port -U postgres -d gblrecover `
            -v ON_ERROR_STOP=1 -P pager=off `
            -f (Join-Path $RepoRoot 'database\schema.sql')
        & "$PgBin\psql.exe" -h localhost -p $Port -U postgres -d gblrecover `
            -v ON_ERROR_STOP=1 -P pager=off `
            -f (Join-Path $RepoRoot 'database\views.sql')
    }
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host '[gblrecover] Base prete : postgresql://postgres:postgres@localhost:'"$Port/gblrecover"
Write-Host '[gblrecover] Demarrez maintenant le backend :'
Write-Host '    cd backend ; uvicorn app.main:app --reload --host 0.0.0.0 --port 8000'
