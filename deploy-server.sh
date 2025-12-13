#!/bin/bash
# Server-side deployment script
# Run this on your Infomaniak server after pushing to GitHub

set -e  # Exit on error

echo "🚀 Starting deployment..."

cd /srv/customer/sites/manager.mantodeus.com

echo "📥 Pulling latest changes from GitHub..."
git pull origin main

echo "📦 Installing dependencies (if needed)..."
npm install

echo "🔨 Building application..."
npm run build

echo "✅ Build complete!"
echo ""
echo "🔄 Restarting application via PM2..."
npx pm2 restart mantodeus-manager

