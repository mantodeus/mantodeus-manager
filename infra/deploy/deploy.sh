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

# Priority 1: Check if pnpm is already available
if command -v pnpm &> /dev/null; then
  PNPM_CMD="pnpm"
  PNPM_VERSION_ACTUAL=$(pnpm --version)
  echo "✅ pnpm ${PNPM_VERSION_ACTUAL} is already available"
# Priority 2: Use npx pnpm (best for shared hosting - no global install needed)
elif command -v npx &> /dev/null; then
  PNPM_CMD="npx -y pnpm@${PNPM_VERSION}"
  echo "✅ Will use npx pnpm (no global install required - shared hosting compatible)"
# Priority 3: Try corepack (may fail on shared hosting with read-only filesystem)
elif command -v corepack &> /dev/null; then
  echo "   Attempting to enable via corepack (may fail on shared hosting)..."
  # Suppress errors from corepack enable (read-only filesystem on shared hosting)
  corepack enable 2>/dev/null || true
  corepack prepare pnpm@${PNPM_VERSION} --activate 2>/dev/null || true
  
  if command -v pnpm &> /dev/null; then
    PNPM_CMD="pnpm"
    PNPM_VERSION_ACTUAL=$(pnpm --version)
    echo "✅ pnpm ${PNPM_VERSION_ACTUAL} enabled via corepack"
  else
    # Corepack failed, fall back to npx if available
    if command -v npx &> /dev/null; then
      PNPM_CMD="npx -y pnpm@${PNPM_VERSION}"
      echo "✅ Corepack unavailable, using npx pnpm instead"
    fi
  fi
# Priority 4: Try global npm install (usually fails on shared hosting)
elif command -v npm &> /dev/null; then
  echo "   Attempting to install pnpm globally (may fail on shared hosting)..."
  npm install -g pnpm@${PNPM_VERSION} 2>/dev/null || true
  
  if command -v pnpm &> /dev/null; then
    PNPM_CMD="pnpm"
    PNPM_VERSION_ACTUAL=$(pnpm --version)
    echo "✅ pnpm ${PNPM_VERSION_ACTUAL} installed globally"
  fi
fi

# Final check: ensure we have a pnpm command
if [ -z "$PNPM_CMD" ]; then
  echo "❌ Cannot find pnpm, npx, corepack, or npm. Please install Node.js."
  exit 1
fi

echo ""

# Step 3: Ensure git remote uses HTTPS (not SSH)
echo "▶ Checking git remote configuration..."
CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
if echo "$CURRENT_REMOTE" | grep -qE "git@|ssh://"; then
  echo "⚠️  Git remote uses SSH, changing to HTTPS..."
  git remote set-url origin https://github.com/mantodeus/mantodeus-manager.git
  echo "✅ Git remote updated to HTTPS"
fi
echo ""

# Step 4: Fetch latest code
echo "▶ Fetching latest code from origin/main..."
if ! git fetch origin; then
  echo "❌ Git fetch failed. Checking network connectivity..."
  if ! ping -c 1 github.com &> /dev/null; then
    echo "❌ Cannot reach github.com. Check network connection."
    exit 1
  fi
  echo "⚠️  Retrying git fetch with verbose output..."
  git fetch origin --verbose || {
    echo "❌ Git fetch failed. Possible causes:"
    echo "   - Network connectivity issues"
    echo "   - Git credentials not configured"
    echo "   - Repository access permissions"
    exit 1
  }
fi

if ! git reset --hard origin/main; then
  echo "❌ Git reset failed"
  exit 1
fi

GIT_COMMIT=$(git rev-parse --short HEAD)
echo "✅ Code updated to commit: ${GIT_COMMIT}"
echo ""

# Step 5: Install dependencies
echo "▶ Installing dependencies with pnpm..."
$PNPM_CMD install --frozen-lockfile || {
  echo "⚠️  pnpm install failed, cleaning node_modules and retrying..."
  rm -rf node_modules
  $PNPM_CMD install --frozen-lockfile
}
echo "✅ Dependencies installed"
echo ""

# Step 6: Build
echo "▶ Building application..."
$PNPM_CMD build
echo "✅ Build complete"
echo ""

# Step 7: Verify build
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

# Step 8: Restart PM2 (Infomaniak shared hosting compatible)
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
