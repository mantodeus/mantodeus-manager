#!/usr/bin/env bash
# Local helper script to show deployment command for preview
# This script prints the exact command to run on the server

echo "=========================================="
echo "🚀 PREVIEW DEPLOYMENT"
echo "=========================================="
echo ""
echo "To deploy PREVIEW (nc9eti4he7h.preview.hosting-ik.com):"
echo ""
echo "  ssh mantodeus-server 'cd /srv/customer/sites/manager-preview.mantodeus.com && bash infra/preview/deploy-preview.sh'"
echo ""
echo "Or SSH into the server first, then run:"
echo ""
echo "  cd /srv/customer/sites/manager-preview.mantodeus.com"
echo "  bash infra/preview/deploy-preview.sh"
echo ""
echo "Note: Preview uses the 'main' branch by default."
echo "To use a different branch, set PREVIEW_BRANCH env var:"
echo ""
echo "  PREVIEW_BRANCH=develop bash infra/preview/deploy-preview.sh"
echo ""
echo "=========================================="

