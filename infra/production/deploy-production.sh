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

# Step 3: Install dependencies (include dev deps for build tools)
echo ""
echo "📦 Installing dependencies..."

# Use npm install with --no-audit --no-fund for shared hosting compatibility.
# We must include devDependencies because Vite/esbuild are required to build.
npm install --no-audit --no-fund --include=dev || error_exit "npm install failed"

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

# Step 5: Deployment complete - ready for Infomaniak restart
echo ""
echo "✅ Production deployment complete!"
echo ""
echo "📦 Build outputs:"
echo "   - Backend: dist/index.js"
echo "   - Frontend: dist/public/"
echo ""
echo "⚠️  IMPORTANT: Server process management is handled by Infomaniak"
echo "   This script only builds the application. To start/restart the server:"
echo ""
echo "   1. Log into Infomaniak control panel"
echo "   2. Navigate to: Node.js Application → manager.mantodeus.com"
echo "   3. Click: 'Restart Application'"
echo ""
echo "   The server will read PORT from process.env.PORT (set by Infomaniak)"
echo "   and environment variables from .env file at runtime."
echo ""
output_status "ok" "Deployment complete - restart required in Infomaniak"
exit 0

