@echo off
REM Apply Phase 1 Migration: Settings (Logo + Preferences)
REM This adds logo fields to company_settings and creates user_preferences table

echo Applying Phase 1 migration...
echo This will add:
echo   - Logo fields to company_settings table (logoS3Key, logoUrl, logoWidth, logoHeight)
echo   - New user_preferences table
echo.

REM Check if .env file exists
if not exist .env (
  echo ERROR: .env file not found
  echo Please create .env file with DATABASE_URL
  exit /b 1
)

REM Load DATABASE_URL from .env (simplified - you may need to set it manually)
echo Please ensure DATABASE_URL is set in your environment
echo.

REM Apply migration using mysql client
mysql --defaults-extra-file=.my.cnf < drizzle\0013_settings_logo_preferences.sql

if %errorlevel% equ 0 (
  echo.
  echo Migration applied successfully!
  echo.
  echo Next steps:
  echo 1. Uncomment the preferences query in client\src\pages\Settings.tsx (lines 35-36^)
  echo 2. Restart the dev server
  echo 3. The User Preferences section will now appear in Settings
) else (
  echo.
  echo Migration failed. You can apply it manually:
  echo   mysql -u username -p database_name ^< drizzle\0013_settings_logo_preferences.sql
)

pause
