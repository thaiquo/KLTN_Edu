# PowerShell script to start all EduConnect Backend Services in separate windows

Write-Host "=== Starting EduConnect Service-Based Architecture ===" -ForegroundColor Cyan

$root = "$PSScriptRoot\.."

Write-Host "1. Starting API Gateway (Port 8080)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend\api-gateway'; .\mvnw.cmd spring-boot:run"

Write-Host "2. Starting Account Service (Port 8081)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend\account-service'; .\mvnw.cmd spring-boot:run"

Write-Host "3. Starting Learning Service (Port 8082)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend\learning-service'; .\mvnw.cmd spring-boot:run"

Write-Host "4. Starting Contract Service (Port 8083)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend\contract-service'; .\mvnw.cmd spring-boot:run"

Write-Host "5. Starting Notification Service (Port 8084)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend\notification-service'; .\mvnw.cmd spring-boot:run"

Write-Host "6. Starting AI Service (Port 8085)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend\ai-service'; if (Test-Path .\mvnw.cmd) { .\mvnw.cmd spring-boot:run } else { mvn spring-boot:run }"

Write-Host "`nStarted all 6 Core Backend Services." -ForegroundColor Green
Write-Host "To run Frontend: cd frontend-web && npm run dev" -ForegroundColor Cyan
