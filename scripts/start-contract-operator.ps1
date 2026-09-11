[CmdletBinding()]
param(
    [switch]$ConfirmReconciledState
)

$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$rootEnvironmentFile = Join-Path $repositoryRoot ".env"
$contractServiceDirectory = Join-Path $repositoryRoot "backend\contract-service"
$operatorKeystore = Join-Path $env:USERPROFILE ".foundry\keystores\edu-deployer"
$operatorAddress = "0x10dd719B6a13e9d275990d706C2640ab6F1CA28e"

if (-not (Test-Path -LiteralPath $rootEnvironmentFile -PathType Leaf)) {
    throw "Missing root .env file: $rootEnvironmentFile"
}
foreach ($line in Get-Content -LiteralPath $rootEnvironmentFile) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith("#")) {
        continue
    }
    $separator = $line.IndexOf("=")
    if ($separator -le 0) {
        continue
    }
    $name = $line.Substring(0, $separator).Trim()
    $value = $line.Substring($separator + 1)
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
}

if ($env:BLOCKCHAIN_OPERATOR_ADDRESS) { $operatorAddress = $env:BLOCKCHAIN_OPERATOR_ADDRESS }
if ($env:BLOCKCHAIN_OPERATOR_KEYSTORE_PATH) { $operatorKeystore = $env:BLOCKCHAIN_OPERATOR_KEYSTORE_PATH }

$hasPrivateKey = [bool]($env:BLOCKCHAIN_OPERATOR_PRIVATE_KEY)
if (-not $hasPrivateKey -and -not (Test-Path -LiteralPath $operatorKeystore -PathType Leaf)) {
    throw "Missing operator signing credential: configure BLOCKCHAIN_OPERATOR_PRIVATE_KEY or provide keystore at $operatorKeystore"
}
$passwordPointer = [IntPtr]::Zero
try {
    if (-not $hasPrivateKey -and -not $env:BLOCKCHAIN_OPERATOR_KEYSTORE_PASSWORD -and -not $env:BLOCKCHAIN_OPERATOR_KEYSTORE_PASSWORD_FILE) {
        $securePassword = Read-Host "Operator keystore password (configure a password secret file for unattended startup)" -AsSecureString
        $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
        $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
        if ([string]::IsNullOrWhiteSpace($plainPassword)) { throw "Operator keystore password cannot be empty" }
        $env:BLOCKCHAIN_OPERATOR_KEYSTORE_PASSWORD = $plainPassword
    }

    $env:BLOCKCHAIN_ENABLED = "true"
    $env:BLOCKCHAIN_OPERATOR_ENABLED = "true"
    $env:BLOCKCHAIN_OPERATOR_ADDRESS = $operatorAddress
    $env:BLOCKCHAIN_OPERATOR_KEYSTORE_PATH = $operatorKeystore

    Write-Host "Starting Contract Service with Sepolia operator enabled."
    Write-Host "Expired confirmed proposals will be discovered and finalized automatically after startup."
    Push-Location $contractServiceDirectory
    try {
        & .\mvnw.cmd spring-boot:run
    } finally {
        Pop-Location
    }
} finally {
    $env:BLOCKCHAIN_OPERATOR_KEYSTORE_PASSWORD = $null
    $plainPassword = $null
    if ($passwordPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
}
