param([int]$Port = 8001)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$pythonPath = Join-Path $projectRoot '.venv\Scripts\python.exe'
if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Choose a port between 1024 and 65535.' }
$previewOrigin = "http://localhost:$Port"
$overrides = @{
    VITE_API_URL = '/api'
    STATIC_DIR = (Join-Path $projectRoot 'frontend\dist')
    FRONTEND_URL = $previewOrigin
    BACKEND_URL = $previewOrigin
    CORS_ORIGINS = ('["' + $previewOrigin + '"]')
    ENVIRONMENT = 'development'
    COOKIE_SECURE = 'false'
    CLIENT_IP_SOURCE = 'connection'
}
$savedEnvironment = @{}
foreach ($key in $overrides.Keys) {
    $savedEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
    [Environment]::SetEnvironmentVariable($key, $overrides[$key], 'Process')
}
try {
    Push-Location (Join-Path $projectRoot 'frontend')
    try {
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    } finally { Pop-Location }
    Push-Location (Join-Path $projectRoot 'backend')
    try {
        & $pythonPath -m alembic upgrade head
        if ($LASTEXITCODE -ne 0) { throw 'Migration failed. Check PostgreSQL and DATABASE_URL.' }
        Write-Output "Local built-app preview: $previewOrigin/dashboard (HTTP; cloud HTTPS is not simulated)."
        & $pythonPath -m uvicorn app.main:app --host 127.0.0.1 --port $Port --workers 1 --no-proxy-headers --no-access-log
        if ($LASTEXITCODE -ne 0) { throw 'Preview server stopped with an error.' }
    } finally { Pop-Location }
} finally {
    foreach ($key in $savedEnvironment.Keys) { [Environment]::SetEnvironmentVariable($key, $savedEnvironment[$key], 'Process') }
}
