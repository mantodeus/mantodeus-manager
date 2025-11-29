# File watcher that auto-deploys on file changes
# Run this script and it will watch for changes and auto-deploy

$ErrorActionPreference = "Stop"

Write-Host "👀 Watching for file changes..." -ForegroundColor Cyan
Write-Host "   Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

$git = "C:\Users\Mantodeus\AppData\Local\GitHubDesktop\app-3.5.4\resources\app\git\cmd\git.exe"
$projectPath = "C:\Users\Mantodeus\Documents\GitHub\mantodeus-manager"

# File extensions to watch
$extensions = @("*.ts", "*.tsx", "*.js", "*.jsx", "*.json", "*.css", "*.html")

# Create file system watcher
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $projectPath
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true

# Debounce timer (wait 2 seconds after last change before deploying)
$debounceTimer = $null
$lastChange = Get-Date

# Action when file changes
$action = {
    $lastChange = Get-Date
    
    # Clear existing timer
    if ($debounceTimer) {
        $debounceTimer.Dispose()
    }
    
    # Set new timer
    $script:debounceTimer = New-Object System.Timers.Timer(2000) # 2 seconds
    $script:debounceTimer.AutoReset = $false
    
    $script:debounceTimer.add_Elapsed({
        Write-Host "`n📝 Changes detected, deploying..." -ForegroundColor Yellow
        
        Set-Location $projectPath
        
        # Add, commit, push
        & $git add -A
        $status = & $git status --porcelain
        
        if ($status) {
            & $git commit -m "Auto-deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" 2>&1 | Out-Null
            & $git push 2>&1 | Out-Null
            Write-Host "✅ Deployed to GitHub!" -ForegroundColor Green
            Write-Host "   Run on server: git pull && npm run build" -ForegroundColor Gray
        }
        
        Write-Host "👀 Watching for changes...`n" -ForegroundColor Cyan
    })
    
    $script:debounceTimer.Start()
}

# Register events
Register-ObjectEvent -InputObject $watcher -EventName "Changed" -Action $action | Out-Null
Register-ObjectEvent -InputObject $watcher -EventName "Created" -Action $action | Out-Null
Register-ObjectEvent -InputObject $watcher -EventName "Deleted" -Action $action | Out-Null

# Keep script running
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    $watcher.Dispose()
    if ($debounceTimer) {
        $debounceTimer.Dispose()
    }
}

