#!/usr/bin/env bash
# Helper script to stop a running environment by reading PID from logs/<env>.pid
# Also kills any process on the specified port
# Usage: stop-env.sh <env_name> [port]
# Example: stop-env.sh production 3000

set -euo pipefail

ENV_NAME="${1:-}"
PORT="${2:-}"

if [ -z "$ENV_NAME" ]; then
  echo "Error: Environment name required" >&2
  echo "Usage: $0 <env_name> [port]" >&2
  exit 1
fi

PID_FILE="logs/${ENV_NAME}.pid"

# Kill process by PID if PID file exists
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
  
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "Stopping process $PID for environment: $ENV_NAME"
    kill "$PID" 2>/dev/null || true
    sleep 2
    
    # Force kill if still running
    if kill -0 "$PID" 2>/dev/null; then
      echo "Force killing process $PID..."
      kill -9 "$PID" 2>/dev/null || true
      sleep 1
    fi
  fi
  
  rm -f "$PID_FILE"
fi

# Kill any process on the port (if port specified)
if [ -n "$PORT" ]; then
  # Try using lsof first (more reliable)
  if command -v lsof &> /dev/null; then
    LSOF_PID=$(lsof -ti:$PORT 2>/dev/null || echo "")
    if [ -n "$LSOF_PID" ]; then
      echo "Killing process on port $PORT (PID: $LSOF_PID)"
      kill "$LSOF_PID" 2>/dev/null || true
      sleep 1
      if kill -0 "$LSOF_PID" 2>/dev/null; then
        kill -9 "$LSOF_PID" 2>/dev/null || true
      fi
    fi
  # Fallback to fuser
  elif command -v fuser &> /dev/null; then
    fuser -k "${PORT}/tcp" 2>/dev/null || true
  fi
fi

echo "{\"status\":\"ok\",\"env\":\"$ENV_NAME\",\"message\":\"Environment stopped\"}"

