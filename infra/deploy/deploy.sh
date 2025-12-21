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

# Step 3: Install dependencies
echo "▶ Installing dependencies..."
npm install --no-audit --no-fund --include=dev --legacy-peer-deps || {
  echo "⚠️  npm install failed, cleaning and retrying..."
  rm -rf node_modules
  npm install --no-audit --no-fund --include=dev --legacy-peer-deps
}
echo "✅ Dependencies installed"
echo ""

# Step 4: Install Puppeteer browser
echo "▶ Installing Puppeteer browser..."
npx puppeteer browsers install chrome || echo "⚠️  Puppeteer browser install failed (PDF may not work)"
echo ""

# Step 5: Build
echo "▶ Building application..."
npm run build
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
npx pm2 restart "$PM2_NAME"
echo "✅ PM2 restarted"
echo ""

echo "============================================"
echo "✅ Deploy complete!"
echo "📅 Finished at: $(date)"
echo "============================================"
