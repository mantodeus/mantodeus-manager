#!/bin/bash
#
# Mantodeus Manager - Environment Update Script
# Safely updates environment variables (never echoes secrets)
#
# Usage:
#   ./env-update.sh VARIABLE_NAME "value"
#   ./env-update.sh DATABASE_URL "mysql://user:pass@host/db"
#

set -euo pipefail

PROJECT_DIR="/srv/customer/sites/manager.mantodeus.com"
ENV_FILE="${PROJECT_DIR}/.env"
BACKUP_DIR="${PROJECT_DIR}/backups"

# Safety check: Don't run as root
if [ "$(id -u)" -eq 0 ]; then
  echo "ERROR: This script should NOT be run as root" >&2
  exit 1
fi

# Check arguments
if [ $# -lt 2 ]; then
  echo "Usage: $0 VARIABLE_NAME \"value\""
  echo "Example: $0 DATABASE_URL \"mysql://user:pass@host/db\""
  exit 1
fi

VAR_NAME="$1"
VAR_VALUE="$2"

# Validate variable name
if ! [[ "$VAR_NAME" =~ ^[A-Z_][A-Z0-9_]*$ ]]; then
  echo "ERROR: Invalid variable name: $VAR_NAME" >&2
  echo "Variable names must be uppercase letters, numbers, and underscores only"
  exit 1
fi

cd "$PROJECT_DIR" || exit 1

# Create backup
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="${BACKUP_DIR}/.env.backup-$(date +%Y%m%d-%H%M%S)"
cp "$ENV_FILE" "$BACKUP_FILE" 2>/dev/null || true

# Check if variable exists
if grep -q "^${VAR_NAME}=" "$ENV_FILE" 2>/dev/null; then
  # Update existing variable
  # Use a temporary file to avoid issues with special characters
  sed "s|^${VAR_NAME}=.*|${VAR_NAME}=${VAR_VALUE}|" "$ENV_FILE" > "${ENV_FILE}.tmp"
  mv "${ENV_FILE}.tmp" "$ENV_FILE"
  echo "✅ Updated ${VAR_NAME}"
else
  # Add new variable
  echo "" >> "$ENV_FILE"
  echo "# Updated by env-update.sh" >> "$ENV_FILE"
  echo "${VAR_NAME}=${VAR_VALUE}" >> "$ENV_FILE"
  echo "✅ Added ${VAR_NAME}"
fi

# Never echo the value (security)
echo "⚠️  Variable updated. Backup saved to: $(basename "$BACKUP_FILE")"
echo "💡 Restart the application for changes to take effect"
