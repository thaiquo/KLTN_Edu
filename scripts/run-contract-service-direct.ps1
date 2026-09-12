$ErrorActionPreference = "Stop"
$projectRoot = "d:\KL\khoaluan\KLTN_Edu"
$envFile = Join-Path $projectRoot ".env"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            $k = $parts[0].Trim()
            $v = $parts[1].Trim()
            [System.Environment]::SetEnvironmentVariable($k, $v, "Process")
        }
    }
}

$jar = "d:\KL\khoaluan\KLTN_Edu\backend\contract-service\target\contract-service-0.0.1-SNAPSHOT.jar"
& "C:\Program Files\Java\jdk-23\bin\java.exe" -jar $jar
