#!/bin/bash
# Fix ENOTEMPTY npm install errors
# Run this on the server when npm install fails with ENOTEMPTY errors

set -euo pipefail

APP_PATH="${1:-/srv/customer/sites/manager.mantodeus.com}"

echo "============================================"
echo "🔧 Fixing npm ENOTEMPTY Error"
echo "============================================"
echo ""

cd "$APP_PATH" || {
  echo "❌ Failed to change to directory: $APP_PATH"
  exit 1
}

echo "Current directory: $(pwd)"
echo ""

# Step 1: Stop any running processes that might lock files
echo "▶ Checking for running Node processes..."
if command -v pm2 &> /dev/null; then
  echo "   PM2 detected, stopping processes..."
  pm2 stop all 2>/dev/null || true
  sleep 2
fi

# Step 2: Remove node_modules with multiple strategies
echo "▶ Removing node_modules..."
if [ -d "node_modules" ]; then
  # Strategy 1: Standard removal
  echo "   Attempting standard removal..."
  rm -rf node_modules 2>/dev/null && echo "   ✅ Removed successfully" || {
    echo "   ⚠️  Standard removal failed, trying alternative methods..."
    
    # Strategy 2: Remove files first, then directories
    echo "   Removing files first..."
    find node_modules -type f -delete 2>/dev/null || true
    sleep 1
    
    echo "   Removing directories..."
    find node_modules -type d -exec rmdir {} + 2>/dev/null || true
    sleep 1
    
    # Strategy 3: Force removal
    echo "   Attempting force removal..."
    rm -rf node_modules 2>/dev/null || {
      echo "   ⚠️  Force removal failed, trying chmod + delete..."
      chmod -R u+w node_modules 2>/dev/null || true
      rm -rf node_modules 2>/dev/null || true
    }
  }
  
  # Verify removal
  if [ -d "node_modules" ]; then
    echo "   ❌ node_modules still exists. Manual intervention may be required."
    echo "   Try: sudo rm -rf node_modules (if you have sudo access)"
  else
    echo "   ✅ node_modules removed successfully"
  fi
else
  echo "   ✅ node_modules doesn't exist (already clean)"
fi
echo ""

# Step 3: Clean npm/pnpm cache
echo "▶ Cleaning package manager cache..."
if command -v pnpm &> /dev/null; then
  echo "   Cleaning pnpm cache..."
  pnpm store prune 2>/dev/null || true
elif command -v npm &> /dev/null; then
  echo "   Cleaning npm cache..."
  npm cache clean --force 2>/dev/null || true
fi
echo ""

# Step 4: Check disk space
echo "▶ Checking disk space..."
df -h . | tail -1
echo ""

# Step 5: Determine package manager
echo "▶ Detecting package manager..."
HAS_PNPM_LOCK=false
HAS_NPM_LOCK=false

if [ -f "pnpm-lock.yaml" ]; then
  HAS_PNPM_LOCK=true
fi

if [ -f "package-lock.json" ]; then
  HAS_NPM_LOCK=true
fi

# Check package.json for packageManager field
if [ -f "package.json" ] && grep -q '"packageManager".*"pnpm"' package.json; then
  echo "   ✅ package.json specifies pnpm as package manager"
  PACKAGE_MANAGER="pnpm"
  INSTALL_CMD="pnpm install --frozen-lockfile"
  
  # Warn about conflicting lock files
  if [ "$HAS_NPM_LOCK" = true ]; then
    echo "   ⚠️  WARNING: Both pnpm-lock.yaml and package-lock.json exist!"
    echo "   ⚠️  This project uses pnpm. package-lock.json should be removed."
    echo "   ⚠️  Removing package-lock.json to avoid conflicts..."
    rm -f package-lock.json
    echo "   ✅ Removed package-lock.json"
  fi
elif [ "$HAS_PNPM_LOCK" = true ]; then
  PACKAGE_MANAGER="pnpm"
  INSTALL_CMD="pnpm install --frozen-lockfile"
  echo "   ✅ Detected pnpm (pnpm-lock.yaml found)"
  
  if [ "$HAS_NPM_LOCK" = true ]; then
    echo "   ⚠️  WARNING: Both lock files exist. Removing package-lock.json..."
    rm -f package-lock.json
  fi
elif [ "$HAS_NPM_LOCK" = true ]; then
  PACKAGE_MANAGER="npm"
  INSTALL_CMD="npm ci"
  echo "   ✅ Detected npm (package-lock.json found)"
else
  PACKAGE_MANAGER="npm"
  INSTALL_CMD="npm install"
  echo "   ⚠️  No lock file found, using npm install"
fi
echo ""

# Step 6: Install dependencies
echo "▶ Installing dependencies with $PACKAGE_MANAGER..."
echo "   Command: $INSTALL_CMD"
echo ""

if $INSTALL_CMD; then
  echo "✅ Dependencies installed successfully!"
  echo ""
  echo "============================================"
  echo "✅ Fix complete!"
  echo "============================================"
else
  echo "❌ Installation failed. Additional troubleshooting:"
  echo ""
  echo "1. Check disk space: df -h ."
  echo "2. Check file permissions: ls -la | grep node_modules"
  echo "3. Try manual removal: rm -rf node_modules && $INSTALL_CMD"
  echo "4. Check for file locks: lsof | grep node_modules"
  exit 1
fi

