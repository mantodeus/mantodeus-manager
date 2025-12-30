#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/srv/customer/sites/manager.mantodeus.com"
ARCHIVE="/tmp/dist.tar.gz"

cd "$APP_DIR"
rm -rf dist
tar -xzf "$ARCHIVE"
npx pm2 restart mantodeus-manager --update-env || npx pm2 start dist/index.js --name mantodeus-manager
rm "$ARCHIVE"
