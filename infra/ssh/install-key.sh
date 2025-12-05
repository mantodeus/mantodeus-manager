#!/bin/bash
################################################################################
# Install SSH Key on Remote Server
################################################################################
# This script installs your SSH public key on the Infomaniak server
#
# Usage:
#   ./install-key.sh <username@hostname>
#
# Example:
#   ./install-key.sh myuser@manager.mantodeus.com
################################################################################

set -euo pipefail

# Configuration
KEY_NAME="mantodeus_deploy_key"
KEY_PATH="$HOME/.ssh/$KEY_NAME"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

# Check arguments
if [ $# -eq 0 ]; then
    log_error "Usage: $0 <username@hostname>"
    log_error "Example: $0 myuser@manager.mantodeus.com"
    exit 1
fi

SERVER="$1"

# Check if key exists
if [ ! -f "${KEY_PATH}.pub" ]; then
    log_error "SSH public key not found at: ${KEY_PATH}.pub"
    log_error "Run ./generate-key.sh first to create a key"
    exit 1
fi

log_info "Installing SSH key on: $SERVER"
log_info "Using key: ${KEY_PATH}.pub"
echo ""

# Try ssh-copy-id first (easiest method)
if command -v ssh-copy-id &> /dev/null; then
    log_info "Using ssh-copy-id to install key..."
    
    if ssh-copy-id -i "${KEY_PATH}.pub" "$SERVER"; then
        log_info "✅ Key installed successfully!"
        echo ""
        log_info "Testing connection..."
        
        if ssh -i "$KEY_PATH" -o BatchMode=yes -o ConnectTimeout=5 "$SERVER" "echo 'Connection successful!'" 2>/dev/null; then
            log_info "✅ SSH connection test successful!"
            echo ""
            log_info "You can now connect with:"
            echo "  ssh -i $KEY_PATH $SERVER"
            echo ""
            log_info "Or configure SSH config and use:"
            echo "  ssh mantodeus-server"
        else
            log_warn "Key installed but connection test failed"
            log_warn "You may need to check server configuration"
        fi
        
        exit 0
    else
        log_error "ssh-copy-id failed"
        echo ""
    fi
fi

# Manual method
log_warn "ssh-copy-id not available or failed, using manual method..."
echo ""
log_info "This will:"
log_info "1. Connect to the server"
log_info "2. Create ~/.ssh directory if needed"
log_info "3. Add your public key to ~/.ssh/authorized_keys"
echo ""

PUBLIC_KEY=$(cat "${KEY_PATH}.pub")

ssh "$SERVER" bash <<EOF
set -e
mkdir -p ~/.ssh
chmod 700 ~/.ssh
touch ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Check if key already exists
if grep -q "$PUBLIC_KEY" ~/.ssh/authorized_keys 2>/dev/null; then
    echo "Key already exists in authorized_keys"
else
    echo "$PUBLIC_KEY" >> ~/.ssh/authorized_keys
    echo "Key added to authorized_keys"
fi

echo "Setup complete!"
EOF

if [ $? -eq 0 ]; then
    log_info "✅ Key installed successfully!"
    echo ""
    log_info "Testing connection..."
    
    if ssh -i "$KEY_PATH" -o BatchMode=yes -o ConnectTimeout=5 "$SERVER" "echo 'Connection successful!'" 2>/dev/null; then
        log_info "✅ SSH connection test successful!"
    else
        log_warn "Connection test failed, but key may still be installed"
    fi
else
    log_error "Installation failed"
    exit 1
fi

echo ""
log_info "Next steps:"
echo "1. Update your SSH config:"
echo "   cp infra/ssh/ssh-config.example ~/.ssh/config"
echo "   # Edit ~/.ssh/config with your server details"
echo ""
echo "2. Test with:"
echo "   ssh mantodeus-server"
