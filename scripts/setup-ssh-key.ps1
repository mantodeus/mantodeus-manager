#!/usr/bin/env pwsh
# Script to copy SSH public key to remote server
# Usage: .\scripts\setup-ssh-key.ps1 [username@hostname]

param(
    [Parameter(Mandatory=$false)]
    [string]$Server = ""
)

$PublicKeyPath = "$env:USERPROFILE\.ssh\id_ed25519.pub"

if (-not (Test-Path $PublicKeyPath)) {
    Write-Host "Error: SSH public key not found at $PublicKeyPath" -ForegroundColor Red
    Write-Host "Run: ssh-keygen -t ed25519 -C 'mantodeus-manager' -f '$env:USERPROFILE\.ssh\id_ed25519' -N '""'" -ForegroundColor Yellow
    exit 1
}

$PublicKey = Get-Content $PublicKeyPath -Raw

if ([string]::IsNullOrWhiteSpace($Server)) {
    Write-Host "SSH Public Key:" -ForegroundColor Green
    Write-Host $PublicKey -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To copy this key to your server, run one of these:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1 (if ssh-copy-id is available):" -ForegroundColor Cyan
    Write-Host "  ssh-copy-id -i $PublicKeyPath username@hostname" -ForegroundColor White
    Write-Host ""
    Write-Host "Option 2 (manual - recommended for Windows):" -ForegroundColor Cyan
    Write-Host "  type $PublicKeyPath | ssh username@hostname 'cat >> ~/.ssh/authorized_keys'" -ForegroundColor White
    Write-Host ""
    Write-Host "Option 3 (manual - if Option 2 doesn't work):" -ForegroundColor Cyan
    Write-Host "  1. SSH into your server: ssh username@hostname" -ForegroundColor White
    Write-Host "  2. Run: mkdir -p ~/.ssh && chmod 700 ~/.ssh" -ForegroundColor White
    Write-Host "  3. Run: echo '$($PublicKey.Trim())' >> ~/.ssh/authorized_keys" -ForegroundColor White
    Write-Host "  4. Run: chmod 600 ~/.ssh/authorized_keys" -ForegroundColor White
    Write-Host ""
    Write-Host "After copying, test with: ssh username@hostname" -ForegroundColor Green
} else {
    Write-Host "Copying SSH key to $Server..." -ForegroundColor Green
    
    # Try using ssh-copy-id first (if available)
    $sshCopyId = Get-Command ssh-copy-id -ErrorAction SilentlyContinue
    if ($sshCopyId) {
        Write-Host "Using ssh-copy-id..." -ForegroundColor Cyan
        & ssh-copy-id -i $PublicKeyPath $Server
    } else {
        # Manual method using ssh
        Write-Host "Using manual method..." -ForegroundColor Cyan
        $PublicKeyContent = Get-Content $PublicKeyPath -Raw
        $PublicKeyContent | ssh $Server "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ SSH key copied successfully!" -ForegroundColor Green
            Write-Host "Test connection with: ssh $Server" -ForegroundColor Cyan
        } else {
            Write-Host "❌ Failed to copy SSH key. Try the manual method." -ForegroundColor Red
        }
    }
}

