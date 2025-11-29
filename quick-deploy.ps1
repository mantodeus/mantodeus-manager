# Quick deployment script - pushes and provides SSH commands
# Run this after making changes

$git = "C:\Users\Mantodeus\AppData\Local\GitHubDesktop\app-3.5.4\resources\app\git\cmd\git.exe"
Set-Location "C:\Users\Mantodeus\Documents\GitHub\mantodeus-manager"

Write-Host "🚀 Quick Deploy" -ForegroundColor Cyan
Write-Host ""

# Add and commit
& $git add -A
$hasChanges = & $git diff --cached --quiet; $LASTEXITCODE
if ($LASTEXITCODE -ne 0) {
    & $git commit -m "Auto-deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    & $git push
    Write-Host "✅ Pushed to GitHub" -ForegroundColor Green
} else {
    Write-Host "ℹ️  No changes to push" -ForegroundColor Gray
}

Write-Host ""
Write-Host "📋 Now deploy to server (choose one):" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option 1: Use the deploy script (easiest):" -ForegroundColor Cyan
Write-Host "   ssh your-username@your-server" -ForegroundColor White
Write-Host "   cd /srv/customer/sites/manager.mantodeus.com" -ForegroundColor White
Write-Host "   bash deploy-server.sh" -ForegroundColor White
Write-Host "   # Then restart in Infomaniak panel" -ForegroundColor Gray
Write-Host ""
Write-Host "Option 2: Manual commands:" -ForegroundColor Cyan
Write-Host "   ssh your-username@your-server" -ForegroundColor White
Write-Host "   cd /srv/customer/sites/manager.mantodeus.com" -ForegroundColor White
Write-Host "   git pull" -ForegroundColor White
Write-Host "   npm run build" -ForegroundColor White
Write-Host "   # Then restart in Infomaniak panel" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  IMPORTANT: Always restart the app in Infomaniak panel after building!" -ForegroundColor Yellow

