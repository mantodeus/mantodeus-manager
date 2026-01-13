#!/usr/bin/env bash
# Quick fix script for esbuild/Vite build failures
# Run this on the server if builds are failing with esbuild errors

set -euo pipefail

APP_DIR="${1:-/srv/customer/sites/manager.mantodeus.com}"
cd "$APP_DIR"

echo "🔧 Fixing esbuild/Vite build issues..."
echo ""

# Step 1: Clear all caches
echo "📁 Step 1: Clearing all build caches..."
rm -rf node_modules/.vite .vite client/.vite dist/.vite node_modules/.cache dist 2>/dev/null || true
echo "  ✓ Caches cleared"
echo ""

# Step 2: Reinstall esbuild and vite
echo "📦 Step 2: Reinstalling esbuild and vite..."
npx pnpm add -D esbuild@^0.25.0 vite@5.4.0
echo "  ✓ Dependencies reinstalled"
echo ""

# Step 3: Verify installations
echo "🔍 Step 3: Verifying installations..."
npx esbuild --version || echo "  ⚠ esbuild check failed"
npx vite --version || echo "  ⚠ vite check failed"
echo ""

# Step 4: Try a clean build with increased memory
echo "🔨 Step 4: Attempting clean build..."
export NODE_OPTIONS=--max-old-space-size=4096
npm run build

echo ""
echo "✅ Build fix complete!"
echo "   If build still fails, check:"
echo "   1. .env file exists and has required variables"
echo "   2. Sufficient disk space: df -h"
echo "   3. Node.js version: node --version"
echo "   4. Full error logs: tail -f deploy.log"
