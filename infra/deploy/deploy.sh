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
# - Node.js (preferably 22.x with corepack, but works with any version)
# - pnpm 10.4.1 (will be set up automatically)
# - PM2 (will use npx if not globally installed)
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

# Step 2: Ensure pnpm is available (Infomaniak shared hosting compatible)
echo "▶ Ensuring pnpm is available..."
PNPM_CMD=""

if command -v pnpm &> /dev/null; then
  # pnpm is already available
  PNPM_CMD="pnpm"
  PNPM_VERSION_ACTUAL=$(pnpm --version)
  echo "✅ pnpm ${PNPM_VERSION_ACTUAL} is already available"
elif command -v corepack &> /dev/null; then
  # Try to enable via corepack (Node.js 16.10+)
  echo "   pnpm not found, enabling via corepack..."
  corepack enable || true
  corepack prepare pnpm@${PNPM_VERSION} --activate || true
  
  if command -v pnpm &> /dev/null; then
    PNPM_CMD="pnpm"
    PNPM_VERSION_ACTUAL=$(pnpm --version)
    echo "✅ pnpm ${PNPM_VERSION_ACTUAL} enabled via corepack"
  fi
fi

# If still not available, try installing globally (may fail on shared hosting)
if [ -z "$PNPM_CMD" ] && command -v npm &> /dev/null; then
  echo "   Attempting to install pnpm globally..."
  npm install -g pnpm@${PNPM_VERSION} 2>/dev/null || true
  
  if command -v pnpm &> /dev/null; then
    PNPM_CMD="pnpm"
    PNPM_VERSION_ACTUAL=$(pnpm --version)
    echo "✅ pnpm ${PNPM_VERSION_ACTUAL} installed globally"
  fi
fi

# Final fallback: use npx pnpm (works without global install)
if [ -z "$PNPM_CMD" ]; then
  if command -v npx &> /dev/null; then
    PNPM_CMD="npx -y pnpm@${PNPM_VERSION}"
    echo "✅ Will use npx pnpm (no global install required)"
  else
    echo "❌ Cannot find pnpm, corepack, npm, or npx. Please install Node.js."
    exit 1
  fi
fi

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
$PNPM_CMD install --frozen-lockfile || {
  echo "⚠️  pnpm install failed, cleaning node_modules and retrying..."
  rm -rf node_modules
  $PNPM_CMD install --frozen-lockfile
}
echo "✅ Dependencies installed"
echo ""

# Step 5: Build
echo "▶ Building application..."
$PNPM_CMD build
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

# Step 7: Restart PM2 (Infomaniak shared hosting compatible)
echo "▶ Restarting PM2 process: $PM2_NAME..."
PM2_CMD=""

if command -v pm2 &> /dev/null; then
  PM2_CMD="pm2"
elif command -v npx &> /dev/null; then
  PM2_CMD="npx pm2"
else
  echo "❌ pm2 not found and npx is not available"
  exit 1
fi

$PM2_CMD restart "$PM2_NAME" || {
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
