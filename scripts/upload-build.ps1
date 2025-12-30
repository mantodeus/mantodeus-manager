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

Write-Host "`n==> Testing SSH connection..." -ForegroundColor Cyan
$testOutput = ssh $SERVER 'echo "SSH connection test successful"' 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  WARNING: SSH connection test failed" -ForegroundColor Yellow
    Write-Host "   Output: $testOutput" -ForegroundColor Gray
    Write-Host "   Continuing anyway..." -ForegroundColor Yellow
} else {
    Write-Host "✅ SSH connection OK" -ForegroundColor Green
}

Write-Host "`n==> Deploying on server..." -ForegroundColor Cyan

$remoteScript = @"
set -euo pipefail
set -x

echo '==> Starting deployment...'
echo '==> Current directory: $(pwd)'
echo '==> Target app directory: $APP_DIR'

# Change to app directory
if ! cd $APP_DIR; then
  echo 'ERROR: Failed to change to app directory: $APP_DIR'
  exit 1
fi

echo '==> Current directory after cd: $(pwd)'
echo '==> Checking if archive exists...'
if [ ! -f /tmp/$ARCHIVE ]; then
  echo 'ERROR: Archive not found at /tmp/$ARCHIVE'
  ls -la /tmp/ | grep -i dist || echo 'No dist files in /tmp'
  exit 1
fi

echo '==> Archive found, checking size...'
ls -lh /tmp/$ARCHIVE

echo '==> Removing old dist folder...'
rm -rf dist || echo 'No old dist folder to remove'

echo '==> Extracting build...'
if ! tar -xzf /tmp/$ARCHIVE; then
  echo 'ERROR: tar extraction failed'
  echo 'Archive contents:'
  tar -tzf /tmp/$ARCHIVE | head -20
  exit 1
fi

echo '==> Verifying extraction...'
if [ ! -d dist ]; then
  echo 'ERROR: dist directory not found after extraction'
  echo 'Current directory contents:'
  ls -la
  exit 1
fi

echo '==> Verifying dist/index.js exists...'
if [ ! -f dist/index.js ]; then
  echo 'ERROR: dist/index.js not found after extraction'
  echo 'dist folder contents:'
  ls -la dist/ || echo 'dist folder does not exist'
  echo 'Looking for index.js:'
  find dist -name 'index.js' -type f || echo 'No index.js found'
  exit 1
fi

echo '==> Build extracted successfully'
echo '==> Checking PM2 status...'
npx pm2 list || echo 'PM2 list failed (may not be running)'

echo '==> Restarting PM2...'
if npx pm2 restart mantodeus-manager 2>&1; then
  echo '==> PM2 restart ok'
else
  echo '==> PM2 restart failed, attempting fresh start...'
  if npx pm2 start dist/index.js --name mantodeus-manager 2>&1; then
    echo '==> PM2 started successfully'
    npx pm2 save || echo 'PM2 save failed (non-critical)'
  else
    echo 'ERROR: PM2 start failed'
    exit 1
  fi
fi

echo '==> Cleaning up archive...'
rm /tmp/$ARCHIVE || echo 'WARN: Failed to remove archive (non-critical)'

echo '✅ Deployment complete!'
"@

# Normalize to LF to avoid CRLF issues on remote bash
$remoteScript = $remoteScript -replace "`r`n", "`n"

$deployLog = Join-Path $PWD "deploy-upload.log"
$remoteScriptFile = "/tmp/deploy-$(Get-Date -Format 'yyyyMMdd-HHmmss').sh"

Write-Host "   Logging to: $deployLog" -ForegroundColor Gray
Write-Host "   Creating remote script: $remoteScriptFile" -ForegroundColor Gray

# Write script to local temp file first
$localScriptFile = Join-Path $env:TEMP "deploy-$(Get-Date -Format 'yyyyMMdd-HHmmss').sh"
$remoteScript | Out-File -FilePath $localScriptFile -Encoding utf8 -NoNewline

# Upload script to server
Write-Host "   Uploading deployment script..." -ForegroundColor Gray
scp $localScriptFile "${SERVER}:${remoteScriptFile}" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERROR: Failed to upload deployment script" -ForegroundColor Red
    Remove-Item $localScriptFile -ErrorAction SilentlyContinue
    exit 1
}

# Create empty log file first to ensure it exists
New-Item -Path $deployLog -ItemType File -Force | Out-Null

# Execute script on server and capture output
Write-Host "   Executing deployment script..." -ForegroundColor Gray
$sshCommand = "chmod +x $remoteScriptFile && bash $remoteScriptFile && rm -f $remoteScriptFile"
$output = ssh $SERVER $sshCommand 2>&1 | Tee-Object -FilePath $deployLog
$sshExitCode = $LASTEXITCODE

# Clean up local script file
Remove-Item $localScriptFile -ErrorAction SilentlyContinue

# Write output to console
$output | ForEach-Object { Write-Host $_ }

if ($sshExitCode -ne 0) {
    Write-Host "`n❌ ERROR: Deployment failed (exit code: $sshExitCode)" -ForegroundColor Red
    Write-Host "   Check the log file for details: $deployLog" -ForegroundColor Yellow
    
    if (Test-Path $deployLog) {
        $logContent = Get-Content $deployLog -ErrorAction SilentlyContinue
        if ($logContent) {
            Write-Host "   Last 30 lines of log:" -ForegroundColor Yellow
            $logContent | Select-Object -Last 30 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
        } else {
            Write-Host "   Log file is empty - SSH connection may have failed" -ForegroundColor Yellow
            Write-Host "   Try running manually: ssh $SERVER 'cd $APP_DIR && ls -la'" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   Log file was not created - SSH command may have failed before execution" -ForegroundColor Yellow
        Write-Host "   Try testing SSH connection: ssh $SERVER 'echo test'" -ForegroundColor Yellow
    }
    exit 1
}

Write-Host "`n✅ All done! Build deployed successfully." -ForegroundColor Green
