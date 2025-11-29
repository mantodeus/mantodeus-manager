#!/bin/bash

# Setup script to run on your Infomaniak server
# Run this from: ~/sites/manager.mantodeus.com

echo "🚀 Setting up GitHub Webhook Deployment Server..."
echo ""

# Get the current directory
APP_DIR=$(pwd)
echo "App directory: $APP_DIR"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Make sure you're in the app root directory."
    exit 1
fi

# Create deploy directory if it doesn't exist
echo "📁 Creating deploy directory..."
mkdir -p deploy
cd deploy

# Check if deploy files exist
if [ ! -f "deploy.js" ]; then
    echo "❌ Error: deploy.js not found. Make sure you've pulled the latest code from GitHub."
    echo "Run: git pull"
    exit 1
fi

# Install dependencies
echo "📦 Installing webhook server dependencies..."
npm install

# Update config with correct paths
echo "⚙️  Updating configuration..."
# Get the absolute path
ABS_APP_PATH=$(cd "$APP_DIR" && pwd)
PM2_APP_NAME=$(pm2 list | grep -E "manager|mantodeus" | head -1 | awk '{print $2}' | sed 's/│//g' | xargs)

if [ -z "$PM2_APP_NAME" ]; then
    echo "⚠️  Warning: Could not detect PM2 app name. Check with: pm2 list"
    PM2_APP_NAME="mantodeus-manager"
fi

echo "Detected PM2 app name: $PM2_APP_NAME"
echo "App path: $ABS_APP_PATH"

# Update config.json (if it exists)
if [ -f "deploy.config.json" ]; then
    # Use sed to update paths (works on most systems)
    sed -i "s|\"appPath\": \".*\"|\"appPath\": \"$ABS_APP_PATH\"|g" deploy.config.json
    sed -i "s|\"pm2AppName\": \".*\"|\"pm2AppName\": \"$PM2_APP_NAME\"|g" deploy.config.json
    echo "✅ Configuration updated"
else
    echo "⚠️  Warning: deploy.config.json not found. Create it manually."
fi

# Check if webhook server is already running
if pm2 list | grep -q "github-webhook"; then
    echo "🔄 Webhook server already running. Restarting..."
    pm2 restart github-webhook
else
    echo "▶️  Starting webhook server..."
    pm2 start deploy.js --name github-webhook
    pm2 save
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📊 Check status:"
echo "   pm2 status github-webhook"
echo ""
echo "📝 View logs:"
echo "   pm2 logs github-webhook"
echo "   # or"
echo "   tail -f deploy/deploy.log"
echo ""
echo "🏥 Health check:"
echo "   curl http://localhost:3000/health"
echo ""

