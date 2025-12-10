#!/usr/bin/env bash
# Preview deployment script for manager-preview.mantodeus.com
# This script should be run from /srv/customer/sites/manager-preview.mantodeus.com
# It assumes the current working directory is the preview repo root.

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
  echo "{\"status\":\"$status\",\"env\":\"preview\",\"message\":\"$message\"}"
}

# Function to output error and exit
error_exit() {
  local message="$1"
  output_status "error" "$message" >&2
  exit 1
}

# Verify we're in the right directory
if [ ! -f "package.json" ]; then
  error_exit "Not in project root (package.json not found). Expected: /srv/customer/sites/manager-preview.mantodeus.com"
fi

echo "🚀 Starting preview deployment..."
echo "📁 Working directory: $(pwd)"
echo ""

# Step 1: Verify branch
# Preview can use main, develop, or a preview branch
# Default to main, but allow override via PREVIEW_BRANCH env var
PREVIEW_BRANCH="${PREVIEW_BRANCH:-main}"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
echo "📌 Current branch: $CURRENT_BRANCH"
echo "📌 Target branch: $PREVIEW_BRANCH"
echo ""

# Step 2: Fetch and reset to origin/<branch>
echo "📥 Fetching latest changes..."
if ! git fetch --all --prune; then
  error_exit "Git fetch failed"
fi

echo "🔄 Resetting to origin/$PREVIEW_BRANCH..."
if ! git reset --hard "origin/$PREVIEW_BRANCH"; then
  error_exit "Git reset to origin/$PREVIEW_BRANCH failed"
fi

# Step 3: Install dependencies
echo ""
echo "📦 Installing dependencies..."

# Use npm install with --no-audit --no-fund for shared hosting compatibility
npm install --no-audit --no-fund || error_exit "npm install failed"

# Step 4: Load environment variables for build
echo ""
echo "🔐 Loading environment variables..."

# Source .env file if it exists (required for Vite build)
if [ -f ".env" ]; then
  echo "📄 Found .env file, exporting variables..."
  set -a  # automatically export all variables
  source .env
  set +a
  echo "✅ Environment variables loaded from .env"
else
  echo "⚠️  No .env file found - using system environment variables"
fi

# Verify critical VITE_ variables are set (required at build time)
if [ -z "${VITE_SUPABASE_URL:-}" ] || [ -z "${VITE_SUPABASE_ANON_KEY:-}" ]; then
  error_exit "Missing required VITE_* environment variables. Ensure .env file exists with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"
fi

# Step 5: Build the application
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

# Step 6: Stop existing preview process and kill any process on port 3001
echo ""
echo "🛑 Stopping existing preview server..."
if [ -f "$SHARED_DIR/stop-env.sh" ]; then
  bash "$SHARED_DIR/stop-env.sh" preview 3001 || true
else
  # Fallback: try to find and kill process on port 3001
  if command -v lsof &> /dev/null; then
    LSOF_PID=$(lsof -ti:3001 2>/dev/null || echo "")
    if [ -n "$LSOF_PID" ]; then
      kill "$LSOF_PID" 2>/dev/null || true
      sleep 1
      kill -9 "$LSOF_PID" 2>/dev/null || true
    fi
  elif command -v fuser &> /dev/null; then
    fuser -k 3001/tcp 2>/dev/null || true
  fi
fi

# Step 7: Start the preview server
echo ""
echo "▶️  Starting preview server..."

export APP_ENV="preview"
export PORT="3001"
export NODE_ENV="production"

if [ -f "$SHARED_DIR/run-background.sh" ]; then
  bash "$SHARED_DIR/run-background.sh" preview 3001 || error_exit "Failed to start server"
else
  # Fallback: start directly with nohup
  mkdir -p logs
  nohup node dist/index.js >> logs/preview.log 2>&1 &
  echo $! > logs/preview.pid
fi

# Step 8: Verify server started
sleep 3
if [ -f "logs/preview.pid" ]; then
  PID=$(cat logs/preview.pid)
  if kill -0 "$PID" 2>/dev/null; then
    echo ""
    echo "✅ Preview deployment complete!"
    echo "📊 Server PID: $PID"
    echo "📝 Logs: logs/preview.log"
    output_status "ok" "Deployment complete"
    exit 0
  else
    error_exit "Server process not running after start"
  fi
else
  error_exit "PID file not created - server may not have started"
fi

