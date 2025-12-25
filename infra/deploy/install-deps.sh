#!/bin/bash
# Simple pnpm install that survives SSH disconnection
# Usage: bash infra/deploy/install-deps.sh

echo "Starting pnpm install in background..."
echo "This will continue even if you disconnect from SSH."
echo ""

# Use npx pnpm with frozen lockfile
INSTALL_CMD="npx pnpm install --frozen-lockfile"

# Create simple log file
LOG_FILE="pnpm-install.log"

# Run with nohup (simpler, avoids fork issues)
nohup $INSTALL_CMD > "$LOG_FILE" 2>&1 &

echo "✅ pnpm install started in background"
echo "📝 Log file: $LOG_FILE"
echo ""
echo "Monitor with: tail -f $LOG_FILE"
echo "Check status: ps aux | grep pnpm"
