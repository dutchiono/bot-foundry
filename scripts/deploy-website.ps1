param(
    [string]$Host = 'miono',
    [string]$RemoteRoot = '/var/www/foundry/dist'
)

$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$Site = Join-Path $Root 'website'
$Staging = Join-Path $env:TEMP 'foundry-site-deploy'

if (Test-Path $Staging) { Remove-Item $Staging -Recurse -Force }
New-Item -ItemType Directory -Path $Staging | Out-Null
New-Item -ItemType Directory -Path (Join-Path $Staging 'assets') | Out-Null

Copy-Item (Join-Path $Site 'index.html') (Join-Path $Staging 'foundry.html')
Copy-Item (Join-Path $Site 'assets\*') (Join-Path $Staging 'assets') -Recurse -ErrorAction SilentlyContinue

Write-Host "Uploading to $Host:$RemoteRoot ..." -ForegroundColor Cyan
scp -r "$Staging\*" "${Host}:/tmp/foundry-site-deploy/"

ssh $Host @"
set -e
sudo mkdir -p $RemoteRoot/assets
sudo cp /tmp/foundry-site-deploy/foundry.html $RemoteRoot/foundry.html
sudo cp -r /tmp/foundry-site-deploy/assets/* $RemoteRoot/assets/ 2>/dev/null || true
sudo chown -R foundry:foundry $RemoteRoot
sudo nginx -t
sudo systemctl reload nginx
rm -rf /tmp/foundry-site-deploy
echo 'Deployed to https://foundry.bushleague.xyz'
"@

Write-Host "Done." -ForegroundColor Green
