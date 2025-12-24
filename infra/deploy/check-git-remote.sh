#!/bin/bash
# Check and fix git remote configuration on the server
# Run this on the server to ensure git uses HTTPS instead of SSH

echo "============================================"
echo "🔍 Checking Git Remote Configuration"
echo "============================================"
echo ""

# Check current remote URL
echo "Current git remote URLs:"
git remote -v
echo ""

# Check if any remote uses SSH
SSH_REMOTE=$(git remote -v | grep -E "git@|ssh://" || echo "")

if [ -n "$SSH_REMOTE" ]; then
  echo "⚠️  WARNING: Found SSH-based git remote!"
  echo "$SSH_REMOTE"
  echo ""
  echo "This can cause connection errors if SSH keys aren't configured."
  echo ""
  read -p "Do you want to change origin to HTTPS? (y/n) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "▶ Changing origin to HTTPS..."
    git remote set-url origin https://github.com/mantodeus/mantodeus-manager.git
    echo "✅ Origin updated to HTTPS"
    echo ""
    echo "New remote URLs:"
    git remote -v
  else
    echo "Skipped. You may need to configure SSH keys for git operations."
  fi
else
  echo "✅ All git remotes are using HTTPS (no SSH detected)"
fi

echo ""
echo "============================================"
echo "Testing git fetch..."
echo "============================================"
if git fetch origin --dry-run 2>&1 | head -5; then
  echo "✅ Git fetch test successful"
else
  echo "❌ Git fetch test failed"
  echo ""
  echo "Troubleshooting steps:"
  echo "1. Check network connectivity: ping github.com"
  echo "2. Check git credentials: git config --list | grep credential"
  echo "3. Try manual fetch: git fetch origin"
fi

echo ""

