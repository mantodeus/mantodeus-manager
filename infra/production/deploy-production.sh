#!/usr/bin/env bash
# Production deployment script for manager.mantodeus.com
# This script should be run from /srv/customer/sites/manager.mantodeus.com
# It assumes the current working directory is the production repo root.

set -euo pipefail

# Script directory (for finding shared helpers)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(pwd)"
SHARED_DIR="$REPO_ROOT/infra/shared"

# Colors for output (optional, but helpful)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to output JSON status
output_status() {
  local status="$1"
  local message="$2"
  echo "{\"status\":\"$status\",\"env\":\"production\",\"message\":\"$message\"}"
}

# Function to output error and exit
error_exit() {
  local message="$1"
  output_status "error" "$message" >&2
  exit 1
}

# Verify we're in the right directory
if [ ! -f "package.json" ]; then
  error_exit "Not in project root (package.json not found). Expected: /srv/customer/sites/manager.mantodeus.com"
fi

echo "🚀 Starting production deployment..."
echo "📁 Working directory: $(pwd)"
echo ""

# Step 1: Verify branch (assume main, but don't fail if on different branch)
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
echo "📌 Current branch: $CURRENT_BRANCH"
echo ""

# Step 2: Fetch and reset to origin/main
echo "📥 Fetching latest changes..."
if ! git fetch --all --prune; then
  error_exit "Git fetch failed"
fi

echo "🔄 Resetting to origin/main..."
if ! git reset --hard origin/main; then
  error_exit "Git reset failed"
fi

# Step 3: Install dependencies
echo ""
echo "📦 Installing dependencies..."

# Use npm install with --no-audit --no-fund for shared hosting compatibility
npm install --no-audit --no-fund || error_exit "npm install failed"

# Step 4: Build the application
echo ""
echo "🔨 Building application..."

# Use the existing build script (build-debug.js is the default per package.json)
if ! npm run build; then
  error_exit "Build failed"
fi

# Verify build output
if [ ! -f "dist/index.js" ]; then
  error_exit "Build output not found: dist/index.js"
fi

if [ ! -d "dist/public" ]; then
  error_exit "Build output not found: dist/public"
fi

# Step 5: Stop existing production process and kill any process on port 3000
echo ""
echo "🛑 Stopping existing production server..."
if [ -f "$SHARED_DIR/stop-env.sh" ]; then
  bash "$SHARED_DIR/stop-env.sh" production 3000 || true
else
  # Fallback: try to find and kill process on port 3000
  if command -v lsof &> /dev/null; then
    LSOF_PID=$(lsof -ti:3000 2>/dev/null || echo "")
    if [ -n "$LSOF_PID" ]; then
      kill "$LSOF_PID" 2>/dev/null || true
      sleep 1
      kill -9 "$LSOF_PID" 2>/dev/null || true
    fi
  elif command -v fuser &> /dev/null; then
    fuser -k 3000/tcp 2>/dev/null || true
  fi
fi

# Step 6: Start the production server
echo ""
echo "▶️  Starting production server..."

export APP_ENV="production"
export PORT="3000"
export NODE_ENV="production"

if [ -f "$SHARED_DIR/run-background.sh" ]; then
  bash "$SHARED_DIR/run-background.sh" production 3000 || error_exit "Failed to start server"
else
  # Fallback: start directly with nohup
  mkdir -p logs
  nohup node dist/index.js >> logs/production.log 2>&1 &
  echo $! > logs/production.pid
fi

# Step 7: Verify server started
sleep 3
if [ -f "logs/production.pid" ]; then
  PID=$(cat logs/production.pid)
  if kill -0 "$PID" 2>/dev/null; then
    echo ""
    echo "✅ Production deployment complete!"
    echo "📊 Server PID: $PID"
    echo "📝 Logs: logs/production.log"
    output_status "ok" "Deployment complete"
    exit 0
  else
    error_exit "Server process not running after start"
  fi
else
  error_exit "PID file not created - server may not have started"
fi

