#!/bin/bash
#
# Mantodeus Manager - Status Check Script
# Comprehensive health monitoring and status reporting
#
# Usage:
#   ./status.sh
#
# Output: JSON format for programmatic parsing
#

set -euo pipefail

# Configuration
PROJECT_DIR="/srv/customer/sites/manager.mantodeus.com"
PM2_APP_NAME="mantodeus-manager"
HEALTH_CHECK_URL="http://localhost:3000/api/trpc/system.health"

# Safety check: Don't run as root
if [ "$(id -u)" -eq 0 ]; then
  echo "{\"error\":\"This script should NOT be run as root\"}" >&2
  exit 1
fi

# Output JSON helper
json_output() {
  echo "$1"
}

# Error handler
error_exit() {
  json_output "{\"status\":\"error\",\"error\":\"$1\"}"
  exit 1
}

# Check if project directory exists
if [ ! -d "$PROJECT_DIR" ]; then
  error_exit "Project directory not found: $PROJECT_DIR"
fi

cd "$PROJECT_DIR" || error_exit "Failed to change to project directory"

# Check PM2 status
PM2_STATUS=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name==\"$PM2_APP_NAME\") | .pm2_env.status" 2>/dev/null || echo "unknown")

if [ "$PM2_STATUS" = "unknown" ] || [ -z "$PM2_STATUS" ]; then
  json_output "{\"status\":\"offline\",\"pm2_status\":\"not_running\",\"error\":\"PM2 process not found\"}"
  exit 0
fi

# Get PM2 details
PM2_INFO=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name==\"$PM2_APP_NAME\")" 2>/dev/null || echo "{}")

# Extract information
UPTIME=$(echo "$PM2_INFO" | jq -r '.pm2_env.pm_uptime // 0')
MEMORY=$(echo "$PM2_INFO" | jq -r '.monit.memory // 0')
CPU=$(echo "$PM2_INFO" | jq -r '.monit.cpu // 0')
RESTARTS=$(echo "$PM2_INFO" | jq -r '.pm2_env.restart_time // 0')

# Calculate human-readable uptime
if [ "$UPTIME" -gt 0 ]; then
  UPTIME_SECONDS=$((UPTIME / 1000))
  DAYS=$((UPTIME_SECONDS / 86400))
  HOURS=$(((UPTIME_SECONDS % 86400) / 3600))
  MINUTES=$(((UPTIME_SECONDS % 3600) / 60))
  UPTIME_HUMAN="${DAYS}d ${HOURS}h ${MINUTES}m"
else
  UPTIME_HUMAN="0m"
fi

# Convert memory to MB
MEMORY_MB=$(awk "BEGIN {printf \"%.2f\", $MEMORY / 1024 / 1024}")

# Get Git information
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
GIT_STATUS=$(git status --porcelain 2>/dev/null | wc -l)

# Health check
HEALTH_STATUS="unknown"
if curl -sf "${HEALTH_CHECK_URL}?input=%7B%22timestamp%22%3A$(date +%s)%7D" > /dev/null 2>&1; then
  HEALTH_STATUS="healthy"
else
  HEALTH_STATUS="unhealthy"
fi

# Determine overall status
if [ "$PM2_STATUS" = "online" ] && [ "$HEALTH_STATUS" = "healthy" ]; then
  OVERALL_STATUS="online"
else
  OVERALL_STATUS="degraded"
fi

# Output JSON
json_output "{
  \"status\": \"$OVERALL_STATUS\",
  \"pm2_status\": \"$PM2_STATUS\",
  \"health\": \"$HEALTH_STATUS\",
  \"uptime_seconds\": $UPTIME_SECONDS,
  \"uptime_human\": \"$UPTIME_HUMAN\",
  \"memory_mb\": \"$MEMORY_MB\",
  \"cpu_percent\": \"$CPU\",
  \"restarts\": $RESTARTS,
  \"git_commit\": \"$GIT_COMMIT\",
  \"git_branch\": \"$GIT_BRANCH\",
  \"git_uncommitted_changes\": $GIT_STATUS
}"
