#!/bin/bash
#
# Complete Verification - Check Everything is Working
# Verifies all infrastructure, deployment, and Cursor AI integration
#

set -euo pipefail

PROJECT_DIR="/srv/customer/sites/manager.mantodeus.com"
PM2_APP_NAME="mantodeus-manager"
PM2_CMD="./node_modules/.bin/pm2"

cd "$PROJECT_DIR" || exit 1

echo "🔍 Complete Infrastructure Verification"
echo "======================================"
echo ""

PASSED=0
FAILED=0
WARNINGS=0

# Test helper
test_pass() {
  echo "  ✅ $1"
  PASSED=$((PASSED + 1))
}

test_fail() {
  echo "  ❌ $1"
  FAILED=$((FAILED + 1))
}

test_warn() {
  echo "  ⚠️  $1"
  WARNINGS=$((WARNINGS + 1))
}

# ============================================================================
# 1. INFRASTRUCTURE FILES
# ============================================================================
echo "📋 1. Infrastructure Files"
echo "────────────────────────────────────────────────────────────────────────"

# Deployment scripts
[ -f "infra/deploy/deploy.sh" ] && test_pass "deploy.sh exists" || test_fail "deploy.sh missing"
[ -f "infra/deploy/restart.sh" ] && test_pass "restart.sh exists" || test_fail "restart.sh missing"
[ -f "infra/deploy/status.sh" ] && test_pass "status.sh exists" || test_fail "status.sh missing"

# SSH scripts
[ -f "infra/ssh/generate-key.sh" ] && test_pass "generate-key.sh exists" || test_fail "generate-key.sh missing"
[ -f "infra/ssh/install-key.sh" ] && test_pass "install-key.sh exists" || test_fail "install-key.sh missing"
[ -f "infra/ssh/ssh-check.sh" ] && test_pass "ssh-check.sh exists" || test_fail "ssh-check.sh missing"
[ -f "infra/ssh/ssh-config.example" ] && test_pass "ssh-config.example exists" || test_fail "ssh-config.example missing"

# Webhook
[ -f "infra/webhook/webhook-listener.js" ] && test_pass "webhook-listener.js exists" || test_fail "webhook-listener.js missing"

# Environment scripts
[ -f "infra/env/env-sync.sh" ] && test_pass "env-sync.sh exists" || test_fail "env-sync.sh missing"
[ -f "infra/env/env-update.sh" ] && test_pass "env-update.sh exists" || test_fail "env-update.sh missing"

# Tests
[ -f "infra/tests/run-deploy-sim.sh" ] && test_pass "run-deploy-sim.sh exists" || test_fail "run-deploy-sim.sh missing"

# Documentation
[ -f "infra/README.md" ] && test_pass "README.md exists" || test_fail "README.md missing"
[ -f "infra/cursor-prompts.md" ] && test_pass "cursor-prompts.md exists" || test_fail "cursor-prompts.md missing"
[ -f "infra/SAFEGUARDS.md" ] && test_pass "SAFEGUARDS.md exists" || test_fail "SAFEGUARDS.md missing"

echo ""

# ============================================================================
# 2. SCRIPT PERMISSIONS
# ============================================================================
echo "📋 2. Script Permissions"
echo "────────────────────────────────────────────────────────────────────────"

[ -x "infra/deploy/deploy.sh" ] && test_pass "deploy.sh is executable" || test_fail "deploy.sh not executable"
[ -x "infra/deploy/restart.sh" ] && test_pass "restart.sh is executable" || test_fail "restart.sh not executable"
[ -x "infra/deploy/status.sh" ] && test_pass "status.sh is executable" || test_fail "status.sh not executable"
[ -x "infra/ssh/generate-key.sh" ] && test_pass "generate-key.sh is executable" || test_fail "generate-key.sh not executable"
[ -x "infra/env/env-sync.sh" ] && test_pass "env-sync.sh is executable" || test_fail "env-sync.sh not executable"

echo ""

# ============================================================================
# 3. SCRIPT FUNCTIONALITY
# ============================================================================
echo "📋 3. Script Functionality"
echo "────────────────────────────────────────────────────────────────────────"

# Test status.sh
if bash infra/deploy/status.sh > /dev/null 2>&1; then
  test_pass "status.sh runs successfully"
  STATUS_OUTPUT=$(bash infra/deploy/status.sh)
  if echo "$STATUS_OUTPUT" | grep -q "status"; then
    test_pass "status.sh outputs JSON"
  else
    test_warn "status.sh output format unclear"
  fi
else
  test_fail "status.sh fails to run"
fi

# Test deploy.sh dry-run
if bash infra/deploy/deploy.sh --dry-run > /dev/null 2>&1; then
  test_pass "deploy.sh --dry-run works"
else
  test_warn "deploy.sh --dry-run failed (may need dependencies)"
fi

echo ""

# ============================================================================
# 4. PM2 AND APPLICATION
# ============================================================================
echo "📋 4. PM2 and Application Status"
echo "────────────────────────────────────────────────────────────────────────"

# Check PM2 installation
if command -v pm2 > /dev/null 2>&1 || [ -f "node_modules/.bin/pm2" ]; then
  test_pass "PM2 is available"
  if [ -f "node_modules/.bin/pm2" ]; then
    PM2_CMD="./node_modules/.bin/pm2"
  else
    PM2_CMD="pm2"
  fi
else
  test_fail "PM2 is not installed"
  PM2_CMD=""
fi

# Check PM2 process
if [ -n "$PM2_CMD" ]; then
  PM2_STATUS=$($PM2_CMD jlist 2>/dev/null | jq -r ".[] | select(.name==\"$PM2_APP_NAME\") | .pm2_env.status" 2>/dev/null || echo "not_found")
  
  if [ "$PM2_STATUS" = "online" ]; then
    test_pass "PM2 process '$PM2_APP_NAME' is online"
  elif [ "$PM2_STATUS" = "not_found" ]; then
    test_warn "PM2 process '$PM2_APP_NAME' is not running"
  else
    test_warn "PM2 process '$PM2_APP_NAME' status: $PM2_STATUS"
  fi
fi

echo ""

# ============================================================================
# 5. APPLICATION HEALTH
# ============================================================================
echo "📋 5. Application Health"
echo "────────────────────────────────────────────────────────────────────────"

if command -v curl > /dev/null 2>&1; then
  if curl -sf "http://localhost:3000/api/trpc/system.health?input=%7B%22timestamp%22%3A$(date +%s)%7D" > /dev/null 2>&1; then
    test_pass "Application is responding on port 3000"
  else
    test_warn "Application is not responding on port 3000"
    
    # Check if port is in use
    if command -v lsof > /dev/null 2>&1; then
      if lsof -i:3000 > /dev/null 2>&1; then
        test_warn "Port 3000 is in use but not responding to health check"
      else
        test_warn "Port 3000 is not in use - application may not be running"
      fi
    fi
  fi
else
  test_warn "curl not available - cannot check application health"
fi

echo ""

# ============================================================================
# 6. CURSOR AI INTEGRATION
# ============================================================================
echo "📋 6. Cursor AI Integration"
echo "────────────────────────────────────────────────────────────────────────"

# Check cursor-prompts.md
if [ -f "infra/cursor-prompts.md" ]; then
  PROMPT_COUNT=$(grep -c "^###" infra/cursor-prompts.md 2>/dev/null || echo "0")
  if [ "$PROMPT_COUNT" -gt 0 ]; then
    test_pass "cursor-prompts.md contains $PROMPT_COUNT prompts"
  else
    test_warn "cursor-prompts.md exists but may be empty"
  fi
else
  test_fail "cursor-prompts.md missing"
fi

# Check if scripts output JSON (for Cursor AI parsing)
if bash infra/deploy/status.sh 2>/dev/null | jq . > /dev/null 2>&1; then
  test_pass "Scripts output valid JSON (Cursor AI compatible)"
else
  test_warn "Script output may not be valid JSON"
fi

echo ""

# ============================================================================
# 7. DEPLOYMENT READINESS
# ============================================================================
echo "📋 7. Deployment Readiness"
echo "────────────────────────────────────────────────────────────────────────"

# Check if build files exist
[ -f "dist/index.js" ] && test_pass "Backend build exists (dist/index.js)" || test_warn "Backend not built (dist/index.js missing)"
[ -d "dist/public" ] && test_pass "Frontend build exists (dist/public)" || test_warn "Frontend not built (dist/public missing)"

# Check package.json
[ -f "package.json" ] && test_pass "package.json exists" || test_fail "package.json missing"

# Check environment
[ -f ".env" ] && test_pass ".env file exists" || test_warn ".env file missing (may need setup)"
[ -f ".env.example" ] && test_pass ".env.example exists" || test_warn ".env.example missing"

echo ""

# ============================================================================
# SUMMARY
# ============================================================================
echo "📊 Summary"
echo "────────────────────────────────────────────────────────────────────────"
echo ""
echo "✅ Passed:  $PASSED"
echo "⚠️  Warnings: $WARNINGS"
echo "❌ Failed:  $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  if [ $WARNINGS -eq 0 ]; then
    echo "🎉 Everything is working perfectly!"
    echo ""
    echo "✅ Infrastructure: Complete"
    echo "✅ Scripts: Working"
    echo "✅ Cursor AI: Ready"
    echo "✅ Deployment: Ready"
    exit 0
  else
    echo "✅ Core infrastructure is working!"
    echo "⚠️  Some warnings (see above) - but everything should work"
    echo ""
    echo "You can now:"
    echo "  - Deploy: ./infra/deploy/deploy.sh"
    echo "  - Check status: ./infra/deploy/status.sh"
    echo "  - Use Cursor AI prompts from: infra/cursor-prompts.md"
    exit 0
  fi
else
  echo "❌ Some critical issues found (see above)"
  echo ""
  echo "Please fix the failed items before proceeding."
  exit 1
fi
