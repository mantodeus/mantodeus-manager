#!/bin/bash
#
# Fix Port Conflict and PM2 Duplicate Processes
# Cleans up port 3000 and restarts application properly
#

set -euo pipefail

PROJECT_DIR="/srv/customer/sites/manager.mantodeus.com"
PM2_APP_NAME="mantodeus-manager"
PM2_CMD="./node_modules/.bin/pm2"

cd "$PROJECT_DIR" || exit 1

echo "🔧 Fixing Port Conflict and PM2 Issues"
echo "======================================"
echo ""

# Step 1: Stop all PM2 processes
echo "📋 Step 1: Stopping all PM2 processes..."
$PM2_CMD stop all 2>/dev/null || true
$PM2_CMD delete all 2>/dev/null || true
echo "✅ PM2 processes stopped"
echo ""

# Step 2: Kill processes on port 3000
echo "📋 Step 2: Freeing port 3000..."

# Method 1: Using fuser
if command -v fuser > /dev/null 2>&1; then
  fuser -k 3000/tcp 2>/dev/null || true
  echo "   ✅ Used fuser to kill processes on port 3000"
fi

# Method 2: Using lsof
if command -v lsof > /dev/null 2>&1; then
  PIDS=$(lsof -ti:3000 2>/dev/null || echo "")
  if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
    echo "   ✅ Killed processes using port 3000: $PIDS"
  else
    echo "   ℹ️  No processes found on port 3000"
  fi
fi

# Method 3: Using netstat and kill
if command -v netstat > /dev/null 2>&1; then
  PIDS=$(netstat -tlnp 2>/dev/null | grep ':3000' | awk '{print $7}' | cut -d'/' -f1 | grep -v '^$' || echo "")
  if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
    echo "   ✅ Killed processes from netstat"
  fi
fi

# Wait a moment
sleep 2

# Verify port is free
if command -v lsof > /dev/null 2>&1; then
  if lsof -i:3000 > /dev/null 2>&1; then
    echo "   ⚠️  Port 3000 is still in use"
    lsof -i:3000
  else
    echo "   ✅ Port 3000 is now free"
  fi
fi
echo ""

# Step 3: Clean PM2 state
echo "📋 Step 3: Cleaning PM2 state..."
$PM2_CMD kill 2>/dev/null || true
rm -rf ~/.pm2/dump.pm2 2>/dev/null || true
echo "✅ PM2 state cleaned"
echo ""

# Step 4: Start application fresh
echo "📋 Step 4: Starting application..."
$PM2_CMD start npm --name "$PM2_APP_NAME" -- start

# Save PM2 process list
$PM2_CMD save || true

echo "✅ Application started"
echo ""

# Step 5: Wait for startup
echo "📋 Step 5: Waiting for application to start..."
sleep 5

# Step 6: Check status
echo "📋 Step 6: Checking status..."
echo ""
$PM2_CMD list
echo ""

# Step 7: Check health
echo "📋 Step 7: Checking application health..."
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

# Step 8: Show final status
if [ -f "infra/deploy/status.sh" ]; then
  echo "📋 Step 8: Detailed status:"
  bash infra/deploy/status.sh | jq '.' 2>/dev/null || bash infra/deploy/status.sh
fi

echo ""
echo "🎉 Fix complete!"
echo ""
echo "📊 Useful commands:"
echo "   $PM2_CMD list                    - List PM2 processes"
echo "   $PM2_CMD logs $PM2_APP_NAME      - View logs"
echo "   ./infra/deploy/status.sh         - Check detailed status"
echo ""
