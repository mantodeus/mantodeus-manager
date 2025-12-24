#!/bin/bash
# =============================================================================
# MANTODEUS MANAGER - CANONICAL DEPLOY SCRIPT
# =============================================================================
# This is the ONLY deployment mechanism for Mantodeus Manager.
# Triggered by: git push origin main → GitHub Webhook → this script
#
# Usage: bash infra/deploy/deploy.sh
# =============================================================================

set -euo pipefail

# Configuration
APP_PATH="/srv/customer/sites/manager.mantodeus.com"
PM2_NAME="mantodeus-manager"

echo "============================================"
echo "🚀 Mantodeus Manager - Production Deploy"
echo "============================================"
echo "📅 Started at: $(date)"
echo ""

# Step 1: Navigate to app directory
echo "▶ Changing to app directory..."
cd "$APP_PATH"
echo "✅ Now in: $(pwd)"
echo ""

# Step 2: Fetch latest code
echo "▶ Fetching latest code from origin/main..."
git fetch origin
git reset --hard origin/main
echo "✅ Code updated"
echo ""

# Step 3: Ensure pnpm is available
echo "▶ Checking for pnpm..."
if ! command -v pnpm &> /dev/null; then
  echo "⚠️  pnpm not found, attempting to enable via corepack..."
  if command -v corepack &> /dev/null; then
    corepack enable
    corepack prepare pnpm@10.4.1 --activate
    echo "✅ pnpm enabled via corepack"
  else
    echo "⚠️  corepack not available, installing pnpm globally..."
    npm install -g pnpm@10.4.1 || {
      echo "❌ Failed to install pnpm. Falling back to npm..."
      USE_NPM=true
    }
  fi
fi

# Step 4: Install dependencies
if [ "${USE_NPM:-false}" = "true" ] || ! command -v pnpm &> /dev/null; then
  echo "▶ Installing dependencies with npm..."
  npm install --legacy-peer-deps --no-audit --no-fund || {
    echo "⚠️  npm install failed, cleaning and retrying..."
    rm -rf node_modules
    npm install --legacy-peer-deps --no-audit --no-fund
  }
  PACKAGE_MANAGER="npm"
else
  echo "▶ Installing dependencies with pnpm..."
  pnpm install --frozen-lockfile || {
    echo "⚠️  pnpm install failed, cleaning and retrying..."
    rm -rf node_modules
    pnpm install --frozen-lockfile
  }
  PACKAGE_MANAGER="pnpm"
fi
echo "✅ Dependencies installed"
echo ""

# Step 5: Build
echo "▶ Building application..."
if [ "$PACKAGE_MANAGER" = "npm" ]; then
  npm run build
else
  pnpm build
fi
echo "✅ Build complete"
echo ""

# Step 6: Verify build
if [ ! -f "dist/index.js" ] || [ ! -d "dist/public" ]; then
  echo "❌ Build verification failed!"
  exit 1
fi
echo "✅ Build verified"
echo ""

# Step 7: Restart PM2
echo "▶ Restarting PM2 process: $PM2_NAME..."
if [ "$PACKAGE_MANAGER" = "npm" ]; then
  npx pm2 restart "$PM2_NAME"
else
  pnpm pm2 restart "$PM2_NAME"
fi
echo "✅ PM2 restarted"
echo ""

echo "============================================"
echo "✅ Deploy complete!"
echo "📅 Finished at: $(date)"
echo "============================================"
