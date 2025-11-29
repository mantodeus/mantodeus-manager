# Complete Build Script for Mantodeus Manager (PowerShell)
# This script ensures a clean build with all dependencies and proper output

$ErrorActionPreference = "Stop"

Write-Host "🔨 Starting complete build process for Mantodeus Manager..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Clean everything
Write-Host "📁 Step 1: Cleaning build artifacts..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
    Write-Host "✅ Removed dist directory" -ForegroundColor Green
}
if (Test-Path "node_modules\.vite") {
    Remove-Item -Recurse -Force "node_modules\.vite"
}
if (Test-Path ".vite") {
    Remove-Item -Recurse -Force ".vite"
}
Write-Host "✅ Clean complete" -ForegroundColor Green
Write-Host ""

# Step 2: Install dependencies
Write-Host "📦 Step 2: Installing dependencies..." -ForegroundColor Yellow
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    Write-Host "Using pnpm..." -ForegroundColor Gray
    pnpm install
} else {
    Write-Host "Using npm..." -ForegroundColor Gray
    npm install
}
Write-Host "✅ Dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 3: Type check
Write-Host "🔍 Step 3: Running TypeScript type check..." -ForegroundColor Yellow
npm run check
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Type check failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Type check passed" -ForegroundColor Green
Write-Host ""

# Step 4: Build frontend
Write-Host "⚛️  Step 4: Building frontend with Vite..." -ForegroundColor Yellow
npm run build:frontend
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Frontend build failed" -ForegroundColor Red
    exit 1
}

# Verify frontend output
if (-not (Test-Path "dist\public")) {
    Write-Host "❌ Frontend build failed: dist\public not found" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Frontend build complete" -ForegroundColor Green
Write-Host ""

# Step 5: Build backend
Write-Host "🔧 Step 5: Building backend with esbuild..." -ForegroundColor Yellow
npm run build:backend
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Backend build failed" -ForegroundColor Red
    exit 1
}

# Verify backend output
if (-not (Test-Path "dist\index.js")) {
    Write-Host "❌ Backend build failed: dist\index.js not found" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Backend build complete" -ForegroundColor Green
Write-Host ""

# Step 6: Verify build output
Write-Host "🔍 Step 6: Verifying build output..." -ForegroundColor Yellow
Write-Host "Frontend files:" -ForegroundColor Gray
Get-ChildItem "dist\public" | Select-Object -First 10 | Format-Table Name, Length
Write-Host ""
Write-Host "Backend file:" -ForegroundColor Gray
Get-Item "dist\index.js" | Format-Table Name, Length
Write-Host ""

# Step 7: Check file sizes
Write-Host "📊 Build Summary:" -ForegroundColor Yellow
$frontendSize = (Get-ChildItem "dist\public" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
$backendSize = (Get-Item "dist\index.js").Length / 1MB
Write-Host "Frontend size: $([math]::Round($frontendSize, 2)) MB" -ForegroundColor Gray
Write-Host "Backend size: $([math]::Round($backendSize, 2)) MB" -ForegroundColor Gray
Write-Host ""

Write-Host "✨ Build completed successfully! ✨" -ForegroundColor Green
Write-Host "📦 Output directory: dist\" -ForegroundColor Cyan
Write-Host "🚀 Start with: npm start" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Environment variables required:" -ForegroundColor Yellow
Write-Host "   - S3_ENDPOINT=https://s3.pub1.infomaniak.cloud"
Write-Host "   - S3_REGION=us-east-1"
Write-Host "   - S3_BUCKET=mantodeus-manager-files"
Write-Host "   - S3_ACCESS_KEY_ID=ba794c9e6d034ccc9ac0bb2d3aa55b1b"
Write-Host "   - S3_SECRET_ACCESS_KEY=e78e5ef0cebb462faf397ea621b1d87a"
Write-Host ""

