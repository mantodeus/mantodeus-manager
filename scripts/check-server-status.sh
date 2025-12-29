#!/usr/bin/env bash
# Quick script to check server status and kill stuck processes
# Run this if you can get SSH access (even briefly)

echo "=== Server Status Check ==="
echo ""

# Check running build processes
echo "🔍 Checking for build processes..."
ps aux | grep -E "(vite|pnpm|node.*build|esbuild)" | grep -v grep || echo "No build processes found"
echo ""

# Check system resources
echo "💾 Memory usage:"
free -h 2>/dev/null || echo "free command not available"
echo ""

echo "⚙️  CPU usage (top 5 processes):"
ps aux --sort=-%cpu | head -6
echo ""

echo "📊 Disk usage:"
df -h / 2>/dev/null | tail -1
echo ""

echo "🔌 Node processes:"
ps aux | grep node | grep -v grep | head -10
echo ""

echo "📝 Recent build logs:"
ls -lth /srv/customer/sites/manager.mantodeus.com/build-*.log 2>/dev/null | head -3 || echo "No build logs found"
echo ""

echo "=== To kill stuck build processes, run: ==="
echo "pkill -f 'vite build'"
echo "pkill -f 'pnpm run build'"
echo "pkill -f 'node.*build-debug'"

