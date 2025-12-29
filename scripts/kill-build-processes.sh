#!/usr/bin/env bash
# Emergency script to kill all build processes
# Use this if the server is unresponsive due to stuck builds

echo "🛑 Killing all build processes..."

# Kill vite processes
pkill -9 -f "vite build" 2>/dev/null && echo "✅ Killed vite processes" || echo "No vite processes found"

# Kill pnpm build processes
pkill -9 -f "pnpm run build" 2>/dev/null && echo "✅ Killed pnpm build processes" || echo "No pnpm build processes found"

# Kill node build processes
pkill -9 -f "node.*build-debug" 2>/dev/null && echo "✅ Killed node build processes" || echo "No node build processes found"

# Kill esbuild processes
pkill -9 -f "esbuild" 2>/dev/null && echo "✅ Killed esbuild processes" || echo "No esbuild processes found"

# Kill any node processes using high CPU (optional - be careful!)
# Uncomment if needed:
# ps aux | grep node | awk '$3 > 50 {print $2}' | xargs kill -9 2>/dev/null

echo ""
echo "✅ Done. Server should be more responsive now."
echo "💡 Wait 30 seconds, then try SSH again."

