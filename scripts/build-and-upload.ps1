#!/usr/bin/env pwsh
# Build locally, archive dist, and upload to the server.

[CmdletBinding()]
param(
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

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
tar -czf dist.tar.gz dist
if (-not (Test-Path "dist.tar.gz")) {
    throw "dist.tar.gz was not created"
}

Write-Host "`n==> Uploading build..." -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "upload-build.ps1")
