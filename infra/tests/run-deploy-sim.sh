#!/bin/bash
#
# Mantodeus Manager - Deployment Simulation Tests
# Tests deployment scripts without actually deploying
#
# Usage:
#   ./run-deploy-sim.sh
#

set -euo pipefail

PROJECT_DIR="/srv/customer/sites/manager.mantodeus.com"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")/deploy"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Test helper
run_test() {
  local test_name="$1"
  local command="$2"
  
  echo -e "${YELLOW}Testing: $test_name${NC}"
  
  if eval "$command" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS: $test_name${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  else
    echo -e "${RED}❌ FAIL: $test_name${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi
}

echo "🧪 Running Deployment Simulation Tests"
echo "========================================"
echo ""

# Test 1: Check if scripts exist
run_test "deploy.sh exists" "[ -f '$DEPLOY_DIR/deploy.sh' ]"
run_test "restart.sh exists" "[ -f '$DEPLOY_DIR/restart.sh' ]"
run_test "status.sh exists" "[ -f '$DEPLOY_DIR/status.sh' ]"

# Test 2: Check script permissions
run_test "deploy.sh is executable" "[ -x '$DEPLOY_DIR/deploy.sh' ]"
run_test "restart.sh is executable" "[ -x '$DEPLOY_DIR/restart.sh' ]"
run_test "status.sh is executable" "[ -x '$DEPLOY_DIR/status.sh' ]"

# Test 3: Check script syntax
run_test "deploy.sh syntax valid" "bash -n '$DEPLOY_DIR/deploy.sh'"
run_test "restart.sh syntax valid" "bash -n '$DEPLOY_DIR/restart.sh'"
run_test "status.sh syntax valid" "bash -n '$DEPLOY_DIR/status.sh'"

# Test 4: Check for required commands
run_test "git command available" "command -v git > /dev/null"
run_test "npm command available" "command -v npm > /dev/null"
run_test "pm2 command available" "command -v pm2 > /dev/null"
run_test "curl command available" "command -v curl > /dev/null"
run_test "jq command available" "command -v jq > /dev/null"

# Test 5: Check project directory
if [ -d "$PROJECT_DIR" ]; then
  run_test "Project directory exists" "true"
  run_test "Project directory is readable" "[ -r '$PROJECT_DIR' ]"
  run_test "Project directory is writable" "[ -w '$PROJECT_DIR' ]"
else
  echo -e "${YELLOW}⚠️  Project directory not found: $PROJECT_DIR${NC}"
  echo -e "${YELLOW}   (This is expected if running on local machine)${NC}"
fi

# Test 6: Deploy script presence (if project directory exists)
if [ -d "$PROJECT_DIR" ]; then
  if [ -f "$PROJECT_DIR/scripts/deploy.sh" ]; then
    echo -e "${GREEN}✅ PASS: scripts/deploy.sh present${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}❌ FAIL: scripts/deploy.sh missing${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
fi

# Summary
echo ""
echo "========================================"
echo "📊 Test Summary"
echo "========================================"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
  echo -e "${RED}Failed: $TESTS_FAILED${NC}"
else
  echo -e "${GREEN}Failed: $TESTS_FAILED${NC}"
fi
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some tests failed${NC}"
  exit 1
fi
