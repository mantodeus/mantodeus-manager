#!/usr/bin/env bash
# Local helper script to show deployment command for production
# This script prints the exact command to run on the server

echo "=========================================="
echo "🚀 PRODUCTION DEPLOYMENT"
echo "=========================================="
echo ""
echo "To deploy PRODUCTION (manager.mantodeus.com):"
echo ""
echo "  1. Deploy (builds the app):"
echo "     ssh mantodeus-server 'cd /srv/customer/sites/manager.mantodeus.com && bash infra/production/deploy-production.sh'"
echo ""
echo "     Or SSH into the server first, then run:"
echo "     cd /srv/customer/sites/manager.mantodeus.com"
echo "     bash infra/production/deploy-production.sh"
echo ""
echo "  Note: The deployment script builds AND restarts via PM2."
echo "        Default process name: mantodeus-manager"
echo "        Override with: PM2_APP_NAME=<name> bash infra/production/deploy-production.sh"
echo ""
echo "=========================================="

