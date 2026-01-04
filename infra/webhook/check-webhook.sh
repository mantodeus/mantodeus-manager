#!/bin/bash
# =============================================================================
# Webhook Status Checker
# Checks if the webhook listener is running and receiving events
# =============================================================================

set -euo pipefail

echo "🔍 Checking Webhook Status..."
echo ""

# Check if webhook listener is running in PM2
echo "1. Checking PM2 process..."
if pm2 list | grep -q "webhook-listener"; then
    echo "   ✅ webhook-listener is running in PM2"
    pm2 info webhook-listener | grep -E "status|uptime|restarts"
else
    echo "   ❌ webhook-listener is NOT running in PM2"
    echo "   💡 Start it with: pm2 start infra/webhook/ecosystem.config.cjs"
fi
echo ""

# Check health endpoint
echo "2. Checking health endpoint..."
if curl -sf http://localhost:9000/health > /dev/null 2>&1; then
    echo "   ✅ Health endpoint is responding"
    curl -s http://localhost:9000/health | jq '.' 2>/dev/null || curl -s http://localhost:9000/health
else
    echo "   ❌ Health endpoint is NOT responding (port 9000)"
    echo "   💡 Webhook listener may not be running"
fi
echo ""

# Check webhook logs
echo "3. Checking recent webhook logs..."
LOG_FILE="/srv/customer/sites/manager.mantodeus.com/logs/webhook.log"
if [ -f "$LOG_FILE" ]; then
    echo "   📝 Last 10 log entries:"
    tail -n 10 "$LOG_FILE" | jq -r '.message' 2>/dev/null || tail -n 10 "$LOG_FILE"
    echo ""
    echo "   📊 Recent webhook activity:"
    grep -c "Webhook received" "$LOG_FILE" 2>/dev/null && echo "   ✅ Webhooks have been received" || echo "   ⚠️  No webhook events logged"
else
    echo "   ⚠️  Log file not found: $LOG_FILE"
    echo "   💡 Logs may be in PM2 output: pm2 logs webhook-listener"
fi
echo ""

# Check PM2 logs
echo "4. Checking PM2 logs (last 5 lines)..."
pm2 logs webhook-listener --lines 5 --nostream 2>/dev/null || echo "   ⚠️  Could not read PM2 logs"
echo ""

# Check GitHub webhook configuration
echo "5. GitHub Webhook Configuration:"
echo "   📋 Check GitHub repository webhook settings:"
echo "      - Go to: https://github.com/mantodeus/mantodeus-manager/settings/hooks"
echo "      - Verify webhook URL points to: http://your-server:9000/webhook"
echo "      - Check 'Recent Deliveries' for recent push events"
echo ""

# Check if deploy.sh exists and has git operations
echo "6. Checking deploy script..."
DEPLOY_SCRIPT="/srv/customer/sites/manager.mantodeus.com/infra/deploy/deploy.sh"
if [ -f "$DEPLOY_SCRIPT" ]; then
    echo "   ✅ deploy.sh exists"
    if grep -q "git fetch\|git pull\|git reset" "$DEPLOY_SCRIPT"; then
        echo "   ✅ deploy.sh includes git operations"
    else
        echo "   ⚠️  WARNING: deploy.sh does NOT include git fetch/pull!"
        echo "   💡 This means deployments won't actually pull new code"
        echo "   💡 Fix: Add 'git fetch origin && git reset --hard origin/main' to deploy.sh"
    fi
else
    echo "   ❌ deploy.sh not found"
fi
echo ""

# Summary
echo "============================================"
echo "📊 Summary:"
echo "============================================"
if pm2 list | grep -q "webhook-listener" && curl -sf http://localhost:9000/health > /dev/null 2>&1; then
    echo "✅ Webhook listener appears to be running"
    echo ""
    echo "⚠️  IMPORTANT: Even if the webhook is running, check:"
    echo "   1. GitHub webhook is configured correctly"
    echo "   2. deploy.sh includes git fetch/pull (currently missing!)"
    echo "   3. Recent webhook deliveries in GitHub show successful responses"
else
    echo "❌ Webhook listener is NOT running or not accessible"
    echo ""
    echo "💡 To start the webhook listener:"
    echo "   cd /srv/customer/sites/manager.mantodeus.com"
    echo "   pm2 start infra/webhook/ecosystem.config.cjs"
    echo "   pm2 save"
fi
echo ""

