param(
    [Parameter(Mandatory = $true)][string]$BinDirectory,
    [ValidateSet('start', 'stop', 'status')][string]$Action = 'start'
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$pgCtlPath = Join-Path $BinDirectory 'pg_ctl.exe'
$dataPath = Join-Path $projectRoot '.local\postgres'
if (!(Test-Path -LiteralPath (Join-Path $dataPath 'PG_VERSION'))) { throw 'No local cluster exists. Use the standard PostgreSQL or Docker setup in README.' }
if (!(Test-Path -LiteralPath $pgCtlPath)) { throw 'pg_ctl.exe not found in BinDirectory.' }
if ($Action -eq 'status') {
    & $pgCtlPath -D $dataPath status
    exit $LASTEXITCODE
}
$pgArgs = @('-D', ('"' + $dataPath + '"'), '-w')
if ($Action -eq 'start') {
    $pgArgs += @('-l', ('"' + (Join-Path $projectRoot '.local\postgres.log') + '"'), '-o', '"-p 55432 -h 127.0.0.1"', 'start')
} else { $pgArgs += @('-m', 'fast', 'stop') }
$process = Start-Process -FilePath $pgCtlPath -ArgumentList $pgArgs -WindowStyle Hidden -PassThru
# Wait only for pg_ctl, not the background PostgreSQL process tree.
if (!$process.WaitForExit(60000)) { throw 'pg_ctl did not finish within 60 seconds.' }
if ($process.ExitCode -ne 0) { throw "pg_ctl failed ($($process.ExitCode)). See .local/postgres.log." }
