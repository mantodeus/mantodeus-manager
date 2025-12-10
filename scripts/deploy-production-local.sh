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
echo "  2. ⚠️  IMPORTANT: Restart in Infomaniak control panel:"
echo "     - Log into Infomaniak → Node.js Applications"
echo "     - Find: manager.mantodeus.com"
echo "     - Click: 'Restart Application'"
echo ""
echo "  Note: The deployment script only builds - it does NOT start the server."
echo "        Infomaniak manages the server process exclusively."
echo ""
echo "=========================================="

