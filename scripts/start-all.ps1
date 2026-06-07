$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $Root

# Stale shell BOT_TOKEN overrides .env and causes 401/409 issues
Remove-Item Env:BOT_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:TELEGRAM_BOT_TOKEN -ErrorAction SilentlyContinue

function Test-OpenCodeHealth {
    try {
        $r = Invoke-WebRequest -Uri 'http://127.0.0.1:4096/global/health' -UseBasicParsing -TimeoutSec 2
        return $r.StatusCode -eq 200
    } catch {
        return $false
    }
}

if (-not (Test-OpenCodeHealth)) {
    Write-Host "Starting OpenCode on port 4096..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList @(
        '-NoExit',
        '-Command',
        "Set-Location '$Root'; Write-Host 'OpenCode server' -ForegroundColor Cyan; opencode serve --port 4096"
    ) | Out-Null

    $ready = $false
    for ($i = 0; $i -lt 45; $i++) {
        if (Test-OpenCodeHealth) {
            $ready = $true
            break
        }
        Start-Sleep -Seconds 1
    }

    if (-not $ready) {
        Write-Host "OpenCode did not become healthy in time. Check the OpenCode window for errors." -ForegroundColor Red
        exit 1
    }
    Write-Host "OpenCode is ready." -ForegroundColor Green
} else {
    Write-Host "OpenCode already running on port 4096." -ForegroundColor Green
}

Write-Host "Starting Bot Foundry..." -ForegroundColor Cyan
npm run dev
