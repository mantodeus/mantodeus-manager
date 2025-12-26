#!/bin/bash
# Apply Phase 1 Migration: Settings (Logo + Preferences)
# This adds logo fields to company_settings and creates user_preferences table

echo "Applying Phase 1 migration..."
echo "This will add:"
echo "  - Logo fields to company_settings table (logoS3Key, logoUrl, logoWidth, logoHeight)"
echo "  - New user_preferences table"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable not set"
  echo "Please set it in your .env file or export it:"
  echo "  export DATABASE_URL='mysql://user:password@host:port/database'"
  exit 1
fi

# Apply the migration
mysql $DATABASE_URL < drizzle/0013_settings_logo_preferences.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migration applied successfully!"
  echo ""
  echo "Next steps:"
  echo "1. Uncomment the preferences query in client/src/pages/Settings.tsx (lines 35-36)"
  echo "2. Restart the dev server"
  echo "3. The User Preferences section will now appear in Settings"
else
  echo ""
  echo "❌ Migration failed. Check your database connection."
fi
