#!/bin/bash
# Install dependencies in a way that survives SSH disconnection
# Usage: bash infra/deploy/install-deps.sh

set -euo pipefail

APP_PATH="${1:-/srv/customer/sites/manager.mantodeus.com}"

echo "============================================"
echo "📦 Installing Dependencies (SSH-Safe)"
echo "============================================"
echo "📅 Started at: $(date)"
echo ""

cd "$APP_PATH" || {
  echo "❌ Failed to change to directory: $APP_PATH"
  exit 1
}

echo "Current directory: $(pwd)"
echo ""

# Check for running Node processes that might lock files
echo "▶ Checking for running processes..."
if command -v pm2 &> /dev/null; then
  echo "   Stopping PM2 processes to release file locks..."
  pm2 stop all 2>/dev/null || true
  sleep 2
fi
echo ""

# Clean node_modules if it exists
if [ -d "node_modules" ]; then
  echo "▶ Cleaning existing node_modules..."
  rm -rf node_modules 2>/dev/null || {
    echo "   ⚠️  Standard removal failed, trying alternative methods..."
    find node_modules -type f -delete 2>/dev/null || true
    find node_modules -type d -exec rmdir {} + 2>/dev/null || true
    rm -rf node_modules 2>/dev/null || true
  }
  echo "✅ node_modules cleaned"
  echo ""
fi

# Remove conflicting lock files
if [ -f "pnpm-lock.yaml" ] && [ -f "package-lock.json" ]; then
  echo "▶ Removing conflicting pnpm-lock.yaml (project uses npm)..."
  rm -f pnpm-lock.yaml
  echo "✅ Removed pnpm-lock.yaml"
  echo ""
fi

# Determine install command
if [ -f "package-lock.json" ]; then
  INSTALL_CMD="npm ci"
  echo "▶ Will use: npm ci (package-lock.json found)"
else
  INSTALL_CMD="npm install"
  echo "▶ Will use: npm install (no package-lock.json found)"
fi
echo ""

# Create log file
LOG_FILE="${APP_PATH}/npm-install-$(date +%Y%m%d-%H%M%S).log"
echo "📝 Log file: $LOG_FILE"
echo ""

# Install with nohup to survive SSH disconnection
echo "▶ Starting npm install (this may take several minutes)..."
echo "   The process will continue even if you disconnect from SSH."
echo "   Monitor progress with: tail -f $LOG_FILE"
echo ""

# Use nohup to run in background, redirect output to log file
nohup bash -c "
  echo 'Starting npm install at $(date)' >> '$LOG_FILE'
  $INSTALL_CMD >> '$LOG_FILE' 2>&1
  EXIT_CODE=\$?
  echo '' >> '$LOG_FILE'
  echo 'npm install finished at $(date) with exit code: '\$EXIT_CODE >> '$LOG_FILE'
  exit \$EXIT_CODE
" &

INSTALL_PID=$!
echo "✅ Installation started in background (PID: $INSTALL_PID)"
echo ""
echo "============================================"
echo "📋 Installation Status"
echo "============================================"
echo "Process ID: $INSTALL_PID"
echo "Log file: $LOG_FILE"
echo ""
echo "To monitor progress:"
echo "  tail -f $LOG_FILE"
echo ""
echo "To check if still running:"
echo "  ps aux | grep $INSTALL_PID"
echo ""
echo "To check exit status:"
echo "  tail -20 $LOG_FILE"
echo ""
echo "You can safely disconnect from SSH now."
echo "The installation will continue in the background."
echo "============================================"

