#!/bin/bash
#
# Mantodeus Manager - SSH Connection Check Script
# Tests SSH connection and verifies server configuration
#
# Usage:
#   ./ssh-check.sh [ssh-host-alias]
#   ./ssh-check.sh mantodeus-server
#

set -euo pipefail

SSH_HOST="${1:-mantodeus-server}"
PROJECT_DIR="/srv/customer/sites/manager.mantodeus.com"

# Output JSON helper
json_output() {
  echo "$1"
}

# Test SSH connection
START_TIME=$(date +%s)
if ssh -o ConnectTimeout=10 -o BatchMode=yes "$SSH_HOST" "echo 'connected'" > /dev/null 2>&1; then
  END_TIME=$(date +%s)
  CONNECTION_TIME=$((END_TIME - START_TIME))
  CONNECTION_STATUS="success"
else
  CONNECTION_STATUS="failed"
  CONNECTION_TIME=0
fi

if [ "$CONNECTION_STATUS" = "failed" ]; then
  json_output "{
    \"connection_status\": \"failed\",
    \"error\": \"SSH connection failed. Check SSH config and server accessibility.\",
    \"ssh_host\": \"$SSH_HOST\"
  }"
  exit 1
fi

# Check project directory
PROJECT_DIR_EXISTS="false"
if ssh "$SSH_HOST" "[ -d '$PROJECT_DIR' ]" 2>/dev/null; then
  PROJECT_DIR_EXISTS="true"
fi

# Check if infra scripts exist
INFRA_SCRIPTS_EXIST="false"
if ssh "$SSH_HOST" "[ -f '$PROJECT_DIR/infra/deploy/deploy.sh' ]" 2>/dev/null; then
  INFRA_SCRIPTS_EXIST="true"
fi

# Check PM2
PM2_INSTALLED="false"
if ssh "$SSH_HOST" "command -v pm2 > /dev/null 2>&1" 2>/dev/null; then
  PM2_INSTALLED="true"
fi

# Check Node.js
NODE_VERSION=$(ssh "$SSH_HOST" "node --version 2>/dev/null || echo 'not_installed'" 2>/dev/null || echo "unknown")

# Check npm
NPM_VERSION=$(ssh "$SSH_HOST" "npm --version 2>/dev/null || echo 'not_installed'" 2>/dev/null || echo "unknown")

# Output JSON
json_output "{
  \"connection_status\": \"$CONNECTION_STATUS\",
  \"connection_time_seconds\": \"$CONNECTION_TIME\",
  \"ssh_host\": \"$SSH_HOST\",
  \"project_dir_exists\": \"$PROJECT_DIR_EXISTS\",
  \"project_dir\": \"$PROJECT_DIR\",
  \"infra_scripts_exist\": \"$INFRA_SCRIPTS_EXIST\",
  \"pm2_installed\": \"$PM2_INSTALLED\",
  \"node_version\": \"$NODE_VERSION\",
  \"npm_version\": \"$NPM_VERSION\"
}"
