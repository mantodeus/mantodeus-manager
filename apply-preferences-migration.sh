#!/bin/bash
# Apply Phase 1 Preferences Fix Migration
# Updates date format defaults to EU/German standards

set -e

echo "🔧 Applying Preferences Migration (EU/German defaults)"
echo "====================================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL not set in environment"
  echo ""
  echo "Loading from .env file..."

  if [ -f ".env" ]; then
    export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
  else
    echo "❌ .env file not found"
    exit 1
  fi
fi

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL still not set. Please check your .env file"
  exit 1
fi

echo "✅ DATABASE_URL found"
echo ""

# Parse DATABASE_URL to extract credentials
# Format: mysql://user:password@host:port/database
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:\/]*\).*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo "📊 Database: $DB_NAME @ $DB_HOST"
echo "👤 User: $DB_USER"
echo ""

# Apply the migration
echo "▶ Applying migration..."
echo ""

mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" <<'EOF'
-- Fix Phase 1: Update preferences to EU/German defaults
-- Migrate existing MM/DD/YYYY users to DD/MM/YYYY
-- Update schema defaults

-- Update existing users with MM/DD/YYYY to DD/MM/YYYY
UPDATE `user_preferences`
SET `dateFormat` = 'DD/MM/YYYY'
WHERE `dateFormat` = 'MM/DD/YYYY';

-- Update schema defaults (for new users)
ALTER TABLE `user_preferences`
  MODIFY COLUMN `dateFormat` VARCHAR(20) NOT NULL DEFAULT 'DD.MM.YYYY',
  MODIFY COLUMN `timeFormat` VARCHAR(10) NOT NULL DEFAULT '24h',
  MODIFY COLUMN `timezone` VARCHAR(50) NOT NULL DEFAULT 'Europe/Berlin',
  MODIFY COLUMN `language` VARCHAR(10) NOT NULL DEFAULT 'de';

SELECT 'Migration applied successfully!' as Status;
EOF

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migration applied successfully!"
  echo ""
  echo "📋 Verifying changes..."

  # Show current user preferences
  mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
    SELECT
      id,
      userId,
      dateFormat,
      timeFormat,
      timezone,
      language
    FROM user_preferences
    LIMIT 5;
  "

  echo ""
  echo "🎉 All done! Changes:"
  echo "  - MM/DD/YYYY users migrated to DD/MM/YYYY"
  echo "  - New user defaults: DD.MM.YYYY, 24h, Europe/Berlin, German"
  echo ""
  echo "Next: Deploy the updated code"
  echo "  bash infra/deploy/deploy.sh"

else
  echo ""
  echo "❌ Migration failed!"
  echo ""
  echo "You can try manually:"
  echo "  mysql -h $DB_HOST -u $DB_USER -p $DB_NAME < drizzle/0014_fix_preferences_defaults.sql"
fi
