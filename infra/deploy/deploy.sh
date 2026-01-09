#!/bin/bash
# =============================================================================
# MANTODEUS MANAGER - DEPLOY PROXY
# =============================================================================
# This script is a proxy to the smart idempotent deploy script.
# Use scripts/deploy-prod.sh directly in the future.
# =============================================================================

set -e

APP_DIR="/srv/customer/sites/manager.mantodeus.com"
cd "$APP_DIR"

if [ -f "scripts/deploy-prod.sh" ]; then
  echo "🚀 Redirecting to smart deploy script: scripts/deploy-prod.sh"
  bash scripts/deploy-prod.sh
else
  echo "❌ scripts/deploy-prod.sh not found!"
  exit 1
fi
