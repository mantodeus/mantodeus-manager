#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/srv/customer/sites/manager.mantodeus.com"
cd "$APP_DIR"

# Create log file with timestamp
LOG_FILE="$APP_DIR/deploy-$(date +%Y%m%d-%H%M%S).log"

echo "==> Starting deployment in background"
echo "==> Log file: $LOG_FILE"
echo "==> Monitor with: tail -f $LOG_FILE"
echo "==> Check status: ps aux | grep 'pnpm run build'"
echo ""

# Run deployment with nohup
nohup bash -c "
  set -euo pipefail
  cd '$APP_DIR'
  
  echo '==> Deploy start: \$(date -u +%Y-%m-%dT%H:%M:%SZ)' | tee -a '$LOG_FILE'
  
  echo '==> Fetching and pulling main' | tee -a '$LOG_FILE'
  git fetch origin 2>&1 | tee -a '$LOG_FILE'
  git pull origin main 2>&1 | tee -a '$LOG_FILE'
  
  echo '==> Current commit' | tee -a '$LOG_FILE'
  git --no-pager log -1 --oneline | tee -a '$LOG_FILE'
  
  echo '==> Install dependencies' | tee -a '$LOG_FILE'
  npx pnpm install 2>&1 | tee -a '$LOG_FILE'
  
  echo '==> Run migrations' | tee -a '$LOG_FILE'
  npx pnpm drizzle-kit migrate 2>&1 | tee -a '$LOG_FILE'
  
  echo '==> Install (frozen lockfile)' | tee -a '$LOG_FILE'
  npx pnpm install --frozen-lockfile 2>&1 | tee -a '$LOG_FILE'
  
  echo '==> Build (this may take 5-10 minutes)' | tee -a '$LOG_FILE'
  export NODE_OPTIONS=--max-old-space-size=4096
  npx pnpm run build 2>&1 | tee -a '$LOG_FILE'
  
  BUILD_EXIT=\${PIPESTATUS[0]}
  if [ \$BUILD_EXIT -ne 0 ]; then
    echo '❌ Build failed with exit code: '\$BUILD_EXIT | tee -a '$LOG_FILE'
    exit \$BUILD_EXIT
  fi
  
  echo '==> Verify build output' | tee -a '$LOG_FILE'
  if [[ ! -d '$APP_DIR/dist/public/assets' ]]; then
    echo '❌ ERROR: Build output not found at dist/public/assets' | tee -a '$LOG_FILE'
    exit 1
  fi
  echo '✅ Build output verified' | tee -a '$LOG_FILE'
  
  echo '==> Restart service' | tee -a '$LOG_FILE'
  if ! npx pm2 restart mantodeus-manager 2>&1 | tee -a '$LOG_FILE'; then
    echo '⚠️  Restart failed, attempting fresh start' | tee -a '$LOG_FILE'
    npx pm2 start dist/index.js --name mantodeus-manager 2>&1 | tee -a '$LOG_FILE'
  fi
  
  echo '==> Deploy complete: \$(date -u +%Y-%m-%dT%H:%M:%SZ)' | tee -a '$LOG_FILE'
  echo '✅ Deployment completed successfully!' | tee -a '$LOG_FILE'
" > "$LOG_FILE" 2>&1 &

DEPLOY_PID=$!
echo "✅ Deployment started in background (PID: $DEPLOY_PID)"
echo ""
echo "📋 Useful commands:"
echo "   Monitor progress:    tail -f $LOG_FILE"
echo "   Check if running:    ps -p $DEPLOY_PID"
echo "   Kill if needed:      kill $DEPLOY_PID"
echo ""
echo "💡 You can now safely disconnect from SSH."
echo "💡 Reconnect later and check: tail -f $LOG_FILE"

