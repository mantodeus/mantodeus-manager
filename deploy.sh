#!/bin/bash

# ============================================
# PRODUCTION DEPLOYMENT SCRIPT
# ============================================
# This script is for PRODUCTION deployment only.
# It should be run on the production server (e.g., Infomaniak).
# 
# DO NOT run this during local development.
# ============================================

set -e  # Exit on any error

echo "============================================"
echo "Starting Production Deployment"
echo "============================================"

# Configuration
APP_PATH="${APP_PATH:-/srv/customer/sites/manager.mantodeus.com}"
PM2_APP_NAME="${PM2_APP_NAME:-mantodeus-manager}"
NODE_ENV="${NODE_ENV:-production}"

echo "App Path: $APP_PATH"
echo "PM2 App Name: $PM2_APP_NAME"
echo "Node Environment: $NODE_ENV"

# Navigate to app directory
cd "$APP_PATH" || {
  echo "ERROR: Cannot navigate to $APP_PATH"
  exit 1
}

echo ""
echo "Step 1: Pulling latest code from GitHub..."
git pull origin main || git pull origin master || {
  echo "ERROR: Git pull failed"
  exit 1
}

echo ""
echo "Step 2: Installing production dependencies..."
npm install --omit=dev || {
  echo "ERROR: npm install failed"
  exit 1
}

echo ""
echo "Step 3: Building application..."
npm run build || {
  echo "ERROR: Build failed"
  exit 1
}

echo ""
echo "Step 4: Restarting application with PM2..."
if command -v pm2 &> /dev/null; then
  npx pm2 restart "$PM2_APP_NAME" || {
    echo "ERROR: PM2 restart failed"
    exit 1
  }
  echo "Application restarted successfully!"
else
  echo "WARNING: PM2 not found. Skipping restart."
  echo "Please restart the application manually."
fi

echo ""
echo "============================================"
echo "Deployment Complete!"
echo "============================================"
echo "Application should now be running with the latest code."
echo ""
echo "To check logs:"
echo "  pm2 logs $PM2_APP_NAME"
echo ""
echo "To check status:"
echo "  pm2 status"
echo ""

