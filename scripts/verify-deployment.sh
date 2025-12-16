#!/bin/bash

# ============================================
# VERIFY DEPLOYMENT STATUS
# ============================================
# Run this on the server to check if latest code is deployed
# ============================================

set -e

APP_PATH="${APP_PATH:-/srv/customer/sites/manager.mantodeus.com}"
cd "$APP_PATH" || exit 1

echo "============================================"
echo "🔍 Verifying Deployment Status"
echo "============================================"
echo ""

# Check 1: Git status
echo "📦 Git Status:"
echo "   Current commit:"
git log -1 --oneline
echo ""
echo "   Latest remote commit:"
git fetch origin main 2>/dev/null || true
git log origin/main -1 --oneline
echo ""

# Check 2: Code changes
echo "📝 Checking if latest code is present:"
if grep -q "insertId" server/db.ts 2>/dev/null; then
  echo "   ✅ insertId fix found in server/db.ts"
else
  echo "   ❌ insertId fix NOT found - code may not be deployed"
fi

if grep -q "Initializing database schemas" server/_core/index.ts 2>/dev/null; then
  echo "   ✅ Schema initialization fix found"
else
  echo "   ❌ Schema initialization fix NOT found"
fi
echo ""

# Check 3: Build status
echo "🔨 Build Status:"
if [ -f "dist/index.js" ]; then
  echo "   ✅ dist/index.js exists"
  echo "   Build time: $(stat -c %y dist/index.js 2>/dev/null || stat -f %Sm dist/index.js 2>/dev/null)"
else
  echo "   ❌ dist/index.js NOT found - needs build"
fi
echo ""

# Check 4: PM2/Process status
echo "🔄 Process Status:"
if command -v pm2 &> /dev/null; then
  pm2 list | grep -E "mantodeus|manager" || echo "   ⚠️  No PM2 process found"
  echo ""
  echo "   Recent PM2 logs (last 20 lines):"
  pm2 logs mantodeus-manager --lines 20 --nostream 2>/dev/null | tail -20 || echo "   (No logs available)"
else
  if [ -f "logs/production.pid" ]; then
    PID=$(cat logs/production.pid)
    if kill -0 "$PID" 2>/dev/null; then
      echo "   ✅ Server running (PID: $PID)"
    else
      echo "   ❌ Server process not running"
    fi
  else
    echo "   ⚠️  No process info found"
  fi
fi
echo ""

# Check 5: Server logs for errors
echo "📋 Recent Server Logs (errors/warnings):"
if [ -f "logs/production.log" ]; then
  echo "   Last 30 lines with errors:"
  tail -30 logs/production.log | grep -i "error\|warn\|fail" || echo "   (No errors in recent logs)"
else
  echo "   ⚠️  No log file found"
fi
echo ""

echo "============================================"
echo "✅ Verification complete"
echo "============================================"
echo ""
echo "If code is not deployed, run:"
echo "  git pull origin main"
echo "  bash infra/production/deploy-production.sh"

