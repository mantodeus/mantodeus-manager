#!/usr/bin/env bash
# Analyze why build failed

LOG_FILE="/srv/customer/sites/manager.mantodeus.com/build-20251229-220456.log"

echo "=== Build Failure Analysis ==="
echo ""

echo "📄 Full log contents:"
cat "$LOG_FILE"
echo ""

echo "🔍 Checking for errors..."
if grep -i "error\|fatal\|killed\|oom\|memory\|signal" "$LOG_FILE"; then
  echo ""
  echo "❌ Found error indicators above"
else
  echo "⚠️  No obvious error messages found - build may have been killed silently"
fi

echo ""
echo "💡 The build likely crashed during Vite's transformation phase."
echo "💡 This could be due to:"
echo "   1. Process killed by system (OOM killer, resource limits)"
echo "   2. SSH connection issues causing process termination"
echo "   3. Node.js memory issues despite available system memory"

