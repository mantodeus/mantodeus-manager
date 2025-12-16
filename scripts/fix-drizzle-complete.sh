#!/usr/bin/env bash
# Complete fix for drizzle-kit PostgreSQL migration issue
# This script fixes the metadata and creates a fresh journal

set -euo pipefail

echo "🔧 Complete Drizzle-Kit PostgreSQL Fix"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 1: Create fresh _journal.json
echo "📝 Step 1: Creating fresh _journal.json..."
mkdir -p drizzle/meta
cat > drizzle/meta/_journal.json << 'EOF'
{
  "version": "7",
  "dialect": "postgresql",
  "entries": []
}
EOF
echo "✅ Created fresh _journal.json"

# Step 2: Verify DATABASE_URL format
echo ""
echo "🔍 Step 2: Verifying DATABASE_URL..."
if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ ERROR: DATABASE_URL is not set"
  exit 1
fi

if [[ "$DATABASE_URL" =~ ^postgres ]]; then
  echo "✅ DATABASE_URL is PostgreSQL format"
else
  echo "❌ ERROR: DATABASE_URL does not start with 'postgres'"
  echo "   Current: ${DATABASE_URL:0:20}..."
  exit 1
fi

# Step 3: Verify drizzle.config.ts
echo ""
echo "🔍 Step 3: Verifying drizzle.config.ts..."
if grep -q '"dialect": "postgresql"' drizzle.config.ts 2>/dev/null || grep -q "dialect: \"postgresql\"" drizzle.config.ts 2>/dev/null || grep -q "dialect: 'postgresql'" drizzle.config.ts 2>/dev/null; then
  echo "✅ drizzle.config.ts has PostgreSQL dialect"
else
  echo "❌ ERROR: drizzle.config.ts does not specify PostgreSQL dialect"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup complete! Now try:"
echo "   npm run db:push-direct  (uses drizzle-kit push)"
echo "   OR"
echo "   npx drizzle-kit push    (bypasses migration metadata)"

