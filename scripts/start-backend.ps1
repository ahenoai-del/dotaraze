$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$pythonPath = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (!(Test-Path -LiteralPath $pythonPath)) { throw 'Run py -3.12 -m venv .venv and install backend dependencies first.' }
Push-Location (Join-Path $projectRoot 'backend')
try {
    & $pythonPath -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) { throw 'Database migration failed. Check DATABASE_URL and PostgreSQL.' }
    & $pythonPath -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --no-proxy-headers --no-access-log
} finally { Pop-Location }
