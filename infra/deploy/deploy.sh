#!/bin/bash
# =============================================================================
# MANTODEUS MANAGER - CANONICAL DEPLOY SCRIPT
# =============================================================================
# This is the ONLY deployment mechanism for Mantodeus Manager.
# Triggered by: git push origin main → GitHub Webhook → this script
#
# Usage: bash infra/deploy/deploy.sh
#
# Requirements:
# - Node.js 22.x (includes corepack)
# - pnpm 10.4.1 (enabled via corepack)
# - PM2 installed globally
# =============================================================================

set -euo pipefail

# Configuration
APP_PATH="/srv/customer/sites/manager.mantodeus.com"
PM2_NAME="mantodeus-manager"
PNPM_VERSION="10.4.1"

echo "============================================"
echo "🚀 Mantodeus Manager - Production Deploy"
echo "============================================"
echo "📅 Started at: $(date)"
echo ""

# Step 1: Navigate to app directory
echo "▶ Changing to app directory..."
cd "$APP_PATH" || {
  echo "❌ Failed to change to app directory: $APP_PATH"
  exit 1
}
echo "✅ Now in: $(pwd)"
echo ""

# Step 2: Ensure pnpm is available via corepack
echo "▶ Ensuring pnpm is available..."
if ! command -v pnpm &> /dev/null; then
  echo "   pnpm not found, enabling via corepack..."
  if ! command -v corepack &> /dev/null; then
    echo "❌ corepack not found. Node.js 22.x is required."
    exit 1
  fi
  corepack enable
  corepack prepare pnpm@${PNPM_VERSION} --activate
fi

# Verify pnpm is available
if ! command -v pnpm &> /dev/null; then
  echo "❌ pnpm is still not available after corepack setup"
  exit 1
fi

PNPM_VERSION_ACTUAL=$(pnpm --version)
echo "✅ pnpm ${PNPM_VERSION_ACTUAL} is available"
echo ""

# Step 3: Fetch latest code
echo "▶ Fetching latest code from origin/main..."
git fetch origin
git reset --hard origin/main
GIT_COMMIT=$(git rev-parse --short HEAD)
echo "✅ Code updated to commit: ${GIT_COMMIT}"
echo ""

# Step 4: Install dependencies
echo "▶ Installing dependencies with pnpm..."
pnpm install --frozen-lockfile || {
  echo "⚠️  pnpm install failed, cleaning node_modules and retrying..."
  rm -rf node_modules
  pnpm install --frozen-lockfile
}
echo "✅ Dependencies installed"
echo ""

# Step 5: Build
echo "▶ Building application..."
pnpm build
echo "✅ Build complete"
echo ""

# Step 6: Verify build
echo "▶ Verifying build artifacts..."
if [ ! -f "dist/index.js" ]; then
  echo "❌ Build verification failed: dist/index.js not found"
  exit 1
fi

if [ ! -d "dist/public" ]; then
  echo "❌ Build verification failed: dist/public directory not found"
  exit 1
fi

echo "✅ Build verified (dist/index.js and dist/public exist)"
echo ""

# Step 7: Restart PM2
echo "▶ Restarting PM2 process: $PM2_NAME..."
if ! command -v pm2 &> /dev/null; then
  echo "❌ pm2 not found. Install with: npm install -g pm2"
  exit 1
fi

pm2 restart "$PM2_NAME" || {
  echo "❌ PM2 restart failed"
  exit 1
}
echo "✅ PM2 restarted"
echo ""

echo "============================================"
echo "✅ Deploy complete!"
echo "📅 Finished at: $(date)"
echo "📦 Commit: ${GIT_COMMIT}"
echo "============================================"
