#!/usr/bin/env bash
# Script to fix drizzle metadata files on the server
# This updates all metadata files from mysql to postgresql dialect

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
META_DIR="$PROJECT_DIR/drizzle/meta"

echo "🔧 Fixing Drizzle metadata files..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ! -d "$META_DIR" ]; then
  echo "❌ Error: drizzle/meta directory not found at $META_DIR"
  exit 1
fi

# Update _journal.json
if [ -f "$META_DIR/_journal.json" ]; then
  echo "📝 Updating _journal.json..."
  if command -v sed >/dev/null 2>&1; then
    sed -i.bak 's/"dialect": "mysql"/"dialect": "postgresql"/g' "$META_DIR/_journal.json"
    echo "✅ Updated _journal.json"
  else
    echo "⚠️  sed not available, skipping _journal.json (use manual edit)"
  fi
fi

# Update all snapshot files
echo "📝 Updating snapshot files..."
for snapshot in "$META_DIR"/[0-9]*_snapshot.json; do
  if [ -f "$snapshot" ]; then
    if command -v sed >/dev/null 2>&1; then
      sed -i.bak 's/"dialect": "mysql"/"dialect": "postgresql"/g' "$snapshot"
      echo "✅ Updated $(basename "$snapshot")"
    else
      echo "⚠️  sed not available, skipping $(basename "$snapshot") (use manual edit)"
    fi
  fi
done

# Verify changes
echo ""
echo "🔍 Verifying changes..."
if grep -q '"dialect": "mysql"' "$META_DIR"/*.json 2>/dev/null; then
  echo "❌ Warning: Some files still contain 'mysql' dialect"
  grep -l '"dialect": "mysql"' "$META_DIR"/*.json 2>/dev/null || true
else
  echo "✅ All metadata files now use 'postgresql' dialect"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Done! You can now run: npm run db:push"

