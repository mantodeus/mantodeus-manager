#!/bin/bash
# Diagnose webhook listener errors
# Run this on the server to see why the webhook is errored

echo "🔍 Diagnosing Webhook Listener Error..."
echo ""

# Check PM2 error logs
echo "1. PM2 Error Logs (last 20 lines):"
echo "============================================"
if command -v pm2 &> /dev/null; then
    pm2 logs webhook-listener --err --lines 20 --nostream 2>/dev/null || echo "  Could not read PM2 error logs"
elif command -v npx &> /dev/null; then
    npx pm2 logs webhook-listener --err --lines 20 --nostream 2>/dev/null || echo "  Could not read PM2 error logs"
else
    echo "  PM2 not found"
fi
echo ""

# Check PM2 output logs
echo "2. PM2 Output Logs (last 20 lines):"
echo "============================================"
if command -v pm2 &> /dev/null; then
    pm2 logs webhook-listener --out --lines 20 --nostream 2>/dev/null || echo "  Could not read PM2 output logs"
elif command -v npx &> /dev/null; then
    npx pm2 logs webhook-listener --out --lines 20 --nostream 2>/dev/null || echo "  Could not read PM2 output logs"
else
    echo "  PM2 not found"
fi
echo ""

# Check if WEBHOOK_SECRET is set
echo "3. Environment Variables:"
echo "============================================"
if [ -f ".env" ]; then
    if grep -q "WEBHOOK_SECRET" .env; then
        echo "  ✅ WEBHOOK_SECRET found in .env"
        # Show first few chars (don't expose full secret)
        grep "WEBHOOK_SECRET" .env | sed 's/=.*/=***hidden***/'
    else
        echo "  ❌ WEBHOOK_SECRET NOT found in .env"
        echo "  💡 Add to .env: WEBHOOK_SECRET=$(openssl rand -hex 32)"
    fi
else
    echo "  ⚠️  .env file not found"
fi

# Check if it's set in environment
if [ -n "${WEBHOOK_SECRET:-}" ]; then
    echo "  ✅ WEBHOOK_SECRET is set in environment"
else
    echo "  ⚠️  WEBHOOK_SECRET not set in environment"
fi
echo ""

# Check if dependencies are installed
echo "4. Dependencies Check:"
echo "============================================"
if [ -d "node_modules/express" ]; then
    echo "  ✅ express is installed"
else
    echo "  ❌ express is NOT installed"
    echo "  💡 Run: npx pnpm install"
fi

if [ -d "node_modules" ]; then
    echo "  ✅ node_modules directory exists"
    MODULE_COUNT=$(find node_modules -maxdepth 1 -type d | wc -l)
    echo "  📦 Found $MODULE_COUNT top-level modules"
else
    echo "  ❌ node_modules directory not found"
    echo "  💡 Run: npx pnpm install"
fi
echo ""

# Check if webhook files exist
echo "5. Webhook Files:"
echo "============================================"
if [ -f "infra/webhook/webhook-listener.js" ]; then
    echo "  ✅ webhook-listener.js exists"
else
    echo "  ❌ webhook-listener.js NOT found"
fi

if [ -f "infra/webhook/start-webhook.sh" ]; then
    echo "  ✅ start-webhook.sh exists"
    if [ -x "infra/webhook/start-webhook.sh" ]; then
        echo "  ✅ start-webhook.sh is executable"
    else
        echo "  ⚠️  start-webhook.sh is NOT executable"
        echo "  💡 Run: chmod +x infra/webhook/start-webhook.sh"
    fi
else
    echo "  ❌ start-webhook.sh NOT found"
fi

if [ -f "infra/webhook/ecosystem.config.cjs" ]; then
    echo "  ✅ ecosystem.config.cjs exists"
else
    echo "  ❌ ecosystem.config.cjs NOT found"
fi
echo ""

# Check port 9000
echo "6. Port 9000 Check:"
echo "============================================"
if command -v lsof &> /dev/null; then
    if lsof -i :9000 2>/dev/null | grep -q LISTEN; then
        echo "  ⚠️  Port 9000 is already in use:"
        lsof -i :9000 2>/dev/null | head -3
    else
        echo "  ✅ Port 9000 is available"
    fi
elif command -v netstat &> /dev/null; then
    if netstat -tuln 2>/dev/null | grep -q ":9000"; then
        echo "  ⚠️  Port 9000 is already in use"
        netstat -tuln 2>/dev/null | grep ":9000"
    else
        echo "  ✅ Port 9000 is available"
    fi
else
    echo "  ⚠️  Cannot check port (lsof/netstat not available)"
fi
echo ""

# Check PM2 info
echo "7. PM2 Process Info:"
echo "============================================"
if command -v pm2 &> /dev/null; then
    pm2 info webhook-listener 2>/dev/null | head -20 || echo "  Could not get PM2 info"
elif command -v npx &> /dev/null; then
    npx pm2 info webhook-listener 2>/dev/null | head -20 || echo "  Could not get PM2 info"
fi
echo ""

# Summary and fix suggestions
echo "============================================"
echo "📊 Most Common Issues:"
echo "============================================"
echo ""
echo "1. Missing WEBHOOK_SECRET:"
echo "   Add to .env: WEBHOOK_SECRET=$(openssl rand -hex 32)"
echo ""
echo "2. Missing dependencies:"
echo "   Run: npx pnpm install"
echo ""
echo "3. Port already in use:"
echo "   Check: lsof -i :9000 or netstat -tuln | grep 9000"
echo ""
echo "4. File permissions:"
echo "   Run: chmod +x infra/webhook/start-webhook.sh"
echo ""
echo "💡 To restart after fixing:"
echo "   npx pm2 delete webhook-listener"
echo "   npx pm2 start infra/webhook/ecosystem.config.cjs"
echo "   npx pm2 save"
echo ""

