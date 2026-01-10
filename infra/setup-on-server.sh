#!/bin/bash
#
# Mantodeus Manager - Server Setup Script
# Resolves merge conflicts, checks out branch, and sets up infrastructure
#
# Run this on your server:
#   cd /srv/customer/sites/manager.mantodeus.com
#   bash <(curl -s https://raw.githubusercontent.com/mantodeus/mantodeus-manager/cursor/git-repository-cleanup-and-repair-composer-1-5507/infra/setup-on-server.sh)
#   OR
#   Copy this script to the server and run: bash setup-on-server.sh
#

set -euo pipefail

PROJECT_DIR="/srv/customer/sites/manager.mantodeus.com"
BRANCH="cursor/git-repository-cleanup-and-repair-composer-1-5507"

echo "🚀 Setting up DevOps infrastructure on server..."
echo ""

# Change to project directory
cd "$PROJECT_DIR" || {
  echo "❌ Error: Project directory not found: $PROJECT_DIR"
  exit 1
}

# Check current status
echo "📊 Current git status:"
git status --short || true
echo ""

# Abort any ongoing merge
if [ -d ".git/MERGE_HEAD" ] || git diff --name-only --diff-filter=U | grep -q .; then
  echo "⚠️  Merge conflict detected. Aborting merge..."
  git merge --abort 2>/dev/null || true
  echo "✅ Merge aborted"
  echo ""
fi

# Fetch latest changes
echo "📥 Fetching latest changes from remote..."
git fetch origin || {
  echo "⚠️  Warning: Could not fetch from remote. Continuing with local checkout..."
}
echo ""

# Checkout the branch with infra directory
echo "🔀 Checking out branch: $BRANCH"
if git checkout "$BRANCH" 2>/dev/null; then
  echo "✅ Successfully checked out branch"
elif git checkout -b "$BRANCH" "origin/$BRANCH" 2>/dev/null; then
  echo "✅ Created and checked out branch from remote"
else
  echo "⚠️  Could not checkout branch. Trying to pull infra directory..."
  git pull origin "$BRANCH" || true
fi
echo ""

# Verify infra directory exists
if [ -d "infra" ]; then
  echo "✅ Infrastructure directory found!"
  ls -la infra/ | head -10
  echo ""
else
  echo "❌ Error: infra/ directory not found after checkout"
  echo "Current branch: $(git branch --show-current)"
  echo "Available branches:"
  git branch -a | head -10
  exit 1
fi

# Make scripts executable
echo "🔧 Making scripts executable..."
chmod +x infra/deploy/*.sh 2>/dev/null || true
chmod +x infra/ssh/*.sh 2>/dev/null || true
chmod +x infra/env/*.sh 2>/dev/null || true
chmod +x infra/tests/*.sh 2>/dev/null || true
echo "✅ Scripts are now executable"
echo ""

# Verify scripts
echo "🧪 Verifying infrastructure..."
if [ -f "infra/deploy/status.sh" ]; then
  echo "✅ Deployment scripts: OK"
else
  echo "❌ Deployment scripts: Missing"
fi

if [ -f "infra/ssh/ssh-check.sh" ]; then
  echo "✅ SSH scripts: OK"
else
  echo "❌ SSH scripts: Missing"
fi

if [ -f "infra/README.md" ]; then
  echo "✅ Documentation: OK"
else
  echo "❌ Documentation: Missing"
fi
echo ""

# Test status script
echo "📊 Testing status script..."
if bash infra/deploy/status.sh > /dev/null 2>&1; then
  echo "✅ Status script works!"
  echo ""
  echo "Current application status:"
  bash infra/deploy/status.sh
else
  echo "⚠️  Status script test failed (this is OK if PM2 is not running)"
fi
echo ""

echo "🎉 Infrastructure setup complete!"
echo ""
echo "📚 Next steps:"
echo "   1. Review documentation: cat infra/README.md"
echo "   2. Check status: ./infra/deploy/status.sh"
echo "   3. Deploy: bash scripts/deploy.sh"
echo ""
