#!/usr/bin/env bash
# ⚠️  DEPRECATED: This script is disabled - Infomaniak manages the server process
# 
# This script is kept for reference but should NOT be used.
# Server process management is now handled exclusively by Infomaniak's Node.js application manager.
# 
# To start/restart the server:
#   1. Log into Infomaniak control panel
#   2. Navigate to: Node.js Application → [your-site]
#   3. Click: 'Restart Application'
#
# The server reads PORT from process.env.PORT (set by Infomaniak)
# and environment variables from .env file at runtime.

echo "❌ ERROR: This script is disabled." >&2
echo "   Server process management is handled by Infomaniak." >&2
echo "   Use Infomaniak control panel to restart the application." >&2
exit 1

# Original script code below (disabled):
# Usage: run-background.sh <env_name> <port>
# Example: run-background.sh production 3000

set -euo pipefail

ENV_NAME="${1:-}"
PORT="${2:-}"

if [ -z "$ENV_NAME" ] || [ -z "$PORT" ]; then
  echo "Error: Environment name and port required" >&2
  echo "Usage: $0 <env_name> <port>" >&2
  exit 1
fi

# Ensure logs directory exists
mkdir -p logs

# Set environment variables
export APP_ENV="$ENV_NAME"
export PORT="$PORT"
export NODE_ENV="production"

# Log file paths
LOG_FILE="logs/${ENV_NAME}.log"
PID_FILE="logs/${ENV_NAME}.pid"

# Check if dist/index.js exists
if [ ! -f "dist/index.js" ]; then
  echo "Error: dist/index.js not found. Run build first." >&2
  exit 1
fi

# Stop any existing process for this environment
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Stopping existing process (PID: $OLD_PID)..."
    kill "$OLD_PID" 2>/dev/null || true
    sleep 2
    if kill -0 "$OLD_PID" 2>/dev/null; then
      kill -9 "$OLD_PID" 2>/dev/null || true
    fi
  fi
  rm -f "$PID_FILE"
fi

# Start the server in the background using nohup
echo "Starting server for environment: $ENV_NAME on port: $PORT"
echo "Logs will be written to: $LOG_FILE"

nohup node dist/index.js >> "$LOG_FILE" 2>&1 &
NEW_PID=$!

# Save PID
echo "$NEW_PID" > "$PID_FILE"

# Give it a moment to start
sleep 2

# Verify it's still running
if ! kill -0 "$NEW_PID" 2>/dev/null; then
  echo "Error: Server failed to start. Check logs: $LOG_FILE" >&2
  rm -f "$PID_FILE"
  exit 1
fi

echo "Server started successfully (PID: $NEW_PID)"
echo "PID saved to: $PID_FILE"
echo "Logs: $LOG_FILE"

