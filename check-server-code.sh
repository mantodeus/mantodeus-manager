#!/bin/bash
# Diagnostic script to check what code is actually on the server

echo "=========================================="
echo "🔍 CHECKING SERVER CODE"
echo "=========================================="
echo ""

cd /srv/customer/sites/manager.mantodeus.com

echo "📂 Current directory:"
pwd
echo ""

echo "📅 Git status:"
git status --short
echo ""

echo "📥 Latest commit:"
git log -1 --oneline
echo ""

echo "🔍 Checking source code for 'userId' (should NOT find it in db.ts):"
if grep -n "userId" server/db.ts 2>/dev/null | grep -v "getUserBySupabaseId\|getContactsByUser\|getInvoicesByUser\|getNotesByUser\|getLocationsByUser" | head -5; then
    echo "⚠️  WARNING: Found 'userId' in source code!"
else
    echo "✅ No 'userId' found in source code (good!)"
fi
echo ""

echo "🔍 Checking source code for 'supabaseId' (should find it):"
if grep -q "supabaseId" server/db.ts 2>/dev/null; then
    echo "✅ Found 'supabaseId' in source code (correct!)"
    grep -n "supabaseId" server/db.ts | head -3
else
    echo "❌ ERROR: 'supabaseId' NOT found in source code!"
fi
echo ""

echo "🔍 Checking schema for 'supabaseId':"
if grep -q "supabaseId" drizzle/schema.ts 2>/dev/null; then
    echo "✅ Found 'supabaseId' in schema (correct!)"
else
    echo "❌ ERROR: 'supabaseId' NOT found in schema!"
fi
echo ""

echo "🔍 Checking compiled code for 'userId' in SQL queries:"
if grep -o "insert into.*users.*userId" dist/index.js 2>/dev/null | head -1; then
    echo "❌ ERROR: Compiled code still has 'userId' in SQL!"
    echo "   This means the build didn't work correctly."
else
    echo "✅ No 'userId' in SQL queries in compiled code (good!)"
fi
echo ""

echo "🔍 Checking compiled code for 'supabaseId' in SQL queries:"
if grep -o "insert into.*users.*supabaseId" dist/index.js 2>/dev/null | head -1; then
    echo "✅ Found 'supabaseId' in SQL queries (correct!)"
else
    echo "⚠️  WARNING: 'supabaseId' not found in SQL queries in compiled code"
fi
echo ""

echo "📅 Build timestamp:"
ls -lh dist/index.js | awk '{print $6, $7, $8}'
echo ""

echo "=========================================="
echo "✅ DIAGNOSTIC COMPLETE"
echo "=========================================="














