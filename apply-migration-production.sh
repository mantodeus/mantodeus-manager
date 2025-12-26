#!/bin/bash
# Apply Phase 1 Migration on Production Server
# Run this on your production server

set -e

echo "🔧 Applying Phase 1 Migration (Logo + Preferences)"
echo "================================================"
echo ""

# Check we're in the right directory
if [ ! -f "drizzle/0013_settings_logo_preferences.sql" ]; then
  echo "❌ Migration file not found. Are you in the app directory?"
  echo "Expected: /srv/customer/sites/manager.mantodeus.com"
  exit 1
fi

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
-- Phase 1: Settings (Logo + Preferences)
ALTER TABLE `company_settings`
  ADD COLUMN IF NOT EXISTS `logoS3Key` VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS `logoUrl` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `logoWidth` INT NULL,
  ADD COLUMN IF NOT EXISTS `logoHeight` INT NULL;

CREATE TABLE IF NOT EXISTS `user_preferences` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL UNIQUE,
  `dateFormat` VARCHAR(20) NOT NULL DEFAULT 'MM/DD/YYYY',
  `timeFormat` VARCHAR(10) NOT NULL DEFAULT '12h',
  `timezone` VARCHAR(50) NOT NULL DEFAULT 'UTC',
  `language` VARCHAR(10) NOT NULL DEFAULT 'en',
  `currency` VARCHAR(3) NOT NULL DEFAULT 'EUR',
  `notificationsEnabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `user_preferences_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS `user_preferences_userId_idx` ON `user_preferences` (`userId`);
EOF

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migration applied successfully!"
  echo ""
  echo "📋 Verifying changes..."

  # Verify the columns exist
  mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "DESCRIBE company_settings;" | grep -E "logoS3Key|logoUrl|logoWidth|logoHeight"

  if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Logo columns verified!"
  fi

  # Verify user_preferences table exists
  mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SHOW TABLES LIKE 'user_preferences';" | grep user_preferences

  if [ $? -eq 0 ]; then
    echo "✅ user_preferences table created!"
  fi

  echo ""
  echo "🎉 All done! Now restart the server:"
  echo "   npx pm2 restart mantodeus-manager"

else
  echo ""
  echo "❌ Migration failed!"
  echo ""
  echo "You can apply it manually:"
  echo "  mysql -h $DB_HOST -u $DB_USER -p $DB_NAME < drizzle/0013_settings_logo_preferences.sql"
fi