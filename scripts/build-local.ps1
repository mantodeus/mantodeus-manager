#!/usr/bin/env pwsh
# Build locally for testing (no upload)
# Then SSH to server and run: bash scripts/deploy-manual.sh

[CmdletBinding()]
param(
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🔨 Mantodeus Manager - Local Build" -ForegroundColor Cyan
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

Write-Host "`n✅ Build complete!" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "📋 Next Steps:" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. SSH to server:" -ForegroundColor White
Write-Host "   ssh mantodeus" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Navigate to app directory:" -ForegroundColor White
Write-Host "   cd /srv/customer/sites/manager.mantodeus.com" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Pull latest code:" -ForegroundColor White
Write-Host "   git pull origin main" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Run deployment script:" -ForegroundColor White
Write-Host "   bash scripts/deploy-manual.sh" -ForegroundColor Gray
Write-Host ""
Write-Host "   (This will run in background - safe to disconnect)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "5. Monitor progress (optional):" -ForegroundColor White
Write-Host "   tail -f deploy-*.log" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

