#!/bin/bash
# Rebuild script with verification
# Run this on your Infomaniak server

set -e  # Exit on error

echo "=========================================="
echo "🔨 REBUILDING MANTODEUS MANAGER"
echo "=========================================="
echo ""

cd /srv/customer/sites/manager.mantodeus.com

echo "📥 Step 1: Pulling latest code..."
git pull origin main || {
    echo "⚠️  Git pull had conflicts or issues. Continuing anyway..."
}

echo ""
echo "🗑️  Step 2: Removing old build..."
rm -rf dist
echo "✅ Old build removed"

echo ""
echo "📦 Step 3: Installing dependencies (if needed)..."
npm install

echo ""
echo "🔨 Step 4: Building application..."
npm run build

echo ""
echo "🔍 Step 5: Verifying build..."
if [ ! -f "dist/index.js" ]; then
    echo "❌ ERROR: dist/index.js not found!"
    exit 1
fi

if [ ! -d "dist/public" ]; then
    echo "❌ ERROR: dist/public not found!"
    exit 1
fi

if [ ! -f "dist/public/index.html" ]; then
    echo "❌ ERROR: dist/public/index.html not found!"
    exit 1
fi

echo "✅ Build files found"

echo ""
echo "🔍 Step 6: Checking for userId in compiled code (should NOT exist)..."
if grep -q "userId" dist/index.js 2>/dev/null; then
    echo "⚠️  WARNING: Found 'userId' in compiled code!"
    echo "   This might be in comments or strings. Checking context..."
    grep -n "userId" dist/index.js | head -5
    echo ""
    echo "   If you see 'supabaseId' in the actual SQL queries, that's correct."
    echo "   If you see 'userId' in SQL queries, the build failed."
else
    echo "✅ No 'userId' found in compiled code (good!)"
fi

echo ""
echo "🔍 Step 7: Checking for supabaseId in compiled code (should exist)..."
if grep -q "supabaseId" dist/index.js 2>/dev/null; then
    echo "✅ Found 'supabaseId' in compiled code (correct!)"
else
    echo "⚠️  WARNING: 'supabaseId' not found in compiled code!"
fi

echo ""
echo "=========================================="
echo "✅ BUILD COMPLETE!"
echo "=========================================="
echo ""
echo "🔄 Restarting application via PM2..."
PM2_APP_NAME="${PM2_APP_NAME:-mantodeus-manager}"
npx pm2 restart "$PM2_APP_NAME"
echo "✅ Restarted: $PM2_APP_NAME"
echo ""














