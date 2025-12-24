#!/bin/bash
# Wrapper script to start webhook listener with proper dependency resolution
# This ensures express and other dependencies are available

set -euo pipefail

APP_PATH="/srv/customer/sites/manager.mantodeus.com"
cd "$APP_PATH"

# Check if express is available
if [ ! -d "node_modules/express" ] && [ ! -f "node_modules/express/index.js" ]; then
  echo "⚠️  express not found, checking dependencies..."
  
  # Check if pnpm is available, install if not
  if ! command -v pnpm &> /dev/null; then
    echo "▶ pnpm not found, installing pnpm..."
    # Try to install pnpm using corepack (Node.js 16.10+)
    if command -v corepack &> /dev/null; then
      corepack enable
      corepack prepare pnpm@10.4.1 --activate
    else
      # Fallback: install pnpm via npm
      npm install -g pnpm@10.4.1 || {
        echo "⚠️  Failed to install pnpm globally, trying npm instead..."
        echo "▶ Installing dependencies with npm..."
        npm install
        # Verify express is now available
        if [ ! -d "node_modules/express" ] && [ ! -f "node_modules/express/index.js" ]; then
          echo "❌ Failed to install express. Please run 'npm install' manually."
          exit 1
        fi
        # Start the webhook listener with proper NODE_PATH
        export NODE_PATH="$APP_PATH/node_modules:$NODE_PATH"
        exec node "$APP_PATH/infra/webhook/webhook-listener.js"
      }
    fi
  fi
  
  # Now try to install with pnpm
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

