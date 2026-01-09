#!/bin/bash
# Quick script to deploy OCR updates to production

set -e

APP_DIR="/srv/customer/sites/manager.mantodeus.com"
cd "$APP_DIR"

echo "🔄 Pulling latest code..."
git fetch origin
git pull origin main

echo "🔨 Building project..."
export NODE_OPTIONS=--max-old-space-size=4096
npm run build

echo "🔄 Restarting PM2..."
npx pm2 restart mantodeus-manager || npx pm2 start dist/index.js --name mantodeus-manager

echo "✅ Deployment complete!"
echo ""
echo "📋 Check logs with:"
echo "   npx pm2 logs mantodeus-manager --lines 0 | grep -i '\[Mistral OCR\]\|\[Invoice Bulk Upload\]\|\[Document Router\]'"
