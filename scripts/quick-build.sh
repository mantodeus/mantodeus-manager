#!/usr/bin/env bash
# Quick build script that runs in background to prevent SSH disconnection
# Usage: ./scripts/quick-build.sh

set -euo pipefail

APP_DIR="/srv/customer/sites/manager.mantodeus.com"
cd "$APP_DIR"

LOG_FILE="$APP_DIR/build-$(date +%Y%m%d-%H%M%S).log"

echo "🚀 Starting build in background..."
echo "📝 Log file: $LOG_FILE"
echo ""

# Run build with nohup - this detaches from terminal immediately
nohup bash -c "
  cd '$APP_DIR'
  echo '=== Build started: \$(date)' >> '$LOG_FILE'
  echo '=== Node.js memory limit: 4GB' >> '$LOG_FILE'
  
  export NODE_OPTIONS=--max-old-space-size=4096
  npx pnpm run build >> '$LOG_FILE' 2>&1
  
  BUILD_EXIT=\$?
  if [ \$BUILD_EXIT -eq 0 ]; then
    echo '' >> '$LOG_FILE'
    echo '✅ Build completed successfully: \$(date)' >> '$LOG_FILE'
    
    # Restart PM2
    echo '=== Restarting PM2...' >> '$LOG_FILE'
    npx pm2 restart mantodeus-manager >> '$LOG_FILE' 2>&1 || npx pm2 start dist/index.js --name mantodeus-manager >> '$LOG_FILE' 2>&1
    echo '✅ Deployment complete: \$(date)' >> '$LOG_FILE'
  else
    echo '' >> '$LOG_FILE'
    echo '❌ Build failed with exit code: '\$BUILD_EXIT >> '$LOG_FILE'
  fi
" > /dev/null 2>&1 &

BUILD_PID=$!
echo "✅ Build started (PID: $BUILD_PID)"
echo ""
echo "📋 Monitor progress:"
echo "   tail -f $LOG_FILE"
echo ""
echo "💡 You can safely disconnect now. The build will continue."
echo "💡 Reconnect later and check: tail -f $LOG_FILE"

