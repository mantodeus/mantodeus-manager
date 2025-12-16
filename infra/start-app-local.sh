#!/bin/bash
#
# Start Application (Local PM2 Installation)
# Installs PM2 locally and starts the application
#

set -euo pipefail

PROJECT_DIR="/srv/customer/sites/manager.mantodeus.com"
PM2_APP_NAME="mantodeus-manager"

cd "$PROJECT_DIR" || exit 1

echo "🚀 Starting Application"
echo "======================"
echo ""

# Step 1: Install PM2 locally (if not already installed)
echo "📋 Step 1: Checking PM2 installation..."

# Check if PM2 is available globally
if command -v pm2 > /dev/null 2>&1; then
  echo "✅ PM2 is already installed: $(pm2 --version)"
  PM2_CMD="pm2"
else
  # Check if PM2 is installed locally
  if [ -f "node_modules/.bin/pm2" ]; then
    echo "✅ PM2 is installed locally"
    PM2_CMD="./node_modules/.bin/pm2"
  else
    echo "📦 Installing PM2 locally..."
    npm install pm2 --save-dev || {
      echo "❌ Failed to install PM2"
      echo "   Trying alternative: use a global PM2 install or a different process manager"
      exit 1
    }
    PM2_CMD="./node_modules/.bin/pm2"
    echo "✅ PM2 installed locally"
  fi
fi
echo ""

# Step 2: Check if app is already running
echo "📋 Step 2: Checking current status..."
CURRENT_STATUS=$($PM2_CMD jlist 2>/dev/null | jq -r ".[] | select(.name==\"$PM2_APP_NAME\") | .pm2_env.status" 2>/dev/null || echo "not_found")

if [ "$CURRENT_STATUS" = "online" ]; then
  echo "ℹ️  Application is already running"
  echo "   Stopping it first..."
  $PM2_CMD stop "$PM2_APP_NAME" || true
  sleep 2
elif [ "$CURRENT_STATUS" != "not_found" ]; then
  echo "ℹ️  Application exists but is not online (status: $CURRENT_STATUS)"
  echo "   Stopping it first..."
  $PM2_CMD stop "$PM2_APP_NAME" || true
  sleep 2
fi
echo ""

# Step 3: Start application with PM2
echo "📋 Step 3: Starting application..."

if [ -f "ecosystem.config.js" ]; then
  echo "   Using ecosystem.config.js..."
  $PM2_CMD start ecosystem.config.js
elif [ -f "start-server.sh" ]; then
  echo "   Using start-server.sh..."
  $PM2_CMD start start-server.sh --name "$PM2_APP_NAME" --cwd "$PROJECT_DIR"
else
  echo "   Using npm start..."
  $PM2_CMD start npm --name "$PM2_APP_NAME" -- start
fi

# Save PM2 process list
$PM2_CMD save || true

echo "✅ Application started"
echo ""

# Step 4: Wait for app to start
echo "📋 Step 4: Waiting for application to start..."
sleep 5

# Step 5: Check status
echo "📋 Step 5: Application status:"
$PM2_CMD list
echo ""

# Step 6: Check health
echo "📋 Step 6: Checking application health..."
if command -v curl > /dev/null 2>&1; then
  if curl -sf "http://localhost:3000/api/trpc/system.health?input=%7B%22timestamp%22%3A$(date +%s)%7D" > /dev/null 2>&1; then
    echo "✅ Application is healthy and responding!"
  else
    echo "⚠️  Application started but health check failed"
    echo "   Check logs: $PM2_CMD logs $PM2_APP_NAME"
  fi
else
  echo "ℹ️  curl not available - cannot check health"
fi
echo ""

echo "🎉 Application started!"
echo ""
echo "📊 Useful commands:"
echo "   $PM2_CMD list                    - List all PM2 processes"
echo "   $PM2_CMD logs $PM2_APP_NAME      - View logs"
echo "   $PM2_CMD restart $PM2_APP_NAME   - Restart application"
echo "   ./infra/deploy/status.sh         - Check detailed status"
echo ""
