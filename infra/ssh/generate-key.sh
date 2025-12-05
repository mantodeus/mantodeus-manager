#!/bin/bash
################################################################################
# Generate SSH Key for Mantodeus Manager Deployment
################################################################################
# This script generates a new SSH key pair for secure deployment access
#
# Usage:
#   ./generate-key.sh [email]
#
# The script will:
# 1. Generate an ED25519 SSH key pair (more secure than RSA)
# 2. Save it to ~/.ssh/mantodeus_deploy_key
# 3. Display the public key for adding to your server
################################################################################

set -euo pipefail

# Configuration
KEY_NAME="mantodeus_deploy_key"
KEY_PATH="$HOME/.ssh/$KEY_NAME"
KEY_TYPE="ed25519"
KEY_COMMENT="${1:-mantodeus-deploy@$(hostname)}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $*"
}

# Check if key already exists
if [ -f "$KEY_PATH" ]; then
    log_warn "SSH key already exists at: $KEY_PATH"
    read -p "Do you want to overwrite it? (yes/no): " -r
    echo
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Keeping existing key. Exiting."
        exit 0
    fi
    log_warn "Backing up existing key to ${KEY_PATH}.backup"
    cp "$KEY_PATH" "${KEY_PATH}.backup"
    cp "${KEY_PATH}.pub" "${KEY_PATH}.pub.backup"
fi

# Create .ssh directory if it doesn't exist
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

log_step "Generating SSH key pair..."
log_info "Key type: $KEY_TYPE"
log_info "Key path: $KEY_PATH"
log_info "Comment: $KEY_COMMENT"

# Generate the key
ssh-keygen -t "$KEY_TYPE" \
    -f "$KEY_PATH" \
    -C "$KEY_COMMENT" \
    -N ""

# Set proper permissions
chmod 600 "$KEY_PATH"
chmod 644 "${KEY_PATH}.pub"

log_info "SSH key pair generated successfully!"
echo ""

# Display the public key
log_step "Your PUBLIC key (add this to your server):"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat "${KEY_PATH}.pub"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Instructions
log_step "Next steps:"
echo ""
echo "1. Copy the public key above"
echo ""
echo "2. Add it to your Infomaniak server:"
echo "   ${GREEN}Method A: Using ssh-copy-id (easiest)${NC}"
echo "     ssh-copy-id -i ${KEY_PATH}.pub your-username@your-server.infomaniak.com"
echo ""
echo "   ${GREEN}Method B: Manual${NC}"
echo "     ssh your-username@your-server.infomaniak.com"
echo "     mkdir -p ~/.ssh && chmod 700 ~/.ssh"
echo "     echo 'YOUR_PUBLIC_KEY_HERE' >> ~/.ssh/authorized_keys"
echo "     chmod 600 ~/.ssh/authorized_keys"
echo ""
echo "3. Test the connection:"
echo "   ssh -i ${KEY_PATH} your-username@your-server.infomaniak.com"
echo ""
echo "4. Update your SSH config:"
echo "   cp infra/ssh/ssh-config.example ~/.ssh/config"
echo "   # Edit ~/.ssh/config with your server details"
echo ""

# Save key info to JSON
KEY_INFO=$(cat <<EOF
{
  "key_name": "$KEY_NAME",
  "key_path": "$KEY_PATH",
  "key_type": "$KEY_TYPE",
  "key_comment": "$KEY_COMMENT",
  "public_key": "$(cat ${KEY_PATH}.pub)",
  "generated_at": "$(date -Iseconds)",
  "fingerprint": "$(ssh-keygen -lf ${KEY_PATH}.pub | awk '{print $2}')"
}
EOF
)

echo "$KEY_INFO" > "$HOME/.ssh/${KEY_NAME}.json"
log_info "Key information saved to: $HOME/.ssh/${KEY_NAME}.json"
echo ""

log_info "✅ Setup complete!"
