#!/bin/bash
#
# Start Application and Deploy
# Starts PM2 process and runs full deployment
#

set -euo pipefail

PROJECT_DIR="/srv/customer/sites/manager.mantodeus.com"
PM2_APP_NAME="mantodeus-manager"

cd "$PROJECT_DIR" || exit 1

echo "🚀 Starting Application and Deploying"
echo "======================================"
echo ""

# Step 1: Check PM2 installation
echo "📋 Step 1: Checking PM2..."
if ! command -v pm2 > /dev/null 2>&1; then
  echo "❌ PM2 is not installed"
  echo "   Installing PM2 globally..."
  npm install -g pm2 || {
    echo "❌ Failed to install PM2"
    echo "   Please install manually: npm install -g pm2"
    exit 1
  }
fi
echo "✅ PM2 is installed: $(pm2 --version)"
echo ""

# Step 2: Check if app is already running
echo "📋 Step 2: Checking current status..."
CURRENT_STATUS=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name==\"$PM2_APP_NAME\") | .pm2_env.status" 2>/dev/null || echo "not_found")

if [ "$CURRENT_STATUS" = "online" ]; then
  echo "ℹ️  Application is already running"
  echo "   Stopping it first..."
  pm2 stop "$PM2_APP_NAME" || true
  sleep 2
elif [ "$CURRENT_STATUS" != "not_found" ]; then
  echo "ℹ️  Application exists but is not online (status: $CURRENT_STATUS)"
  echo "   Stopping it first..."
  pm2 stop "$PM2_APP_NAME" || true
  sleep 2
fi
echo ""

# Step 3: Start application with PM2
echo "📋 Step 3: Starting application with PM2..."

if [ -f "ecosystem.config.js" ]; then
  echo "   Using ecosystem.config.js..."
  pm2 start ecosystem.config.js
elif [ -f "start-server.sh" ]; then
  echo "   Using start-server.sh..."
  pm2 start start-server.sh --name "$PM2_APP_NAME" --cwd "$PROJECT_DIR"
else
  echo "   Using npm start..."
  pm2 start npm --name "$PM2_APP_NAME" -- start
fi

# Save PM2 process list
pm2 save || true

echo "✅ Application started"
echo ""

# Step 4: Wait a moment for app to start
echo "📋 Step 4: Waiting for application to start..."
sleep 5

# Step 5: Check status
echo "📋 Step 5: Checking application status..."
pm2 list
echo ""

# Step 6: Run deployment
echo "📋 Step 6: Running deployment..."
echo ""

if [ -f "infra/deploy/deploy.sh" ]; then
  echo "   Running deploy.sh..."
  bash infra/deploy/deploy.sh
else
  echo "   Deploy script not found, running manual deployment..."
  
  echo "   - Git pull..."
  git pull origin main || git pull origin cursor/git-repository-cleanup-and-repair-composer-1-5507 || true
  
  echo "   - Installing dependencies..."
  npm install --include=dev
  
  echo "   - Building..."
  npm run build
  
  echo "   - Restarting PM2..."
  pm2 restart "$PM2_APP_NAME"
fi

echo ""

# Step 7: Final status check
echo "📋 Step 7: Final status check..."
sleep 3

if [ -f "infra/deploy/status.sh" ]; then
  echo ""
  echo "Application Status:"
  bash infra/deploy/status.sh | jq '.' 2>/dev/null || bash infra/deploy/status.sh
else
  pm2 list
  pm2 logs "$PM2_APP_NAME" --lines 10 --nostream
fi

echo ""
echo "🎉 Start and deploy complete!"
echo ""
echo "📊 Useful commands:"
echo "   pm2 list                    - List all PM2 processes"
echo "   pm2 logs $PM2_APP_NAME      - View logs"
echo "   pm2 restart $PM2_APP_NAME   - Restart application"
echo "   ./infra/deploy/status.sh    - Check detailed status"
echo ""
