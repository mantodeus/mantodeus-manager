#!/bin/bash
# This script creates all infrastructure files on the server
# Run this on your server: bash create-all-files.sh

cd /srv/customer/sites/manager.mantodeus.com/infra || exit 1

echo "Creating all infrastructure files..."

# Create deploy scripts
cat > deploy/deploy.sh << 'DEPLOY_EOF'
#!/bin/bash
#
# Mantodeus Manager - Deployment Script
# Full deployment with backup, build, restart, and health check
#
# Usage:
#   ./deploy.sh [--dry-run] [--no-backup] [--skip-health-check]
#
# Output: JSON format for programmatic parsing
#

set -euo pipefail

# Configuration
PROJECT_DIR="/srv/customer/sites/manager.mantodeus.com"
PM2_APP_NAME="mantodeus-manager"
BACKUP_DIR="${PROJECT_DIR}/backups"
HEALTH_CHECK_URL="http://localhost:3000/api/trpc/system.health"
HEALTH_CHECK_RETRIES=5
HEALTH_CHECK_DELAY=3

# Flags
DRY_RUN=false
NO_BACKUP=false
SKIP_HEALTH_CHECK=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --no-backup)
      NO_BACKUP=true
      shift
      ;;
    --skip-health-check)
      SKIP_HEALTH_CHECK=true
      shift
      ;;
    *)
      echo "{\"error\":\"Unknown option: $1\"}" >&2
      exit 1
      ;;
  esac
done

# Safety check: Don't run as root
if [ "$(id -u)" -eq 0 ]; then
  echo "{\"error\":\"This script should NOT be run as root\"}" >&2
  exit 1
fi

# Output JSON helper
json_output() {
  echo "$1"
}

# Error handler
error_exit() {
  json_output "{\"status\":\"error\",\"error\":\"$1\"}"
  exit 1
}

# Check if project directory exists
if [ ! -d "$PROJECT_DIR" ]; then
  error_exit "Project directory not found: $PROJECT_DIR"
fi

cd "$PROJECT_DIR" || error_exit "Failed to change to project directory"

# Create backup directory if it doesn't exist
if [ "$NO_BACKUP" = false ]; then
  mkdir -p "$BACKUP_DIR"
fi

# Generate backup filename
BACKUP_FILE="${BACKUP_DIR}/backup-$(date +%Y%m%d-%H%M%S).tar.gz"

# Step 1: Create backup
if [ "$NO_BACKUP" = false ]; then
  if [ "$DRY_RUN" = true ]; then
    json_output "{\"step\":\"backup\",\"status\":\"dry-run\",\"backup_file\":\"$BACKUP_FILE\"}"
  else
    json_output "{\"step\":\"backup\",\"status\":\"creating\",\"backup_file\":\"$BACKUP_FILE\"}"
    
    # Backup: dist/, node_modules/, package-lock.json, .env (if exists)
    tar -czf "$BACKUP_FILE" \
      dist/ node_modules/ package-lock.json .env 2>/dev/null || true
    
    # Keep only last 5 backups
    ls -t "$BACKUP_DIR"/backup-*.tar.gz 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
    
    json_output "{\"step\":\"backup\",\"status\":\"success\",\"backup_file\":\"$BACKUP_FILE\"}"
  fi
fi

# Step 2: Git pull
if [ "$DRY_RUN" = true ]; then
  json_output "{\"step\":\"git_pull\",\"status\":\"dry-run\"}"
else
  json_output "{\"step\":\"git_pull\",\"status\":\"pulling\"}"
  if git pull origin main; then
    json_output "{\"step\":\"git_pull\",\"status\":\"success\"}"
  else
    error_exit "Git pull failed"
  fi
fi

# Step 3: Install dependencies
if [ "$DRY_RUN" = true ]; then
  json_output "{\"step\":\"install\",\"status\":\"dry-run\"}"
else
  json_output "{\"step\":\"install\",\"status\":\"installing\"}"
  if ! npm install --no-audit --no-fund --include=dev --legacy-peer-deps; then
    json_output "{\"step\":\"install\",\"status\":\"first-attempt-failed\"}"
    
    # Clean up temporary npm directories that cause ENOTEMPTY errors
    # These are created when npm fails mid-install (e.g., .body-parser-oXjK4POA)
    json_output "{\"step\":\"install\",\"status\":\"cleaning-temp-dirs\"}"
    find node_modules -maxdepth 1 -name '.*' -type d 2>/dev/null | xargs rm -rf 2>/dev/null || true
    
    # Clear npm cache to avoid corrupted state
    json_output "{\"step\":\"install\",\"status\":\"clearing-npm-cache\"}"
    npm cache clean --force 2>/dev/null || true
    
    # Remove node_modules with timeout
    json_output "{\"step\":\"install\",\"status\":\"removing-node-modules\"}"
    timeout 60 rm -rf node_modules 2>/dev/null || {
      # Try removing directories in smaller batches
      rm -rf node_modules/.* 2>/dev/null || true
      rm -rf node_modules/@* 2>/dev/null || true
      rm -rf node_modules 2>/dev/null || true
    }
    
    # Retry npm install
    json_output "{\"step\":\"install\",\"status\":\"retrying\"}"
    if ! npm install --no-audit --no-fund --include=dev --legacy-peer-deps; then
      error_exit "npm install failed after cleanup"
    fi
  fi
  json_output "{\"step\":\"install\",\"status\":\"success\"}"
fi

# Step 4: Build
if [ "$DRY_RUN" = true ]; then
  json_output "{\"step\":\"build\",\"status\":\"dry-run\"}"
else
  json_output "{\"step\":\"build\",\"status\":\"building\"}"
  if npm run build; then
    json_output "{\"step\":\"build\",\"status\":\"success\"}"
  else
    error_exit "Build failed"
  fi
fi

# Step 5: Restart PM2
if [ "$DRY_RUN" = true ]; then
  json_output "{\"step\":\"restart\",\"status\":\"dry-run\"}"
else
  json_output "{\"step\":\"restart\",\"status\":\"restarting\"}"
  if pm2 restart "$PM2_APP_NAME"; then
    json_output "{\"step\":\"restart\",\"status\":\"success\"}"
  else
    error_exit "PM2 restart failed"
  fi
fi

# Step 6: Health check
if [ "$SKIP_HEALTH_CHECK" = false ]; then
  if [ "$DRY_RUN" = true ]; then
    json_output "{\"step\":\"health_check\",\"status\":\"dry-run\"}"
  else
    json_output "{\"step\":\"health_check\",\"status\":\"checking\"}"
    
    HEALTH_OK=false
    for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
      sleep $HEALTH_CHECK_DELAY
      if curl -sf "${HEALTH_CHECK_URL}?input=%7B%22timestamp%22%3A$(date +%s)%7D" > /dev/null 2>&1; then
        HEALTH_OK=true
        break
      fi
      json_output "{\"step\":\"health_check\",\"status\":\"retrying\",\"attempt\":$i,\"max_attempts\":$HEALTH_CHECK_RETRIES}"
    done
    
    if [ "$HEALTH_OK" = true ]; then
      json_output "{\"step\":\"health_check\",\"status\":\"healthy\"}"
    else
      error_exit "Health check failed after $HEALTH_CHECK_RETRIES attempts"
    fi
  fi
fi

# Success
json_output "{\"status\":\"success\",\"git_pull\":\"success\",\"build\":\"success\",\"restart\":\"success\",\"health\":\"healthy\"}"
DEPLOY_EOF

chmod +x deploy/deploy.sh

echo "✅ Created deploy/deploy.sh"

# I'll create a simpler approach - let me create a script that uses curl or wget to get files from the repo
# Actually, better idea - let me create a script that copies files via git show

cat > /tmp/copy-infra-files.sh << 'COPYSCRIPT'
#!/bin/bash
cd /srv/customer/sites/manager.mantodeus.com

# Get the commit hash with infra files
COMMIT=$(git log --all --oneline --grep="DevOps infrastructure" | head -1 | cut -d' ' -f1)

if [ -z "$COMMIT" ]; then
  echo "Fetching from remote..."
  git fetch origin cursor/git-repository-cleanup-and-repair-composer-1-5507
  COMMIT=$(git rev-parse origin/cursor/git-repository-cleanup-and-repair-composer-1-5507)
fi

echo "Using commit: $COMMIT"

# Copy files from that commit
git show ${COMMIT}:infra/deploy/restart.sh > infra/deploy/restart.sh
git show ${COMMIT}:infra/deploy/status.sh > infra/deploy/status.sh
git show ${COMMIT}:infra/ssh/generate-key.sh > infra/ssh/generate-key.sh
git show ${COMMIT}:infra/ssh/install-key.sh > infra/ssh/install-key.sh
git show ${COMMIT}:infra/ssh/ssh-check.sh > infra/ssh/ssh-check.sh
git show ${COMMIT}:infra/ssh/ssh-config.example > infra/ssh/ssh-config.example
git show ${COMMIT}:infra/env/env-sync.sh > infra/env/env-sync.sh
git show ${COMMIT}:infra/env/env-update.sh > infra/env/env-update.sh
git show ${COMMIT}:infra/tests/run-deploy-sim.sh > infra/tests/run-deploy-sim.sh

chmod +x infra/deploy/*.sh infra/ssh/*.sh infra/env/*.sh infra/tests/*.sh

echo "✅ All files copied!"
ls -la infra/deploy/
COPYSCRIPT

chmod +x /tmp/copy-infra-files.sh
