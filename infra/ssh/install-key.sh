#!/bin/bash
#
# Mantodeus Manager - SSH Key Installation Script
# Installs the public SSH key on the remote server
#
# Usage:
#   ./install-key.sh username@hostname
#   ./install-key.sh M4S5mQQMRhu_mantodeus@57-105224.ssh.hosting-ik.com
#

set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: $0 <username@hostname>"
  echo "Example: $0 M4S5mQQMRhu_mantodeus@57-105224.ssh.hosting-ik.com"
  exit 1
fi

SERVER="$1"
KEY_NAME="mantodeus_deploy_key"
PUBLIC_KEY="$HOME/.ssh/$KEY_NAME.pub"

# Check if public key exists
if [ ! -f "$PUBLIC_KEY" ]; then
  echo "❌ Public key not found: $PUBLIC_KEY"
  echo "   Run ./generate-key.sh first to generate a key pair."
  exit 1
fi

echo "🔑 Installing SSH public key on server..."
echo "   Server: $SERVER"
echo ""

# Copy public key to server
if ssh-copy-id -i "$PUBLIC_KEY" "$SERVER"; then
  echo ""
  echo "✅ SSH key installed successfully!"
  echo ""
  echo "🧪 Testing connection..."
  if ssh -i "$HOME/.ssh/$KEY_NAME" -o ConnectTimeout=5 "$SERVER" "echo 'Connection successful!'"; then
    echo ""
    echo "✅ Connection test passed!"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Add SSH config to ~/.ssh/config (see ssh-config.example)"
    echo "   2. Test with: ssh mantodeus-server"
    echo "   3. Run deployment: ssh mantodeus-server 'cd /srv/customer/sites/manager.mantodeus.com && bash scripts/deploy.sh'"
  else
    echo ""
    echo "⚠️  Connection test failed. Please check:"
    echo "   - SSH key permissions"
    echo "   - Server SSH configuration"
    echo "   - Firewall settings"
  fi
else
  echo ""
  echo "❌ Failed to install SSH key"
  echo ""
  echo "💡 Manual installation:"
  echo "   cat $PUBLIC_KEY | ssh $SERVER 'mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'"
  exit 1
fi
