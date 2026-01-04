#!/bin/bash
# Quick webhook status check (works without the full check script)
# Run this on the server to quickly see webhook status

echo "🔍 Quick Webhook Status Check"
echo ""

# Check PM2
echo "PM2 Status:"
if command -v pm2 &> /dev/null; then
    pm2 list | grep -E "webhook|mantodeus" || echo "  No webhook or app processes found"
elif command -v npx &> /dev/null; then
    npx pm2 list 2>/dev/null | grep -E "webhook|mantodeus" || echo "  No webhook or app processes found (or PM2 not accessible)"
else
    echo "  PM2 not found - try: npx pm2 list"
fi
echo ""

# Check health endpoint
echo "Health Endpoint:"
if curl -sf http://localhost:9000/health > /dev/null 2>&1; then
    echo "  ✅ Port 9000 is responding"
    curl -s http://localhost:9000/health | head -3
else
    echo "  ❌ Port 9000 is NOT responding"
    echo "  💡 Webhook listener may not be running"
fi
echo ""

# Check if webhook files exist
echo "Webhook Files:"
if [ -f "infra/webhook/webhook-listener.js" ]; then
    echo "  ✅ webhook-listener.js exists"
else
    echo "  ❌ webhook-listener.js not found"
    echo "  💡 Run: git pull origin main"
fi

if [ -f "infra/webhook/ecosystem.config.cjs" ]; then
    echo "  ✅ ecosystem.config.cjs exists"
else
    echo "  ❌ ecosystem.config.cjs not found"
fi
echo ""

# Check logs
echo "Recent Logs:"
if [ -f "logs/webhook.log" ]; then
    echo "  Last 3 entries from logs/webhook.log:"
    tail -n 3 logs/webhook.log 2>/dev/null | head -3 || echo "  (log file empty or unreadable)"
else
    echo "  ⚠️  logs/webhook.log not found"
    echo "  💡 Logs may be in PM2 output: npx pm2 logs webhook-listener"
fi
echo ""

echo "💡 To start webhook: npx pm2 start infra/webhook/ecosystem.config.cjs"

