#!/bin/bash
#
# Mantodeus Manager - Safe Restart Script
# Restarts the application with automatic rollback on failure
#
# Usage:
#   ./restart.sh [--rollback] [--backup-file=backup-YYYYMMDD-HHMMSS.tar.gz]
#
# Output: JSON format for programmatic parsing
#

set -euo pipefail

# Configuration
PROJECT_DIR="/srv/customer/sites/manager.mantodeus.com"
PM2_APP_NAME="mantodeus-manager"
BACKUP_DIR="${PROJECT_DIR}/backups"
HEALTH_CHECK_URL="http://localhost:3000/api/trpc/system.health"
HEALTH_CHECK_RETRIES=5
HEALTH_CHECK_DELAY=3

# Flags
ROLLBACK=false
BACKUP_FILE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --rollback)
      ROLLBACK=true
      shift
      ;;
    --backup-file=*)
      BACKUP_FILE="${1#*=}"
      ROLLBACK=true
      shift
      ;;
    *)
      echo "{\"error\":\"Unknown option: $1\"}" >&2
      exit 1
      ;;
  esac
done

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

# Rollback function
rollback() {
  local backup_file="$1"
  
  if [ ! -f "$backup_file" ]; then
    error_exit "Backup file not found: $backup_file"
  fi
  
  json_output "{\"action\":\"rollback\",\"status\":\"starting\",\"backup_file\":\"$backup_file\"}"
  
  # Stop PM2
  pm2 stop "$PM2_APP_NAME" || true
  
  # Extract backup
  tar -xzf "$backup_file" || error_exit "Failed to extract backup"
  
  # Restart PM2
  pm2 restart "$PM2_APP_NAME" || error_exit "Failed to restart PM2 after rollback"
  
  json_output "{\"action\":\"rollback\",\"status\":\"success\",\"backup_file\":\"$backup_file\"}"
}

# If rollback requested
if [ "$ROLLBACK" = true ]; then
  if [ -z "$BACKUP_FILE" ]; then
    # Find latest backup
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/backup-*.tar.gz 2>/dev/null | head -n 1)
    if [ -z "$LATEST_BACKUP" ]; then
      error_exit "No backup file found for rollback"
    fi
    BACKUP_FILE="$LATEST_BACKUP"
  else
    # Use provided backup file (ensure it's absolute path)
    if [[ ! "$BACKUP_FILE" = /* ]]; then
      BACKUP_FILE="${BACKUP_DIR}/${BACKUP_FILE}"
    fi
  fi
  
  rollback "$BACKUP_FILE"
  exit 0
fi

# Normal restart with backup
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="${BACKUP_DIR}/backup-$(date +%Y%m%d-%H%M%S).tar.gz"

json_output "{\"action\":\"restart\",\"status\":\"creating_backup\"}"

# Create backup before restart
tar -czf "$BACKUP_FILE" \
  dist/ node_modules/ package-lock.json .env 2>/dev/null || true

json_output "{\"action\":\"restart\",\"status\":\"restarting\"}"

# Restart PM2
if pm2 restart "$PM2_APP_NAME"; then
  json_output "{\"action\":\"restart\",\"status\":\"restarted\"}"
else
  json_output "{\"action\":\"restart\",\"status\":\"failed\",\"rollback_available\":\"$BACKUP_FILE\"}"
  error_exit "PM2 restart failed. Use --rollback to restore from backup."
fi

# Health check
json_output "{\"action\":\"restart\",\"status\":\"checking_health\"}"

HEALTH_OK=false
for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
  sleep $HEALTH_CHECK_DELAY
  if curl -sf "${HEALTH_CHECK_URL}?input=%7B%22timestamp%22%3A$(date +%s)%7D" > /dev/null 2>&1; then
    HEALTH_OK=true
    break
  fi
done

if [ "$HEALTH_OK" = true ]; then
  json_output "{\"status\":\"success\",\"action\":\"restart\",\"restart\":\"success\",\"health\":\"healthy\",\"backup_file\":\"$BACKUP_FILE\"}"
else
  json_output "{\"status\":\"warning\",\"action\":\"restart\",\"restart\":\"success\",\"health\":\"unhealthy\",\"rollback_available\":\"$BACKUP_FILE\"}"
  error_exit "Application restarted but health check failed. Consider rolling back."
fi
