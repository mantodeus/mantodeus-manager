#!/usr/bin/env bash
# Local helper script to show deployment command for production
# This script prints the exact command to run on the server

echo "=========================================="
echo "🚀 PRODUCTION DEPLOYMENT"
echo "=========================================="
echo ""
echo "To deploy PRODUCTION (manager.mantodeus.com):"
echo ""
echo "  ssh mantodeus-server 'cd /srv/customer/sites/manager.mantodeus.com && bash infra/production/deploy-production.sh'"
echo ""
echo "Or SSH into the server first, then run:"
echo ""
echo "  cd /srv/customer/sites/manager.mantodeus.com"
echo "  bash infra/production/deploy-production.sh"
echo ""
echo "=========================================="

