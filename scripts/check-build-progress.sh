#!/usr/bin/env bash
# Check if build is still running and making progress

LOG_FILE="/srv/customer/sites/manager.mantodeus.com/build-20251229-220456.log"

echo "=== Build Status Check ==="
echo ""

# Check if build process is running
echo "🔍 Checking for running build processes..."
BUILD_PIDS=$(ps aux | grep -E "(vite|pnpm.*build|node.*build-debug)" | grep -v grep | awk '{print $2}')
if [ -z "$BUILD_PIDS" ]; then
  echo "❌ No build processes found - build may have completed or crashed"
else
  echo "✅ Build process(es) running: $BUILD_PIDS"
  echo ""
  echo "📊 Process details:"
  ps aux | grep -E "(vite|pnpm.*build|node.*build-debug)" | grep -v grep
fi

echo ""
echo "📝 Log file size and last update:"
if [ -f "$LOG_FILE" ]; then
  ls -lh "$LOG_FILE"
  echo ""
  echo "Last 10 lines of log:"
  tail -10 "$LOG_FILE"
  echo ""
  echo "Checking if log is growing (wait 10 seconds and run again to compare)..."
else
  echo "❌ Log file not found: $LOG_FILE"
fi

echo ""
echo "💾 System resources:"
echo "Memory:"
free -h 2>/dev/null || echo "free command not available"
echo ""
echo "CPU (top processes):"
ps aux --sort=-%cpu | head -6

echo ""
echo "=== To monitor in real-time: ==="
echo "tail -f $LOG_FILE"

