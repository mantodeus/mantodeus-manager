#!/bin/bash
# =============================================================================
# MANTODEUS MANAGER - DATABASE BACKUP SCRIPT
# =============================================================================
# Automated database backup with S3 upload and retention management
#
# Usage:
#   bash scripts/backup-db.sh
#
# Cron setup (daily at 3 AM):
#   0 3 * * * /srv/customer/sites/manager.mantodeus.com/scripts/backup-db.sh >> /srv/customer/sites/manager.mantodeus.com/logs/backup.log 2>&1
# =============================================================================

set -euo pipefail

# Configuration
APP_PATH="/srv/customer/sites/manager.mantodeus.com"
BACKUP_DIR="$APP_PATH/backups/db"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mantodeus-$DATE.sql.gz"
RETENTION_DAYS=30

echo "============================================"
echo "🗄️  Database Backup - Mantodeus Manager"
echo "============================================"
echo "📅 Started at: $(date)"
echo ""

# Step 1: Create backup directory
echo "▶ Ensuring backup directory exists..."
mkdir -p "$BACKUP_DIR"
echo "✅ Backup directory: $BACKUP_DIR"
echo ""

# Step 2: Load environment variables
echo "▶ Loading database credentials from .env..."
if [ -f "$APP_PATH/.env" ]; then
  # Source .env file but only extract DATABASE_URL
  DATABASE_URL=$(grep "^DATABASE_URL=" "$APP_PATH/.env" | cut -d '=' -f2- | tr -d '"' | tr -d "'")

  if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL not found in .env file"
    exit 1
  fi
else
  echo "❌ ERROR: .env file not found at $APP_PATH/.env"
  exit 1
fi
echo "✅ Database credentials loaded"
echo ""

# Step 3: Parse DATABASE_URL
# Format: mysql://user:password@host:port/database
echo "▶ Parsing database connection string..."
DB_USER=$(echo "$DATABASE_URL" | sed -E 's|mysql://([^:]+):.*|\1|')
DB_PASS=$(echo "$DATABASE_URL" | sed -E 's|mysql://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|mysql://[^@]+@([^:]+):.*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|mysql://[^@]+@[^:]+:([0-9]+)/.*|\1|')
DB_NAME=$(echo "$DATABASE_URL" | sed -E 's|mysql://[^/]+/(.+)(\?.*)?$|\1|' | sed 's/?.*//')

if [ -z "$DB_USER" ] || [ -z "$DB_PASS" ] || [ -z "$DB_HOST" ] || [ -z "$DB_NAME" ]; then
  echo "❌ ERROR: Failed to parse DATABASE_URL"
  echo "   Expected format: mysql://user:password@host:port/database"
  exit 1
fi

echo "✅ Database: $DB_NAME at $DB_HOST:$DB_PORT"
echo ""

# Step 4: Create database backup
echo "▶ Creating database backup..."
mysqldump \
  -h "$DB_HOST" \
  -P "$DB_PORT" \
  -u "$DB_USER" \
  -p"$DB_PASS" \
  "$DB_NAME" \
  --single-transaction \
  --quick \
  --lock-tables=false \
  | gzip > "$BACKUP_FILE"

# Verify backup was created
if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ ERROR: Backup file was not created"
  exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "✅ Backup created: $BACKUP_FILE ($BACKUP_SIZE)"
echo ""

# Step 5: Upload to S3 (optional)
echo "▶ Uploading backup to S3..."
S3_ENDPOINT=$(grep "^S3_ENDPOINT=" "$APP_PATH/.env" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
S3_BUCKET=$(grep "^S3_BUCKET=" "$APP_PATH/.env" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
S3_ACCESS_KEY=$(grep "^S3_ACCESS_KEY_ID=" "$APP_PATH/.env" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
S3_SECRET_KEY=$(grep "^S3_SECRET_ACCESS_KEY=" "$APP_PATH/.env" | cut -d '=' -f2- | tr -d '"' | tr -d "'")

if [ -n "$S3_ENDPOINT" ] && [ -n "$S3_BUCKET" ] && [ -n "$S3_ACCESS_KEY" ] && [ -n "$S3_SECRET_KEY" ]; then
  # Configure AWS CLI for S3-compatible storage
  export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY"
  export AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY"

  S3_PATH="s3://$S3_BUCKET/backups/db/mantodeus-$DATE.sql.gz"

  if command -v aws &> /dev/null; then
    aws s3 cp "$BACKUP_FILE" "$S3_PATH" --endpoint-url "$S3_ENDPOINT" && \
      echo "✅ Backup uploaded to S3: $S3_PATH" || \
      echo "⚠️  S3 upload failed (backup still available locally)"
  else
    echo "⚠️  AWS CLI not installed, skipping S3 upload"
  fi
else
  echo "⚠️  S3 credentials not configured, skipping S3 upload"
fi
echo ""

# Step 6: Clean up old backups (keep last 30)
echo "▶ Cleaning up old backups (keeping last $RETENTION_DAYS)..."
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/*.sql.gz 2>/dev/null | wc -l || echo "0")

if [ "$BACKUP_COUNT" -gt "$RETENTION_DAYS" ]; then
  ls -t "$BACKUP_DIR"/*.sql.gz | tail -n +$((RETENTION_DAYS + 1)) | xargs rm -f
  REMOVED=$((BACKUP_COUNT - RETENTION_DAYS))
  echo "✅ Removed $REMOVED old backup(s)"
else
  echo "✅ No old backups to remove ($BACKUP_COUNT total)"
fi
echo ""

echo "============================================"
echo "✅ Backup complete!"
echo "📁 File: $BACKUP_FILE"
echo "💾 Size: $BACKUP_SIZE"
echo "📅 Finished at: $(date)"
echo "============================================"
