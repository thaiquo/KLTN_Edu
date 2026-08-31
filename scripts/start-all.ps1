# PowerShell script to start all EduConnect Backend Services in separate windows

Write-Host "=== Khởi động EduConnect Service-Based Architecture ===" -ForegroundColor Cyan

$root = "$PSScriptRoot\.."

Write-Host "1. Khởi động API Gateway (Port 8080)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend\api-gateway'; .\mvnw.cmd spring-boot:run"

Write-Host "2. Khởi động Account Service (Port 8081)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend\account-service'; .\mvnw.cmd spring-boot:run"

Write-Host "3. Khởi động Learning Service (Port 8082)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend\learning-service'; .\mvnw.cmd spring-boot:run"

Write-Host "4. Khởi động Contract Service (Port 8083)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend\contract-service'; .\mvnw.cmd spring-boot:run"

Write-Host "5. Khởi động Notification Service (Port 8085)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend\notification-service'; .\mvnw.cmd spring-boot:run"

Write-Host "`nĐã bật tất cả 5 Core Backend Services!" -ForegroundColor Green
Write-Host "Để chạy Frontend: cd frontend-web && npm run dev" -ForegroundColor Cyan
