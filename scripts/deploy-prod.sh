#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/srv/customer/sites/manager.mantodeus.com"
EXPECTED_GREP="${EXPECTED_GREP:-}"

echo "==> Deploy start: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
cd "$APP_DIR"

echo "==> Fetching and pulling main"
git fetch origin
git pull origin main

echo "==> Current commit"
git --no-pager log -1 --oneline

if [[ -n "$EXPECTED_GREP" ]]; then
  echo "==> Verifying expected change: $EXPECTED_GREP"
  if ! git --no-pager grep -n "$EXPECTED_GREP" -- client/src; then
    echo "ERROR: Expected pattern not found in client/src"
    exit 1
  fi
fi

echo "==> Install dependencies"
npm install

echo "==> Run migrations"
npx pnpm run db:migrate

echo "==> Install (frozen lockfile)"
npm install --frozen-lockfile

echo "==> Build"
# Increase Node.js memory limit to prevent OOM during Vite build
export NODE_OPTIONS=--max-old-space-size=4096
npm run build

echo "==> Verify build output"
if [[ ! -d "$APP_DIR/dist/public/assets" ]]; then
  echo "ERROR: Build output not found at dist/public/assets"
  exit 1
fi

echo "==> Restart service"
if ! npx pm2 restart mantodeus-manager; then
  echo "WARN: Restart failed, attempting fresh start"
  npx pm2 start dist/index.js --name mantodeus-manager
fi

echo "==> Deploy complete: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
