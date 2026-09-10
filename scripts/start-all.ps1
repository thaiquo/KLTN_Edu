# Start all EduConnect backend services in separate PowerShell windows.

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path "$PSScriptRoot\..").Path
$envFile = Join-Path $projectRoot '.env'

if (-not (Test-Path -LiteralPath $envFile)) {
    throw "Configuration file not found: $envFile"
}

Get-Content -LiteralPath $envFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) {
        return
    }

    $separator = $line.IndexOf('=')
    if ($separator -le 0) {
        return
    }

    $name = $line.Substring(0, $separator).Trim()
    $value = $line.Substring($separator + 1)
    if ($name -match '^[A-Za-z_][A-Za-z0-9_]*$') {
        Set-Item -Path "Env:$name" -Value $value
    }
}

if ([string]::IsNullOrWhiteSpace($env:JWT_SECRET)) {
    throw 'JWT_SECRET is missing from the root .env file.'
}

Write-Host '=== Starting EduConnect Service-Based Architecture ===' -ForegroundColor Cyan
Write-Host 'Shared environment loaded from the root .env file.' -ForegroundColor Green

Write-Host '1. Starting API Gateway (Port 8080)...' -ForegroundColor Yellow
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location -LiteralPath '$projectRoot\backend\api-gateway'; .\mvnw.cmd spring-boot:run"

Write-Host '2. Starting Account Service (Port 8081)...' -ForegroundColor Yellow
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location -LiteralPath '$projectRoot\backend\account-service'; .\mvnw.cmd spring-boot:run"

Write-Host '3. Starting Learning Service (Port 8082)...' -ForegroundColor Yellow
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location -LiteralPath '$projectRoot\backend\learning-service'; .\mvnw.cmd spring-boot:run"

Write-Host '4. Starting Contract Service (Port 8083)...' -ForegroundColor Yellow
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location -LiteralPath '$projectRoot\backend\contract-service'; .\mvnw.cmd spring-boot:run"

Write-Host '5. Starting Notification Service (Port 8084)...' -ForegroundColor Yellow
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location -LiteralPath '$projectRoot\backend\notification-service'; .\mvnw.cmd spring-boot:run"

Write-Host '6. Starting AI Service (Port 8085)...' -ForegroundColor Yellow
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location -LiteralPath '$projectRoot\backend\ai-service'; if (Test-Path -LiteralPath '.\mvnw.cmd') { .\mvnw.cmd spring-boot:run } else { ..\account-service\mvnw.cmd spring-boot:run }"

Write-Host 'All 6 backend services were launched.' -ForegroundColor Green
Write-Host 'Start the frontend separately: cd frontend-web; npm run dev' -ForegroundColor Cyan
