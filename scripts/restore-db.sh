#!/bin/bash
# =============================================================================
# MANTODEUS MANAGER - DATABASE RESTORE SCRIPT
# =============================================================================
# Restore database from a backup file
#
# Usage:
#   bash scripts/restore-db.sh <backup-file>
#   bash scripts/restore-db.sh backups/db/mantodeus-20251223-030000.sql.gz
#
# WARNING: This will DROP and recreate the database!
# =============================================================================

set -euo pipefail

# Configuration
APP_PATH="/srv/customer/sites/manager.mantodeus.com"

# Check if backup file is provided
if [ $# -eq 0 ]; then
  echo "❌ ERROR: No backup file specified"
  echo ""
  echo "Usage: bash scripts/restore-db.sh <backup-file>"
  echo ""
  echo "Available backups:"
  ls -lh "$APP_PATH/backups/db"/*.sql.gz 2>/dev/null | tail -10 || echo "  No backups found"
  exit 1
fi

BACKUP_FILE="$1"

# Make path absolute if relative
if [[ "$BACKUP_FILE" != /* ]]; then
  BACKUP_FILE="$APP_PATH/$BACKUP_FILE"
fi

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "============================================"
echo "🔄 Database Restore - Mantodeus Manager"
echo "============================================"
echo "📅 Started at: $(date)"
echo "📁 Backup file: $BACKUP_FILE"
echo ""

# Step 1: Load environment variables
echo "▶ Loading database credentials from .env..."
if [ -f "$APP_PATH/.env" ]; then
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

# Step 2: Parse DATABASE_URL
echo "▶ Parsing database connection string..."
DB_USER=$(echo "$DATABASE_URL" | sed -E 's|mysql://([^:]+):.*|\1|')
DB_PASS=$(echo "$DATABASE_URL" | sed -E 's|mysql://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|mysql://[^@]+@([^:]+):.*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|mysql://[^@]+@[^:]+:([0-9]+)/.*|\1|')
DB_NAME=$(echo "$DATABASE_URL" | sed -E 's|mysql://[^/]+/(.+)(\?.*)?$|\1|' | sed 's/?.*//')

if [ -z "$DB_USER" ] || [ -z "$DB_PASS" ] || [ -z "$DB_HOST" ] || [ -z "$DB_NAME" ]; then
  echo "❌ ERROR: Failed to parse DATABASE_URL"
  exit 1
fi

echo "✅ Target database: $DB_NAME at $DB_HOST:$DB_PORT"
echo ""

# Step 3: Confirm restore
echo "⚠️  WARNING: This will DELETE all current data in database '$DB_NAME'"
echo "   and replace it with data from the backup file."
echo ""
read -p "Are you sure you want to continue? (type 'yes' to proceed): " -r
echo ""

if [ "$REPLY" != "yes" ]; then
  echo "❌ Restore cancelled"
  exit 0
fi

# Step 4: Stop PM2 application
echo "▶ Stopping application..."
pnpm pm2 stop mantodeus-manager 2>/dev/null || echo "  Application not running"
echo ""

# Step 5: Decompress and restore backup
echo "▶ Restoring database from backup..."
gunzip -c "$BACKUP_FILE" | mysql \
  -h "$DB_HOST" \
  -P "$DB_PORT" \
  -u "$DB_USER" \
  -p"$DB_PASS" \
  "$DB_NAME"

echo "✅ Database restored successfully"
echo ""

# Step 6: Restart PM2 application
echo "▶ Restarting application..."
pnpm pm2 restart mantodeus-manager
echo "✅ Application restarted"
echo ""

echo "============================================"
echo "✅ Restore complete!"
echo "📅 Finished at: $(date)"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Verify application is running: pm2 status"
echo "  2. Check application logs: pm2 logs mantodeus-manager"
echo "  3. Test the application in your browser"
