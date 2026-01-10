#!/bin/bash
# Extract infrastructure files from git
# Run this on your server

cd /srv/customer/sites/manager.mantodeus.com

echo "📥 Fetching files from git repository..."

# Fetch the branch
git fetch origin cursor/git-repository-cleanup-and-repair-composer-1-5507 2>/dev/null || git fetch origin

# Get the commit with infra files
COMMIT=$(git log --all --oneline --grep="DevOps infrastructure" 2>/dev/null | head -1 | cut -d' ' -f1)

if [ -z "$COMMIT" ]; then
  # Try to get from remote branch
  COMMIT=$(git rev-parse origin/cursor/git-repository-cleanup-and-repair-composer-1-5507 2>/dev/null || echo "")
fi

if [ -z "$COMMIT" ]; then
  echo "❌ Could not find commit. Trying alternative method..."
  # List all files in infra directory from remote
  git ls-tree -r --name-only origin/cursor/git-repository-cleanup-and-repair-composer-1-5507 | grep "^infra/" | while read file; do
    echo "Extracting: $file"
    mkdir -p $(dirname "$file")
    git show origin/cursor/git-repository-cleanup-and-repair-composer-1-5507:"$file" > "$file" 2>/dev/null || true
  done
else
  echo "Using commit: $COMMIT"
  
  # Extract files
  for file in infra/deploy/restart.sh infra/deploy/status.sh \
              infra/ssh/generate-key.sh infra/ssh/install-key.sh infra/ssh/ssh-check.sh infra/ssh/ssh-config.example \
              infra/env/env-sync.sh infra/env/env-update.sh \
              infra/tests/run-deploy-sim.sh; do
    echo "Extracting: $file"
    mkdir -p $(dirname "$file")
    git show ${COMMIT}:"$file" > "$file" 2>/dev/null || \
    git show origin/cursor/git-repository-cleanup-and-repair-composer-1-5507:"$file" > "$file" 2>/dev/null || true
  done
fi

# Make scripts executable
chmod +x infra/deploy/*.sh 2>/dev/null || true
chmod +x infra/ssh/*.sh 2>/dev/null || true
chmod +x infra/env/*.sh 2>/dev/null || true
chmod +x infra/tests/*.sh 2>/dev/null || true

echo ""
echo "✅ Files extracted!"
echo ""
echo "Verifying files:"
ls -la infra/deploy/ 2>/dev/null | head -5
ls -la infra/ssh/ 2>/dev/null | head -5
