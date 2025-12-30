#!/usr/bin/env pwsh
# Build locally, archive dist, upload to server for manual deploy.

[CmdletBinding()]
param(
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$SERVER = "mantodeus"
$APP_DIR = "/srv/customer/sites/manager.mantodeus.com"
$ARCHIVE = "dist.tar.gz"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Mantodeus Manager - Local Build" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not $SkipInstall) {
    Write-Host "==> Installing dependencies..." -ForegroundColor Cyan
    npx pnpm install --no-frozen-lockfile
    if ($LASTEXITCODE -ne 0) {
        throw "Dependency install failed"
    }
} else {
    Write-Host "==> Skipping dependency install" -ForegroundColor Yellow
}

Write-Host "`n==> Building project..." -ForegroundColor Cyan
npx pnpm run build
if ($LASTEXITCODE -ne 0) {
    throw "Build failed"
}

if (-not (Test-Path "dist")) {
    throw "dist folder not found after build"
}

Write-Host "`n==> Creating archive..." -ForegroundColor Cyan
tar -czf $ARCHIVE dist
if (-not (Test-Path $ARCHIVE)) {
    throw "$ARCHIVE was not created"
}

Write-Host "`n==> Uploading archive to server..." -ForegroundColor Cyan
scp $ARCHIVE "${SERVER}:/tmp/"
if ($LASTEXITCODE -ne 0) {
    throw "Upload failed"
}

Write-Host "`nBuild complete and archive uploaded." -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next Steps" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. SSH to server:" -ForegroundColor White
Write-Host "   ssh mantodeus" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Deploy manually:" -ForegroundColor White
Write-Host "   cd $APP_DIR" -ForegroundColor Gray
Write-Host "   rm -rf dist" -ForegroundColor Gray
Write-Host "   tar -xzf /tmp/$ARCHIVE" -ForegroundColor Gray
Write-Host "   npx pm2 restart mantodeus-manager --update-env || npx pm2 start dist/index.js --name mantodeus-manager" -ForegroundColor Gray
Write-Host "   rm /tmp/$ARCHIVE" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
