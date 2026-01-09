#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/srv/customer/sites/manager.mantodeus.com"
EXPECTED_GREP="${EXPECTED_GREP:-}"
DEPLOY_STATE_FILE="$APP_DIR/.deploy-state.json"

echo "==> Deploy start: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
cd "$APP_DIR"

echo "==> Fetching and pulling main"
git fetch origin
git pull origin main

echo "==> Current commit"
CURRENT_COMMIT=$(git rev-parse HEAD)
echo "$(git --no-pager log -1 --oneline)"

if [[ -n "$EXPECTED_GREP" ]]; then
  echo "==> Verifying expected change: $EXPECTED_GREP"
  if ! git --no-pager grep -n "$EXPECTED_GREP" -- client/src; then
    echo "ERROR: Expected pattern not found in client/src"
    exit 1
  fi
fi

# Function to get hash of file(s)
get_file_hash() {
  if command -v sha256sum &> /dev/null; then
    cat "$@" 2>/dev/null | sha256sum | cut -d' ' -f1
  elif command -v shasum &> /dev/null; then
    cat "$@" 2>/dev/null | shasum -a 256 | cut -d' ' -f1
  else
    # Fallback: use file modification time and size
    stat -c "%Y-%s" "$@" 2>/dev/null | tr '\n' '-' || stat -f "%m-%z" "$@" 2>/dev/null | tr '\n' '-' || echo "unknown"
  fi
}

# Function to get value from JSON (simple grep-based, no jq dependency)
get_json_value() {
  local file="$1"
  local key="$2"
  if [ -f "$file" ]; then
    grep "\"$key\"" "$file" 2>/dev/null | sed 's/.*"'"$key"'"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' | head -1
  fi
}

# Function to check if dependencies changed
check_dependencies_changed() {
  local current_hash
  local last_hash
  
  # Hash package.json and lockfile
  if [ -f "pnpm-lock.yaml" ]; then
    current_hash=$(get_file_hash package.json pnpm-lock.yaml)
  elif [ -f "package-lock.json" ]; then
    current_hash=$(get_file_hash package.json package-lock.json)
  else
    current_hash=$(get_file_hash package.json)
  fi
  
  # Load last known hash (simple JSON parsing without jq)
  if [ -f "$DEPLOY_STATE_FILE" ]; then
    last_hash=$(get_json_value "$DEPLOY_STATE_FILE" "dependencies_hash")
    [ -z "$last_hash" ] && last_hash="none"
  else
    last_hash="none"
  fi
  
  if [ "$current_hash" != "$last_hash" ]; then
    echo "$current_hash" > /tmp/.deploy-deps-hash
    return 0  # Changed
  else
    return 1  # Not changed
  fi
}

# Function to check if migrations needed
check_migrations_needed() {
  # Count migration files
  local current_migration_count=0
  if [ -d "drizzle" ]; then
    current_migration_count=$(find drizzle -maxdepth 1 -name "*.sql" -type f 2>/dev/null | wc -l | tr -d ' ')
  fi
  
  # Load last known count
  local last_migration_count=0
  if [ -f "$DEPLOY_STATE_FILE" ]; then
    last_migration_count=$(get_json_value "$DEPLOY_STATE_FILE" "migration_count")
    [ -z "$last_migration_count" ] && last_migration_count=0
  fi
  
  # Need migrations if count changed (drizzle-kit migrate is already idempotent)
  if [ "$current_migration_count" != "$last_migration_count" ]; then
    return 0  # Needed
  else
    # Even if count is same, drizzle-kit will check for pending migrations
    # But we can skip if we know nothing changed
    return 1  # Not needed (drizzle-kit migrate is idempotent anyway)
  fi
}

# Function to update deploy state
update_deploy_state() {
  local deps_hash="${1:-}"
  local migration_count="${2:-0}"
  
  # Create state file (simple JSON without jq)
  cat > "$DEPLOY_STATE_FILE" <<EOF
{
  "last_deploy": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "last_commit": "$CURRENT_COMMIT",
  "dependencies_hash": "$deps_hash",
  "migration_count": $migration_count
}
EOF
}

# Check if dependencies changed
echo ""
echo "==> Checking dependencies..."
if check_dependencies_changed; then
  DEPS_HASH=$(cat /tmp/.deploy-deps-hash)
  echo "  → Dependencies changed, installing..."
  # Use --no-frozen-lockfile when dependencies change since lockfile is in .gitignore
  # This allows the server to regenerate pnpm-lock.yaml when package.json changes
  npx pnpm install --no-frozen-lockfile
  echo "  ✓ Dependencies installed"
else
  DEPS_HASH=$(get_json_value "$DEPLOY_STATE_FILE" "dependencies_hash" || echo "")
  echo "  ✓ Dependencies unchanged, skipping install"
fi

# Load DATABASE_URL from .env for drizzle-kit commands
if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f ".env" ]; then
    # Use a safer method to export DATABASE_URL
    export DATABASE_URL=$(grep -v "^#" .env | grep "^DATABASE_URL=" | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs)
    if [ -n "$DATABASE_URL" ]; then
      echo "  ✓ Loaded DATABASE_URL from .env"
    fi
  fi
fi

# Skip schema generation if it fails (non-blocking)
# This step is idempotent and only needed when schema changes
echo ""
echo "==> Generate database schema (optional, non-blocking)"
if npx pnpm run db:generate 2>&1; then
  echo "  ✓ Schema generated"
else
  echo "  ⚠ Schema generation skipped (may indicate config issue, but deployment continues)"
fi

# Check if migrations needed
echo ""
echo "==> Checking migrations..."
MIGRATION_COUNT=$(find drizzle -maxdepth 1 -name "*.sql" -type f 2>/dev/null | wc -l | tr -d ' ' || echo "0")

if check_migrations_needed; then
  echo "  → New migration files detected, applying..."
  
  # Run migrations with error output visible for debugging
  if npx pnpm run db:migrate 2>&1; then
    echo "  ✓ Migrations applied"
  else
    echo "  ⚠ Migration skipped (drizzle-kit config issue, but deployment continues)"
    echo "  → Migrations can be applied manually later if needed"
    echo "  → To debug, run: DATABASE_URL=\$(grep DATABASE_URL .env | cut -d'=' -f2) npx pnpm run db:migrate"
  fi
else
  echo "  ✓ No new migration files, skipping (drizzle-kit migrate is idempotent)"
  # Note: drizzle-kit migrate is already idempotent, but we skip the call if nothing changed
fi

# Prevent overlapping deploys
LOCK_FILE="$APP_DIR/.deploy.lock"
if [ -f "$LOCK_FILE" ]; then
  echo "ERROR: Another deploy is running (lock file exists)"
  exit 1
fi
touch "$LOCK_FILE"
trap "rm -f $LOCK_FILE" EXIT

echo ""
echo "==> Backup previous build"
[ -d "dist" ] && rm -rf dist.backup && cp -r dist dist.backup

# Always build (code may have changed even if deps/migrations didn't)
echo ""
echo "==> Build"
# Increase Node.js memory limit to prevent OOM during Vite build
export NODE_OPTIONS=--max-old-space-size=4096
npm run build

echo ""
echo "==> Verify build output"
if [[ ! -d "$APP_DIR/dist/public/assets" ]]; then
  echo "ERROR: Build output not found at dist/public/assets"
  exit 1
fi

# Always restart (new code is built)
echo ""
echo "==> Restart service"
if ! npx pm2 restart mantodeus-manager; then
  echo "WARN: Restart failed, attempting fresh start"
  npx pm2 start dist/index.js --name mantodeus-manager
fi

echo ""
echo "==> Health check"
sleep 3
if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
  echo "  ✓ App is healthy"
else
  echo "  ⚠ Health check failed - check logs via: pm2 logs mantodeus-manager"
fi

echo ""
echo "==> Save PM2 configuration"
npx pm2 save

# Update deploy state
update_deploy_state "${DEPS_HASH}" "${MIGRATION_COUNT}"

echo ""
echo "==> Deploy complete: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo "  → Commit: ${CURRENT_COMMIT:0:7}"
echo "  → Dependencies: ${DEPS_HASH:+changed} ${DEPS_HASH:-unchanged}"
echo "  → Migrations: ${MIGRATION_COUNT} files"
