# Watch deployment logs from Windows (requires SSH access to server)

param(
    [string]$Server = "your-server.com",
    [string]$User = "your-username",
    [string]$LogPath = "~/mantodeus-manager/deploy/deploy.log"
)

Write-Host "📡 Connecting to server to watch deployment logs..." -ForegroundColor Cyan
Write-Host "Server: $Server" -ForegroundColor Yellow
Write-Host "Log: $LogPath" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop watching" -ForegroundColor Gray
Write-Host ""

# SSH and tail the log file
ssh "$User@$Server" "tail -f $LogPath"

