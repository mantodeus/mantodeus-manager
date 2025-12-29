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
ssh $SERVER @"
cd $APP_DIR
echo '==> Extracting build...'
tar -xzf /tmp/$ARCHIVE
echo '==> Restarting PM2...'
npx pm2 restart mantodeus-manager
echo '==> Cleaning up...'
rm /tmp/$ARCHIVE
echo '✅ Deployment complete!'
"@

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ All done! Build deployed successfully." -ForegroundColor Green
