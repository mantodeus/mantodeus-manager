#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/srv/customer/sites/manager.mantodeus.com"
EXPECTED_GREP="${EXPECTED_GREP:-}"

echo "==> Manual Deploy Script (for SSH sessions)"
echo "==> This script uses nohup to prevent SSH disconnection issues"
echo "==> Deploy start: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
cd "$APP_DIR"

# Create log file with timestamp
LOG_FILE="$APP_DIR/deploy-$(date +%Y%m%d-%H%M%S).log"

echo "==> Logging to: $LOG_FILE"
echo "==> Monitor with: tail -f $LOG_FILE"

# Run deployment with nohup to prevent SSH disconnection
nohup bash -c "
  set -euo pipefail
  cd '$APP_DIR'
  
  echo '==> Fetching and pulling main' | tee -a '$LOG_FILE'
  git fetch origin | tee -a '$LOG_FILE'
  git pull origin main | tee -a '$LOG_FILE'
  
  echo '==> Current commit' | tee -a '$LOG_FILE'
  git --no-pager log -1 --oneline | tee -a '$LOG_FILE'
  
  if [[ -n '$EXPECTED_GREP' ]]; then
    echo '==> Verifying expected change: $EXPECTED_GREP' | tee -a '$LOG_FILE'
    if ! git --no-pager grep -n '$EXPECTED_GREP' -- client/src; then
      echo 'ERROR: Expected pattern not found in client/src' | tee -a '$LOG_FILE'
      exit 1
    fi
  fi
  
  echo '==> Install dependencies' | tee -a '$LOG_FILE'
  npx pnpm install | tee -a '$LOG_FILE'
  
  echo '==> Run migrations' | tee -a '$LOG_FILE'
  npx pnpm drizzle-kit migrate | tee -a '$LOG_FILE'
  
  echo '==> Install (frozen lockfile)' | tee -a '$LOG_FILE'
  npx pnpm install --frozen-lockfile | tee -a '$LOG_FILE'
  
  echo '==> Build (this may take several minutes)' | tee -a '$LOG_FILE'
  export NODE_OPTIONS=--max-old-space-size=4096
  npx pnpm run build 2>&1 | tee -a '$LOG_FILE'
  
  echo '==> Verify build output' | tee -a '$LOG_FILE'
  if [[ ! -d '$APP_DIR/dist/public/assets' ]]; then
    echo 'ERROR: Build output not found at dist/public/assets' | tee -a '$LOG_FILE'
    exit 1
  fi
  
  echo '==> Restart service' | tee -a '$LOG_FILE'
  if ! npx pm2 restart mantodeus-manager; then
    echo 'WARN: Restart failed, attempting fresh start' | tee -a '$LOG_FILE'
    npx pm2 start dist/index.js --name mantodeus-manager | tee -a '$LOG_FILE'
  fi
  
  echo '==> Deploy complete: $(date -u +%Y-%m-%dT%H:%M:%SZ)' | tee -a '$LOG_FILE'
  echo '✅ Deployment completed successfully!' | tee -a '$LOG_FILE'
" > "$LOG_FILE" 2>&1 &

DEPLOY_PID=$!
echo "==> Deployment started in background (PID: $DEPLOY_PID)"
echo "==> Monitor progress: tail -f $LOG_FILE"
echo "==> Check if running: ps -p $DEPLOY_PID"
echo ""
echo "You can now safely disconnect from SSH. The deployment will continue."
echo "Reconnect later and check: tail -f $LOG_FILE"

