#!/bin/bash
#
# Mantodeus Manager - Environment Sync Script
# Syncs .env file with .env.example, preserving existing values
#
# Usage:
#   ./env-sync.sh
#

set -euo pipefail

PROJECT_DIR="/srv/customer/sites/manager.mantodeus.com"
ENV_FILE="${PROJECT_DIR}/.env"
ENV_EXAMPLE="${PROJECT_DIR}/.env.example"

# Safety check: Don't run as root
if [ "$(id -u)" -eq 0 ]; then
  echo "ERROR: This script should NOT be run as root" >&2
  exit 1
fi

# Check if .env.example exists
if [ ! -f "$ENV_EXAMPLE" ]; then
  echo "ERROR: .env.example not found: $ENV_EXAMPLE" >&2
  exit 1
fi

cd "$PROJECT_DIR" || exit 1

# Create .env from .env.example if it doesn't exist
if [ ! -f "$ENV_FILE" ]; then
  echo "Creating .env from .env.example..."
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  echo "✅ Created .env file"
  echo "⚠️  Please update .env with your actual values"
  exit 0
fi

# Sync: Add missing variables from .env.example
echo "Syncing .env with .env.example..."

MISSING_VARS=0

while IFS='=' read -r key value; do
  # Skip comments and empty lines
  [[ "$key" =~ ^#.*$ ]] && continue
  [[ -z "$key" ]] && continue
  
  # Check if variable exists in .env
  if ! grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    echo "  + Adding missing variable: $key"
    echo "" >> "$ENV_FILE"
    echo "# Added by env-sync.sh" >> "$ENV_FILE"
    echo "${key}=${value}" >> "$ENV_FILE"
    MISSING_VARS=$((MISSING_VARS + 1))
  fi
done < <(grep -v '^#' "$ENV_EXAMPLE" | grep -v '^$' | grep '=')

if [ $MISSING_VARS -eq 0 ]; then
  echo "✅ .env is already in sync with .env.example"
else
  echo "✅ Added $MISSING_VARS missing variable(s) to .env"
  echo "⚠️  Please review and update the new variables with your actual values"
fi
