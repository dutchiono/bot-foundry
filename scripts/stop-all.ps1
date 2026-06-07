param(
    [switch]$Reset
)

$ErrorActionPreference = 'SilentlyContinue'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path.TrimEnd('\')

Write-Host "Stopping Bot Foundry + OpenCode + hosted child bots..." -ForegroundColor Yellow

$killed = @()
Get-CimInstance Win32_Process | Where-Object {
    if (-not $_.CommandLine) { return $false }
    $_.CommandLine.Contains($Root) -or $_.CommandLine -match 'opencode.*serve'
} | ForEach-Object {
    $killed += $_.ProcessId
    Stop-Process -Id $_.ProcessId -Force
}

if ($killed.Count -gt 0) {
    Write-Host "Killed $($killed.Count) process(es): $($killed -join ', ')" -ForegroundColor Green
} else {
    Write-Host "No matching processes were running." -ForegroundColor Gray
}

if ($Reset) {
    Write-Host "Resetting local state..." -ForegroundColor Yellow

    $stateFile = Join-Path $Root '.foundry-state.json'
    if (Test-Path $stateFile) {
        Remove-Item $stateFile -Force
        Write-Host "  Removed .foundry-state.json"
    }

    $workspace = Join-Path $Root 'workspace'
    if (Test-Path $workspace) {
        Get-ChildItem $workspace -Directory -Filter 'bot-*' | ForEach-Object {
            Remove-Item $_.FullName -Recurse -Force
            Write-Host "  Removed $($_.Name)"
        }
    }

    Write-Host "Reset complete. Ready for a fresh /newbot run." -ForegroundColor Green
} else {
    Write-Host "Done. Run with -Reset to clear sessions and generated bots." -ForegroundColor Gray
}
