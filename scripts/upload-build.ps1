# Upload local build to server (Windows PowerShell)
# Usage: .\scripts\upload-build.ps1

$REMOTE_HOST = "mantodeus"
$APP_DIR = "/srv/customer/sites/manager.mantodeus.com"
$ARCHIVE_NAME = "dist-$(Get-Date -Format 'yyyyMMdd-HHmmss').tar.gz"

Write-Host "📦 Creating archive of dist folder..." -ForegroundColor Cyan

# Check if tar is available (Windows 10+ has tar)
if (Get-Command tar -ErrorAction SilentlyContinue) {
    tar -czf $ARCHIVE_NAME dist/
} else {
    Write-Host "❌ tar command not found. Please install tar or use 7-Zip/WinRAR to create dist.tar.gz" -ForegroundColor Red
    exit 1
}

Write-Host "📤 Uploading to server..." -ForegroundColor Cyan
scp $ARCHIVE_NAME "${REMOTE_HOST}:/tmp/"

Write-Host "🚀 Deploying on server..." -ForegroundColor Cyan
ssh $REMOTE_HOST "cd '$APP_DIR' && tar -xzf /tmp/$ARCHIVE_NAME && npx pm2 restart mantodeus-manager || npx pm2 start dist/index.js --name mantodeus-manager && rm /tmp/$ARCHIVE_NAME && echo '✅ Deployment complete!'"

Write-Host "🧹 Cleaning up local archive..." -ForegroundColor Cyan
Remove-Item $ARCHIVE_NAME

Write-Host "✅ Done! Build deployed to server." -ForegroundColor Green

