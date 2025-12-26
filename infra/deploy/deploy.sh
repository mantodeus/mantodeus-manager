#!/bin/bash
# =============================================================================
# MANTODEUS MANAGER - CANONICAL DEPLOY SCRIPT
# =============================================================================
# This is the ONLY deployment mechanism for Mantodeus Manager.
# Triggered by: git push origin main → GitHub Webhook → this script
#
# Usage: bash infra/deploy/deploy.sh
#
# Requirements:
# - Node.js (preferably 22.x, but works with any version)
# - npm (comes with Node.js)
# - PM2 (will use npx if not globally installed)
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
cd "$APP_PATH" || {
  echo "❌ Failed to change to app directory: $APP_PATH"
  exit 1
}
echo "✅ Now in: $(pwd)"
echo ""

# Step 2: Ensure npm is available
echo "▶ Checking npm availability..."
if ! command -v npm &> /dev/null; then
  echo "❌ npm not found. Please install Node.js."
  exit 1
fi

NPM_VERSION=$(npm --version)
echo "✅ npm ${NPM_VERSION} is available"

echo ""

# Step 3: Ensure git remote uses HTTPS (not SSH)
echo "▶ Checking git remote configuration..."
CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
if echo "$CURRENT_REMOTE" | grep -qE "git@|ssh://"; then
  echo "⚠️  Git remote uses SSH, changing to HTTPS..."
  git remote set-url origin https://github.com/mantodeus/mantodeus-manager.git
  echo "✅ Git remote updated to HTTPS"
fi
echo ""

# Step 4: Fetch latest code
echo "▶ Fetching latest code from origin/main..."
if ! git fetch origin; then
  echo "❌ Git fetch failed. Checking network connectivity..."
  if ! ping -c 1 github.com &> /dev/null; then
    echo "❌ Cannot reach github.com. Check network connection."
    exit 1
  fi
  echo "⚠️  Retrying git fetch with verbose output..."
  git fetch origin --verbose || {
    echo "❌ Git fetch failed. Possible causes:"
    echo "   - Network connectivity issues"
    echo "   - Git credentials not configured"
    echo "   - Repository access permissions"
    exit 1
  }
fi

if ! git reset --hard origin/main; then
  echo "❌ Git reset failed"
  exit 1
fi

GIT_COMMIT=$(git rev-parse --short HEAD)
echo "✅ Code updated to commit: ${GIT_COMMIT}"
echo ""

# Step 5: Skip node_modules cleaning (run manually if needed: rm -rf node_modules)
# Skipping automatic cleaning makes deployments faster
# Only clean manually when switching package managers or fixing corruption

# Step 6: Install dependencies
echo "▶ Installing dependencies with pnpm..."
echo "   ⚠️  This may take 5-15 minutes."
echo "   💡 If SSH disconnects, use: bash infra/deploy/install-deps.sh"
echo ""

# Use npx pnpm (uses the version specified in package.json packageManager field)
INSTALL_CMD="npx pnpm install --frozen-lockfile"
echo "   Using 'npx pnpm install --frozen-lockfile'"

if ! $INSTALL_CMD; then
  echo "⚠️  pnpm install failed, performing deep cleanup and retrying..."

  # Deep cleanup: remove node_modules, lock files, and cache
  echo "   Removing node_modules..."
  rm -rf node_modules 2>/dev/null || {
    # Aggressive cleanup for locked files
    find node_modules -mindepth 1 -delete 2>/dev/null || true
    rm -rf node_modules 2>/dev/null || true
  }

  echo "   Clearing pnpm cache..."
  npx pnpm store prune 2>/dev/null || true

  echo "   Retrying installation..."
  if ! $INSTALL_CMD; then
    echo "❌ pnpm install failed after cleanup. Possible causes:"
    echo "   - Disk space issues (check: df -h)"
    echo "   - File permission issues (check: ls -la node_modules)"
    echo "   - Network connectivity issues"
    echo "   - Corrupted lock file (try: rm pnpm-lock.yaml && npx pnpm install)"
    exit 1
  fi
fi
echo "✅ Dependencies installed"
echo ""

# Step 7: Build
echo "▶ Building application..."
npm run build
echo "✅ Build complete"
echo ""

# Step 8: Verify build
echo "▶ Verifying build artifacts..."
if [ ! -f "dist/index.js" ]; then
  echo "❌ Build verification failed: dist/index.js not found"
  exit 1
fi

if [ ! -d "dist/public" ]; then
  echo "❌ Build verification failed: dist/public directory not found"
  exit 1
fi

echo "✅ Build verified (dist/index.js and dist/public exist)"
echo ""

# Step 9: Run database migrations
echo "▶ Running database migrations..."
echo "   This will apply any pending schema changes to the database"
echo ""

# Option 1: Apply SQL migration files (safe, tracked in git)
echo "   Attempting to apply migration files from drizzle/ folder..."
if npm run db:migrate:prod 2>/dev/null; then
  echo "✅ Database migrations completed"
else
  echo "⚠️  Migration files failed or none found"
  echo ""

  # Option 2: Push schema directly (auto-sync, no migration files needed)
  echo "   Falling back to schema push (auto-sync mode)..."
  echo "   ⚠️  This will sync schema directly without migration files"

  if npm run db:push-direct; then
    echo "✅ Database schema synced successfully"
  else
    echo "❌ Schema push failed"
    echo "   Database schema may be out of sync with code"
    echo "   Manual fix needed: npm run db:push-direct"
  fi
fi
echo ""

# Step 10: Start/Restart PM2 (Infomaniak shared hosting compatible)
echo "▶ Starting/Restarting PM2 process: $PM2_NAME..."
PM2_CMD=""

if command -v pm2 &> /dev/null; then
  PM2_CMD="pm2"
elif command -v npx &> /dev/null; then
  PM2_CMD="npx pm2"
else
  echo "❌ pm2 not found and npx is not available"
  exit 1
fi

# Check if process exists
if $PM2_CMD list | grep -q "$PM2_NAME"; then
  # Process exists, restart it
  echo "   Process exists, restarting..."
  $PM2_CMD restart "$PM2_NAME" || {
    echo "❌ PM2 restart failed"
    exit 1
  }
  echo "✅ PM2 restarted"
else
  # Process doesn't exist, start it
  echo "   Process not found, starting for the first time..."

  # Create logs directory if it doesn't exist (required by ecosystem.config.js)
  mkdir -p logs

  # Start directly with script path (ecosystem.config.js has issues on some hosts)
  echo "   Starting with: dist/index.js"
  $PM2_CMD start dist/index.js --name "$PM2_NAME" || {
    echo "❌ PM2 start failed"
    exit 1
  }

  echo "✅ PM2 started"

  # Save PM2 process list
  $PM2_CMD save 2>/dev/null || true
fi
echo ""

echo "============================================"
echo "✅ Deploy complete!"
echo "📅 Finished at: $(date)"
echo "📦 Commit: ${GIT_COMMIT}"
echo "============================================"
