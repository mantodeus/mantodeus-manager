#!/bin/bash

# Quick webhook server test script

echo "🔍 Testing GitHub Webhook Deployment Server..."
echo ""

# Check if server is running
echo "1. Checking if webhook server is running..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "   ✅ Webhook server is running"
    curl -s http://localhost:3000/health | jq '.' 2>/dev/null || curl -s http://localhost:3000/health
else
    echo "   ❌ Webhook server is NOT running"
    echo "   Start it with: pm2 start deploy.js --name github-webhook"
    exit 1
fi

echo ""
echo "2. Checking configuration..."
if [ -f "deploy.config.json" ]; then
    echo "   ✅ Config file exists"
    # Check if paths are still placeholders
    if grep -q "/path/to/your/app" deploy.config.json; then
        echo "   ⚠️  WARNING: appPath still has placeholder value!"
        echo "   Update deploy.config.json with your actual app path"
    else
        echo "   ✅ Config looks good"
    fi
else
    echo "   ❌ Config file not found"
fi

echo ""
echo "3. Checking PM2 processes..."
if command -v pm2 &> /dev/null; then
    pm2 list
else
    echo "   ⚠️  PM2 not found in PATH"
fi

echo ""
echo "4. Recent deployment logs (last 20 lines):"
if [ -f "deploy.log" ]; then
    tail -n 20 deploy.log
else
    echo "   No log file found yet"
fi

echo ""
echo "✅ Test complete!"
echo ""
echo "To trigger a test deployment:"
echo "  1. Make a small change in your repo"
echo "  2. Commit and push to main/master"
echo "  3. Watch logs: tail -f deploy.log"

