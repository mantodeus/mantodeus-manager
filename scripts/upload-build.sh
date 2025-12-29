#!/usr/bin/env bash
# Upload local build to server
# Usage: ./scripts/upload-build.sh

set -euo pipefail

APP_DIR="/srv/customer/sites/manager.mantodeus.com"
REMOTE_HOST="mantodeus"
ARCHIVE_NAME="dist-$(date +%Y%m%d-%H%M%S).tar.gz"

echo "📦 Creating archive of dist folder..."
tar -czf "$ARCHIVE_NAME" dist/

echo "📤 Uploading to server..."
scp "$ARCHIVE_NAME" "$REMOTE_HOST:/tmp/"

echo "🚀 Deploying on server..."
ssh "$REMOTE_HOST" bash -c "
  set -euo pipefail
  cd '$APP_DIR'
  
  echo '📦 Extracting build...'
  tar -xzf /tmp/$ARCHIVE_NAME
  
  echo '✅ Build extracted'
  echo '🔄 Restarting PM2...'
  npx pm2 restart mantodeus-manager || npx pm2 start dist/index.js --name mantodeus-manager
  
  echo '🧹 Cleaning up...'
  rm /tmp/$ARCHIVE_NAME
  
  echo '✅ Deployment complete!'
"

echo "🧹 Cleaning up local archive..."
rm "$ARCHIVE_NAME"

echo "✅ Done! Build deployed to server."

