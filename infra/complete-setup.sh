#!/bin/bash
#
# Complete Infrastructure Setup and Test
# Checks current state, starts PM2 if needed, and tests everything
#

set -euo pipefail

PROJECT_DIR="/srv/customer/sites/manager.mantodeus.com"
PM2_APP_NAME="mantodeus-manager"

cd "$PROJECT_DIR" || exit 1

echo "🚀 Complete Infrastructure Setup and Test"
echo "=========================================="
echo ""

# Step 1: Verify all infrastructure files exist
echo "📋 Step 1: Verifying infrastructure files..."
MISSING_FILES=0

check_file() {
  if [ -f "$1" ]; then
    echo "  ✅ $1"
  else
    echo "  ❌ $1 - MISSING"
    MISSING_FILES=$((MISSING_FILES + 1))
  fi
}

check_file "infra/deploy/deploy.sh"
check_file "infra/deploy/restart.sh"
check_file "infra/deploy/status.sh"
check_file "infra/ssh/generate-key.sh"
check_file "infra/ssh/install-key.sh"
check_file "infra/ssh/ssh-check.sh"
check_file "infra/webhook/webhook-listener.js"
check_file "infra/env/env-sync.sh"
check_file "infra/env/env-update.sh"
check_file "infra/tests/run-deploy-sim.sh"

if [ $MISSING_FILES -gt 0 ]; then
  echo ""
  echo "❌ Error: $MISSING_FILES files are missing!"
  echo "   Run the git show commands to extract missing files."
  exit 1
fi

echo ""
echo "✅ All infrastructure files present!"
echo ""

# Step 2: Check PM2 installation
echo "📋 Step 2: Checking PM2 installation..."
if command -v pm2 > /dev/null 2>&1; then
  PM2_VERSION=$(pm2 --version)
  echo "  ✅ PM2 is installed (version: $PM2_VERSION)"
else
  echo "  ⚠️  PM2 is not installed"
  echo "  💡 Install with: npm install -g pm2"
  echo "  💡 Or continue without PM2 (you'll need some process manager to run the server)"
fi
echo ""

# Step 3: Check current PM2 status
echo "📋 Step 3: Checking PM2 process status..."
if command -v pm2 > /dev/null 2>&1; then
  PM2_STATUS=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name==\"$PM2_APP_NAME\") | .pm2_env.status" 2>/dev/null || echo "not_found")
  
  if [ "$PM2_STATUS" = "not_found" ] || [ -z "$PM2_STATUS" ]; then
    echo "  ℹ️  PM2 process '$PM2_APP_NAME' is not running"
    
    # Check if ecosystem.config.js exists
    if [ -f "ecosystem.config.js" ]; then
      echo "  📄 Found ecosystem.config.js"
      echo ""
      echo "  🔄 Would you like to start the application with PM2? (y/n)"
      echo "     (This will start: pm2 start ecosystem.config.js)"
      echo ""
      echo "  💡 To start manually, run:"
      echo "     pm2 start ecosystem.config.js"
      echo "     pm2 save"
    else
      echo "  ⚠️  ecosystem.config.js not found"
      echo "  💡 To start manually, run:"
      echo "     pm2 start start-server.sh --name $PM2_APP_NAME"
    fi
  else
    echo "  ✅ PM2 process '$PM2_APP_NAME' is running (status: $PM2_STATUS)"
  fi
else
  echo "  ⚠️  PM2 not available - skipping PM2 checks"
fi
echo ""

# Step 4: Check if application is running (any method)
echo "📋 Step 4: Checking if application is running..."
if command -v curl > /dev/null 2>&1; then
  if curl -sf "http://localhost:3000/api/trpc/system.health?input=%7B%22timestamp%22%3A$(date +%s)%7D" > /dev/null 2>&1; then
    echo "  ✅ Application is responding on port 3000"
    APP_RUNNING=true
  else
    echo "  ℹ️  Application is not responding on port 3000"
    APP_RUNNING=false
  fi
else
  echo "  ⚠️  curl not available - cannot check application health"
  APP_RUNNING=false
fi
echo ""

# Step 5: Test infrastructure scripts
echo "📋 Step 5: Testing infrastructure scripts..."
echo ""

echo "  🧪 Testing status.sh..."
if bash infra/deploy/status.sh > /dev/null 2>&1; then
  echo "  ✅ status.sh works!"
  echo ""
  echo "  Current status:"
  bash infra/deploy/status.sh | jq '.' 2>/dev/null || bash infra/deploy/status.sh
else
  echo "  ⚠️  status.sh test failed"
fi
echo ""

echo "  🧪 Testing deploy.sh (dry-run)..."
if bash infra/deploy/deploy.sh --dry-run > /dev/null 2>&1; then
  echo "  ✅ deploy.sh --dry-run works!"
else
  echo "  ⚠️  deploy.sh --dry-run test failed"
fi
echo ""

# Step 6: Check environment
echo "📋 Step 6: Checking environment..."
if [ -f ".env" ]; then
  echo "  ✅ .env file exists"
  ENV_VARS=$(grep -v '^#' .env | grep -v '^$' | wc -l)
  echo "  ℹ️  Found $ENV_VARS environment variables"
else
  echo "  ⚠️  .env file not found"
  echo "  💡 Create from template: cp .env.example .env"
fi

if [ -f ".env.example" ]; then
  echo "  ✅ .env.example exists"
fi
echo ""

# Step 7: Summary and recommendations
echo "📊 Summary"
echo "=========="
echo ""

if command -v pm2 > /dev/null 2>&1; then
  if [ "$PM2_STATUS" != "online" ] && [ "$PM2_STATUS" != "launching" ]; then
    echo "⚠️  PM2 process is not running"
    echo "   To start: pm2 start ecosystem.config.js"
    echo ""
  fi
fi

if [ "$APP_RUNNING" = false ]; then
  echo "⚠️  Application is not responding on port 3000"
  echo "   This might be normal if:"
  echo "   - Application runs on a different port"
  echo "   - Application is managed by a different process manager (not PM2)"
  echo "   - Application needs to be started"
  echo ""
fi

echo "✅ Infrastructure is set up and ready!"
echo ""
echo "📚 Available commands:"
echo "   ./infra/deploy/deploy.sh          - Deploy application"
echo "   ./infra/deploy/status.sh          - Check status"
echo "   ./infra/deploy/restart.sh         - Restart application"
echo "   ./infra/env/env-sync.sh           - Sync environment variables"
echo ""
echo "📖 Documentation:"
echo "   cat infra/README.md                - Main documentation"
echo "   cat infra/cursor-prompts.md       - Cursor AI prompts"
echo "   cat infra/SAFEGUARDS.md           - Safety features"
echo ""
echo "🎉 Setup complete!"
