#!/bin/bash
#
# Fix Git State on Server
# Resolves stuck merge conflicts and uncommitted changes
#

set -euo pipefail

cd /srv/customer/sites/manager.mantodeus.com || exit 1

echo "🔍 Checking git status..."
git status

echo ""
echo "🧹 Cleaning up git state..."

# Reset any merge state
if [ -f ".git/MERGE_HEAD" ]; then
  echo "Removing MERGE_HEAD..."
  rm -f .git/MERGE_HEAD
fi

if [ -f ".git/MERGE_MODE" ]; then
  echo "Removing MERGE_MODE..."
  rm -f .git/MERGE_MODE
fi

# Reset index to HEAD (this will lose uncommitted changes, but that's OK for package-lock.json)
echo "Resetting index..."
git reset HEAD .

# Clean up conflicted files
echo "Cleaning conflicted files..."
git checkout --ours drizzle/meta/_journal.json 2>/dev/null || true
git checkout --theirs drizzle/meta/_journal.json 2>/dev/null || true
git checkout --ours package-lock.json 2>/dev/null || true
git checkout --theirs package-lock.json 2>/dev/null || true

# Remove from index
git rm --cached drizzle/meta/_journal.json 2>/dev/null || true
git rm --cached package-lock.json 2>/dev/null || true

# Reset everything
git reset --hard HEAD 2>/dev/null || git reset --hard origin/$(git rev-parse --abbrev-ref HEAD) 2>/dev/null || true

echo ""
echo "✅ Git state cleaned. Now checking out branch..."

# Fetch and checkout
git fetch origin
git checkout cursor/git-repository-cleanup-and-repair-composer-1-5507

echo ""
echo "✅ Branch checked out!"
ls -la infra/ || echo "⚠️  infra/ directory not found yet"
