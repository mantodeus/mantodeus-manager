#!/bin/bash
# Quick script to check server logs for expense-related errors

echo "=== Checking PM2 Logs for Expense Errors ==="
echo ""
echo "Recent logs (last 200 lines):"
npx pm2 logs mantodeus-manager --lines 200 --nostream | grep -i "expense\|scanreceipt\|error" | tail -50

echo ""
echo "=== To view live logs, run: ==="
echo "npx pm2 logs mantodeus-manager --lines 200"
echo ""
echo "=== To filter for expense errors only: ==="
echo "npx pm2 logs mantodeus-manager --lines 200 | grep -i '\[Expenses\]'"
echo ""
echo "=== To see all recent errors: ==="
echo "npx pm2 logs mantodeus-manager --lines 500 | grep -i error"
