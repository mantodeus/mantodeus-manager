#!/usr/bin/env bash
# Script to reset drizzle metadata files
# This deletes old metadata and lets drizzle-kit regenerate from schema

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
META_DIR="$PROJECT_DIR/drizzle/meta"

echo "🔄 Resetting Drizzle metadata files..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ! -d "$META_DIR" ]; then
  echo "❌ Error: drizzle/meta directory not found at $META_DIR"
  exit 1
fi

# Backup metadata directory
if [ -d "$META_DIR" ] && [ "$(ls -A "$META_DIR" 2>/dev/null)" ]; then
  echo "📦 Creating backup..."
  BACKUP_DIR="${META_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
  cp -r "$META_DIR" "$BACKUP_DIR"
  echo "✅ Backup created at: $BACKUP_DIR"
fi

# Delete all JSON files in meta directory (but keep the directory structure)
echo "🗑️  Removing old metadata files..."
find "$META_DIR" -name "*.json" -type f -delete
echo "✅ Old metadata files removed"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Done! Now run: npm run db:push"
echo "   This will regenerate metadata files from your PostgreSQL schema."

