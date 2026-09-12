[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$serviceDirectory = Join-Path $projectRoot 'backend\contract-service'
$jar = Join-Path $serviceDirectory 'target\contract-service-0.0.1-SNAPSHOT.jar'
if (-not (Test-Path -LiteralPath $jar -PathType Leaf)) { throw 'Build contract-service with Maven package first.' }
foreach ($line in Get-Content -LiteralPath (Join-Path $projectRoot '.env')) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) { continue }
    $separator = $line.IndexOf('=')
    if ($separator -le 0) { continue }
    $name = $line.Substring(0, $separator).Trim()
    if ($name -match '^[A-Za-z_][A-Za-z0-9_]*$') {
        [Environment]::SetEnvironmentVariable($name, $line.Substring($separator + 1), 'Process')
    }
}
if ($env:BLOCKCHAIN_OPERATOR_ENABLED -eq 'true') {
    if (-not $env:BLOCKCHAIN_OPERATOR_PRIVATE_KEY -and -not $env:BLOCKCHAIN_OPERATOR_KEYSTORE_PASSWORD -and
        -not (Test-Path -LiteralPath $env:BLOCKCHAIN_OPERATOR_KEYSTORE_PASSWORD_FILE -PathType Leaf)) {
        throw 'Configure unattended operator credentials before restarting.'
    }
}
$runtime = Join-Path $projectRoot '.runtime\contract-service'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$listeners = @(Get-NetTCPConnection -State Listen -LocalPort 8083 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique)
foreach ($processId in $listeners) {
    $candidate = Get-CimInstance Win32_Process -Filter "ProcessId = $processId"
    if ($candidate.Name -ne 'java.exe' -or $candidate.CommandLine -notmatch 'contract_service.ContractServiceApplication|contract-service-0\.0\.1-SNAPSHOT\.jar') {
        throw "Port 8083 belongs to an unrelated process ($processId); restart aborted."
    }
    Stop-Process -Id $processId
    Wait-Process -Id $processId -Timeout 15 -ErrorAction SilentlyContinue
}
$launched = Start-Process -FilePath (Get-Command java.exe).Source -ArgumentList @('-jar', ('"' + $jar + '"')) `
    -WorkingDirectory $serviceDirectory -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $runtime "$stamp.out.log") `
    -RedirectStandardError (Join-Path $runtime "$stamp.err.log")
Write-Output "Contract service started: PID $($launched.Id). Logs: .runtime/contract-service/$stamp.out.log"
Write-Output 'Startup applies Flyway migrations and validates the configured existing deployment and operator.'
