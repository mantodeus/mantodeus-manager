#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/srv/customer/sites/manager.mantodeus.com"
EXPECTED_GREP="${EXPECTED_GREP:-}"

echo "==> Deploy start: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
cd "$APP_DIR"

# Check if screen is available, if not, fall back to regular deploy
if ! command -v screen &> /dev/null; then
  echo "⚠️  screen not available, running regular deploy..."
  exec "$APP_DIR/scripts/deploy-prod.sh"
fi

# Create a named screen session for the deployment
SESSION_NAME="mantodeus-deploy-$(date +%s)"

echo "==> Starting deployment in screen session: $SESSION_NAME"
echo "==> To attach: screen -r $SESSION_NAME"
echo "==> To detach: Press Ctrl+A then D"

# Run deployment in screen session
screen -dmS "$SESSION_NAME" bash -c "
  cd '$APP_DIR'
  echo '==> Fetching and pulling main'
  git fetch origin
  git pull origin main
  
  echo '==> Current commit'
  git --no-pager log -1 --oneline
  
  if [[ -n '$EXPECTED_GREP' ]]; then
    echo '==> Verifying expected change: $EXPECTED_GREP'
    if ! git --no-pager grep -n '$EXPECTED_GREP' -- client/src; then
      echo 'ERROR: Expected pattern not found in client/src'
      exit 1
    fi
  fi
  
  echo '==> Install dependencies'
  npx pnpm install
  
  echo '==> Run migrations'
  npx pnpm drizzle-kit migrate
  
  echo '==> Install (frozen lockfile)'
  npx pnpm install --frozen-lockfile
  
  echo '==> Build'
  export NODE_OPTIONS=--max-old-space-size=4096
  npx pnpm run build
  
  echo '==> Verify build output'
  if [[ ! -d '$APP_DIR/dist/public/assets' ]]; then
    echo 'ERROR: Build output not found at dist/public/assets'
    exit 1
  fi
  
  echo '==> Restart service'
  if ! npx pm2 restart mantodeus-manager; then
    echo 'WARN: Restart failed, attempting fresh start'
    npx pm2 start dist/index.js --name mantodeus-manager
  fi
  
  echo '==> Deploy complete: $(date -u +%Y-%m-%dT%H:%M:%SZ)'
  echo ''
  echo '✅ Deployment completed successfully!'
  echo 'Press any key to close this window...'
  read -n 1
"

echo "==> Deployment started in background screen session"
echo "==> Attach with: screen -r $SESSION_NAME"
echo "==> List sessions: screen -ls"

