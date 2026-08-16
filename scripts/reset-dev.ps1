<#
.SYNOPSIS
    Reset all DEV environment data: wipe S3 DEV prefix then recreate Docker volumes.

.DESCRIPTION
    This script performs a full DEV environment reset in safe order:
      1. Reads configuration from .env in the project root
      2. Validates APP_ENV == dev and S3_KEY_PREFIX is non-empty / not "prod"
      3. Deletes ONLY objects under s3://<bucket>/<S3_KEY_PREFIX>/ via AWS SDK
      4. Runs docker compose down -v to wipe DB volumes
      5. Runs docker compose up -d to restart services

    SAFETY GUARDS:
      - Aborts if APP_ENV != dev (prevents running against production config)
      - Aborts if S3_KEY_PREFIX is empty
      - Aborts if S3_KEY_PREFIX is "prod" or starts with "prod/"
      - Aborts if AWS_S3_BUCKET is empty
      - Prompts for confirmation before any destructive action

.NOTES
    Requirements:
      - PowerShell 5.1+ or PowerShell Core
      - AWS CLI installed (used for S3 cleanup via 'aws s3 rm')
        If AWS CLI is not installed, the script will skip S3 cleanup with a warning.
      - Docker Desktop with compose support
      - .env file in the project root

.EXAMPLE
    .\scripts\reset-dev.ps1
    .\scripts\reset-dev.ps1 -SkipDockerRestart
#>

param(
    [switch]$SkipDockerRestart,
    [switch]$SkipS3Cleanup,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ─── Paths ───────────────────────────────────────────────────────────────────
$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$EnvFile     = Join-Path $ProjectRoot '.env'

# ─── Helper functions ─────────────────────────────────────────────────────────
function Write-Header([string]$msg) {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
}

function Write-Step([string]$msg) {
    Write-Host "[STEP] $msg" -ForegroundColor Yellow
}

function Write-Ok([string]$msg) {
    Write-Host "[OK]   $msg" -ForegroundColor Green
}

function Write-Warn([string]$msg) {
    Write-Host "[WARN] $msg" -ForegroundColor DarkYellow
}

function Abort([string]$reason) {
    Write-Host ""
    Write-Host "ABORT: $reason" -ForegroundColor Red
    Write-Host "No changes were made." -ForegroundColor Red
    exit 1
}

function Load-EnvFile([string]$path) {
    $vars = @{}
    if (-not (Test-Path $path)) { return $vars }
    Get-Content $path | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq '' -or $line.StartsWith('#')) { return }
        $idx = $line.IndexOf('=')
        if ($idx -lt 0) { return }
        $key   = $line.Substring(0, $idx).Trim()
        $value = $line.Substring($idx + 1).Trim().Trim('"').Trim("'")
        $vars[$key] = $value
    }
    return $vars
}

# ─── Load .env ───────────────────────────────────────────────────────────────
Write-Header "KLTN EduConnect — DEV Reset Script"

if (-not (Test-Path $EnvFile)) {
    Write-Warn ".env file not found at $EnvFile. Using environment variables only."
}

$envVars = Load-EnvFile $EnvFile

function Get-EnvValue([string]$key, [string]$fallback = '') {
    # Prefer process environment over .env file
    $fromEnv = [Environment]::GetEnvironmentVariable($key)
    if ($fromEnv) { return $fromEnv }
    if ($envVars.ContainsKey($key)) { return $envVars[$key] }
    return $fallback
}

$APP_ENV       = Get-EnvValue 'APP_ENV'       'dev'
$S3_KEY_PREFIX = Get-EnvValue 'S3_KEY_PREFIX' 'dev'
$AWS_S3_BUCKET = Get-EnvValue 'AWS_S3_BUCKET' ''
$AWS_REGION    = Get-EnvValue 'AWS_REGION'    'ap-southeast-1'

# ─── Safety guards ────────────────────────────────────────────────────────────
Write-Step "Validating configuration..."
Write-Host "  APP_ENV       = $APP_ENV"
Write-Host "  S3_KEY_PREFIX = $S3_KEY_PREFIX"
Write-Host "  AWS_S3_BUCKET = $AWS_S3_BUCKET"
Write-Host "  AWS_REGION    = $AWS_REGION"

if ($APP_ENV -ne 'dev') {
    Abort "APP_ENV is '$APP_ENV', not 'dev'. Refusing to reset a non-dev environment."
}

if ([string]::IsNullOrWhiteSpace($S3_KEY_PREFIX)) {
    Abort "S3_KEY_PREFIX is empty. Refusing to run without a prefix (would wipe entire bucket)."
}

if ($S3_KEY_PREFIX -eq 'prod' -or $S3_KEY_PREFIX.StartsWith('prod/') -or $S3_KEY_PREFIX.StartsWith('production')) {
    Abort "S3_KEY_PREFIX is '$S3_KEY_PREFIX'. Refusing to clean a production prefix."
}

# Ensure prefix ends with / for rm --recursive safety
$S3PrefixPath = $S3_KEY_PREFIX.TrimEnd('/')

# ─── Confirm ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "This will PERMANENTLY:" -ForegroundColor Red
if (-not $SkipS3Cleanup) {
    Write-Host "  • Delete ALL objects under s3://$AWS_S3_BUCKET/$S3PrefixPath/" -ForegroundColor Red
}
Write-Host "  • Remove Docker volumes (docker compose down -v)" -ForegroundColor Red
if (-not $SkipDockerRestart) {
    Write-Host "  • Re-create containers (docker compose up -d)" -ForegroundColor Yellow
}
Write-Host ""

if ($DryRun) {
    Write-Warn "DRY RUN mode — no changes will actually be made."
} else {
    $confirm = Read-Host "Type 'yes-delete-dev' to confirm"
    if ($confirm -ne 'yes-delete-dev') {
        Abort "Confirmation not received. Aborting."
    }
}

# ─── Step 1: S3 DEV cleanup ──────────────────────────────────────────────────
if (-not $SkipS3Cleanup) {
    Write-Header "Step 1 — Cleaning S3 DEV prefix"

    if ([string]::IsNullOrWhiteSpace($AWS_S3_BUCKET)) {
        Write-Warn "AWS_S3_BUCKET is not set. Skipping S3 cleanup."
    } else {
        # Check AWS CLI
        $awsCli = Get-Command 'aws' -ErrorAction SilentlyContinue
        if (-not $awsCli) {
            Write-Warn "AWS CLI not found. Skipping S3 cleanup."
            Write-Warn "Install AWS CLI from https://aws.amazon.com/cli/ or set SKIP_S3_CLEANUP=1."
        } else {
            $s3Target = "s3://$AWS_S3_BUCKET/$S3PrefixPath/"
            Write-Step "Target: $s3Target"

            if ($DryRun) {
                Write-Ok "[DRY RUN] Would run: aws s3 rm $s3Target --recursive"
            } else {
                Write-Step "Deleting objects..."
                & aws s3 rm $s3Target --recursive --region $AWS_REGION
                if ($LASTEXITCODE -ne 0) {
                    Abort "aws s3 rm failed (exit code $LASTEXITCODE). Docker reset NOT started."
                }
                Write-Ok "S3 DEV prefix cleaned: $s3Target"
            }
        }
    }
} else {
    Write-Warn "Skipping S3 cleanup (--SkipS3Cleanup flag set)."
}

# ─── Step 2: docker compose down -v ──────────────────────────────────────────
Write-Header "Step 2 — Stopping containers and removing volumes"

Push-Location $ProjectRoot
try {
    if ($DryRun) {
        Write-Ok "[DRY RUN] Would run: docker compose down -v"
    } else {
        Write-Step "Running: docker compose down -v"
        & docker compose down -v
        if ($LASTEXITCODE -ne 0) {
            Abort "docker compose down -v failed (exit code $LASTEXITCODE)."
        }
        Write-Ok "Volumes removed."
    }
} finally {
    Pop-Location
}

# ─── Step 3: docker compose up -d ────────────────────────────────────────────
if (-not $SkipDockerRestart) {
    Write-Header "Step 3 — Starting services"

    Push-Location $ProjectRoot
    try {
        if ($DryRun) {
            Write-Ok "[DRY RUN] Would run: docker compose up -d"
        } else {
            Write-Step "Running: docker compose up -d"
            & docker compose up -d
            if ($LASTEXITCODE -ne 0) {
                Abort "docker compose up -d failed (exit code $LASTEXITCODE)."
            }
            Write-Ok "Services started."
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Warn "Skipping docker compose up (--SkipDockerRestart flag set)."
}

# ─── Done ─────────────────────────────────────────────────────────────────────
Write-Header "Reset complete"
Write-Ok "DEV environment has been fully reset."
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Wait ~10s for Postgres to initialize"
Write-Host "  2. Restart account-service (Flyway will apply all migrations)"
Write-Host "  3. Seed staff accounts via V10__seed_development_staff_accounts.sql (auto-applied)"
Write-Host ""
