#!/usr/bin/env pwsh
# Upload local build to server

$ErrorActionPreference = "Stop"

$SERVER = "mantodeus"
$APP_DIR = "/srv/customer/sites/manager.mantodeus.com"
$ARCHIVE = "dist.tar.gz"

Write-Host "==> Checking for archive..." -ForegroundColor Cyan
if (-not (Test-Path $ARCHIVE)) {
    Write-Host "ERROR: $ARCHIVE not found. Run build first." -ForegroundColor Red
    exit 1
}

$size = (Get-Item $ARCHIVE).Length / 1MB
Write-Host "✅ Archive found: $([math]::Round($size, 2)) MB" -ForegroundColor Green

Write-Host "`n==> Uploading to server..." -ForegroundColor Cyan
scp $ARCHIVE "${SERVER}:/tmp/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Upload failed" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Upload complete" -ForegroundColor Green

Write-Host "`n==> Deploying on server..." -ForegroundColor Cyan

$remoteScript = @"
set -euo pipefail
cd $APP_DIR
echo '==> Extracting build...'
# Remove old dist if it exists, then extract
rm -rf dist
tar -xzf /tmp/$ARCHIVE
echo '==> Verifying dist/index.js exists...'
if [ ! -f dist/index.js ]; then
  echo 'ERROR: dist/index.js not found after extraction'
  ls -la dist/ || echo 'dist folder does not exist'
  exit 1
fi
echo '==> Restarting PM2...'
npx pm2 restart mantodeus-manager || npx pm2 start dist/index.js --name mantodeus-manager
echo '==> Cleaning up...'
rm /tmp/$ARCHIVE
echo '✅ Deployment complete!'
"@

# Normalize to LF to avoid CRLF issues on remote bash
$remoteScript = $remoteScript -replace "`r`n", "`n"

$remoteScript | ssh $SERVER 'bash -s'

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ All done! Build deployed successfully." -ForegroundColor Green
