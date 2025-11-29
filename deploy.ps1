# Auto-deployment script for Infomaniak
# This script pushes to GitHub and then deploys to the server

param(
    [string]$Message = "Auto-deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting auto-deployment..." -ForegroundColor Cyan

# Git path
$git = "C:\Users\Mantodeus\AppData\Local\GitHubDesktop\app-3.5.4\resources\app\git\cmd\git.exe"

# Change to project directory
Set-Location "C:\Users\Mantodeus\Documents\GitHub\mantodeus-manager"

# Step 1: Add all changes
Write-Host "📦 Staging changes..." -ForegroundColor Yellow
& $git add -A

# Step 2: Check if there are changes to commit
$status = & $git status --porcelain
if ($status) {
    Write-Host "💾 Committing changes..." -ForegroundColor Yellow
    & $git commit -m $Message
    
    # Step 3: Push to GitHub
    Write-Host "📤 Pushing to GitHub..." -ForegroundColor Yellow
    & $git push
    
    Write-Host "✅ Changes pushed to GitHub!" -ForegroundColor Green
} else {
    Write-Host "ℹ️  No changes to commit" -ForegroundColor Gray
}

# Step 4: Deploy to server (SSH)
Write-Host "🌐 Deploying to Infomaniak server..." -ForegroundColor Yellow
Write-Host "   (You'll need to SSH in and run: git pull && npm run build)" -ForegroundColor Gray
Write-Host ""
Write-Host "📋 Quick deploy commands:" -ForegroundColor Cyan
Write-Host "   ssh your-username@your-server" -ForegroundColor White
Write-Host "   cd /srv/customer/sites/manager.mantodeus.com" -ForegroundColor White
Write-Host "   git pull" -ForegroundColor White
Write-Host "   npm run build" -ForegroundColor White
Write-Host "   # Then restart in Infomaniak panel" -ForegroundColor Gray

Write-Host ""
Write-Host "✨ Deployment script complete!" -ForegroundColor Green

