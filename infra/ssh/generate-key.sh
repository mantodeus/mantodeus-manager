#!/bin/bash
#
# Mantodeus Manager - SSH Key Generation Script
# Generates a secure ED25519 SSH key pair for deployment
#
# Usage:
#   ./generate-key.sh your-email@example.com
#

set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: $0 <email-address>"
  echo "Example: $0 mckay@mantodeus.com"
  exit 1
fi

EMAIL="$1"
KEY_NAME="mantodeus_deploy_key"
KEY_PATH="$HOME/.ssh/$KEY_NAME"

# Check if key already exists
if [ -f "$KEY_PATH" ]; then
  echo "⚠️  SSH key already exists at: $KEY_PATH"
  read -p "Do you want to overwrite it? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
  rm -f "$KEY_PATH" "$KEY_PATH.pub"
fi

# Generate ED25519 key
echo "🔑 Generating ED25519 SSH key pair..."
ssh-keygen -t ed25519 -C "$EMAIL" -f "$KEY_PATH" -N ""

# Set proper permissions
chmod 600 "$KEY_PATH"
chmod 644 "$KEY_PATH.pub"

echo ""
echo "✅ SSH key pair generated successfully!"
echo ""
echo "📁 Private key: $KEY_PATH"
echo "📁 Public key:  $KEY_PATH.pub"
echo ""
echo "🔐 Next steps:"
echo "   1. Run: ./install-key.sh M4S5mQQMRhu_mantodeus@57-105224.ssh.hosting-ik.com"
echo "   2. Or manually copy the public key to the server:"
echo "      cat $KEY_PATH.pub | ssh M4S5mQQMRhu_mantodeus@57-105224.ssh.hosting-ik.com 'cat >> ~/.ssh/authorized_keys'"
echo ""
