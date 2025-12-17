#!/bin/bash
#
# Mantodeus Manager - Webhook Deploy Script
# Designed to be run via nohup to survive PM2 restarts
#
# Usage: nohup bash infra/deploy/deploy.sh > deploy.log 2>&1 &
#

set -e

# Configuration
APP_PATH="/srv/customer/sites/manager.mantodeus.com"
PM2_NAME="mantodeus-manager"

echo "============================================"
echo "🚀 Mantodeus Manager - Auto Deploy"
echo "============================================"
echo "📅 Started at: $(date)"
echo ""

# Step 1: Navigate to app directory
echo "▶ Changing to app directory..."
cd "$APP_PATH"
echo "✅ Now in: $(pwd)"
echo ""

# Step 2: Fetch latest code from origin
echo "▶ Fetching latest code from origin..."
git fetch origin
echo "✅ Fetch complete"
echo ""

# Step 3: Reset to origin/main (discard local changes)
echo "▶ Resetting to origin/main..."
git reset --hard origin/main
echo "✅ Reset complete"
echo ""

# Step 4: Install dependencies
echo "▶ Installing dependencies..."
npm install --production=false --legacy-peer-deps
echo "✅ Dependencies installed"
echo ""

# Step 5: Build the application
echo "▶ Building application..."
npm run build
echo "✅ Build complete"
echo ""

# Step 6: Restart PM2 process
echo "▶ Restarting PM2 process: $PM2_NAME..."
npx pm2 restart "$PM2_NAME"
echo "✅ PM2 restarted"
echo ""

echo "============================================"
echo "✅ Deploy complete!"
echo "📅 Finished at: $(date)"
echo "============================================"
