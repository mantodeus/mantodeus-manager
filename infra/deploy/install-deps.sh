#!/bin/bash
# Simple npm install that survives SSH disconnection
# Usage: bash infra/deploy/install-deps.sh

echo "Starting npm install in background..."
echo "This will continue even if you disconnect from SSH."
echo ""

# Determine install command
if [ -f "package-lock.json" ]; then
  INSTALL_CMD="npm ci"
else
  INSTALL_CMD="npm install"
fi

# Create simple log file
LOG_FILE="npm-install.log"

# Run with nohup (simpler, avoids fork issues)
nohup $INSTALL_CMD > "$LOG_FILE" 2>&1 &

echo "✅ npm install started in background"
echo "📝 Log file: $LOG_FILE"
echo ""
echo "Monitor with: tail -f $LOG_FILE"
echo "Check status: ps aux | grep npm"
