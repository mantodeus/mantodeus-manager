#!/usr/bin/env bash
# Check build result and status

LOG_FILE="/srv/customer/sites/manager.mantodeus.com/build-20251229-220456.log"

echo "=== Build Result Check ==="
echo ""

if [ ! -f "$LOG_FILE" ]; then
  echo "❌ Log file not found: $LOG_FILE"
  exit 1
fi

echo "📝 Log file info:"
ls -lh "$LOG_FILE"
echo ""

echo "📄 Last 30 lines of log:"
echo "---"
tail -30 "$LOG_FILE"
echo "---"
echo ""

# Check for success indicators
if grep -q "BUILD COMPLETED SUCCESSFULLY\|Build completed successfully\|dist/public/assets" "$LOG_FILE"; then
  echo "✅ Build appears to have completed successfully!"
  echo ""
  echo "Checking build output..."
  if [ -d "/srv/customer/sites/manager.mantodeus.com/dist/public/assets" ]; then
    echo "✅ Build output found at dist/public/assets"
    ls -lh /srv/customer/sites/manager.mantodeus.com/dist/public/assets | head -5
  else
    echo "❌ Build output not found"
  fi
elif grep -q "FATAL\|ERROR\|failed\|exit code" "$LOG_FILE"; then
  echo "❌ Build appears to have failed"
  echo ""
  echo "Error details:"
  grep -i "error\|fatal\|failed" "$LOG_FILE" | tail -10
else
  echo "⚠️  Build status unclear - check log above"
fi

echo ""
echo "🔍 Checking for any running Node processes:"
ps aux | grep node | grep -v grep | head -5 || echo "No Node processes running"

