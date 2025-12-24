#!/bin/bash
# Wrapper script to start webhook listener with proper dependency resolution
# This ensures express and other dependencies are available

set -euo pipefail

APP_PATH="/srv/customer/sites/manager.mantodeus.com"
cd "$APP_PATH"

# Check if express is available
if [ ! -d "node_modules/express" ] && [ ! -f "node_modules/express/index.js" ]; then
  echo "⚠️  express not found, checking dependencies..."
  
  # Try to install with npm if pnpm is not available
  if command -v pnpm &> /dev/null; then
    echo "▶ Installing dependencies with pnpm..."
    pnpm install --frozen-lockfile || {
      echo "⚠️  pnpm install failed, trying npm..."
      npm install
    }
  else
    echo "▶ Installing dependencies with npm..."
    npm install
  fi
  
  # Verify express is now available
  if [ ! -d "node_modules/express" ] && [ ! -f "node_modules/express/index.js" ]; then
    echo "❌ Failed to install express. Please run 'npm install' or 'pnpm install' manually."
    exit 1
  fi
fi

# Start the webhook listener with proper NODE_PATH
export NODE_PATH="$APP_PATH/node_modules:$NODE_PATH"
exec node "$APP_PATH/infra/webhook/webhook-listener.js"

