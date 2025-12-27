# Canonical deploy command\n\nRun: ash infra/deploy/deploy.sh\n\n# URGENT: Apply Phase 1 Migration to Production

## The Problem
Settings page returns 500 error because the database doesn't have the new logo columns yet.

## The Solution
Apply this SQL to your production database **RIGHT NOW**:

```sql
-- Phase 1: Add logo columns to company_settings (safe to run multiple times)
ALTER TABLE `company_settings`
  ADD COLUMN IF NOT EXISTS `logoS3Key` VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS `logoUrl` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `logoWidth` INT NULL,
  ADD COLUMN IF NOT EXISTS `logoHeight` INT NULL;
```

**IMPORTANT:** Don't create the `user_preferences` table yet - that can wait. Just add the logo columns to fix the Settings page immediately.

## How to Apply (Choose ONE method):

### Method 1: Using SSH + MySQL CLI (RECOMMENDED)
```bash
# SSH into your server
ssh your-server

# Connect to MySQL and run the migration
mysql -u your_db_user -p your_database_name

# Paste this SQL:
ALTER TABLE `company_settings`
  ADD COLUMN IF NOT EXISTS `logoS3Key` VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS `logoUrl` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `logoWidth` INT NULL,
  ADD COLUMN IF NOT EXISTS `logoHeight` INT NULL;

# Type 'exit' to quit MySQL
exit
```

### Method 2: Using phpMyAdmin or Database GUI
1. Log into phpMyAdmin/Adminer/whatever you use
2. Select your database
3. Go to SQL tab
4. Paste the ALTER TABLE command above
5. Click "Go" or "Execute"

### Method 3: Using Drizzle Kit (if database is accessible)
```bash
# From your local machine
pnpm drizzle-kit push
```

## After Migration is Applied

The Settings page will immediately start working again! You'll see:
- ✅ Theme settings
- ✅ **Logo upload section** (new!)
- ✅ Company information
- ✅ Tax information
- ✅ Banking details
- ✅ Invoice settings

## Optional: Enable User Preferences Later

When you're ready, apply the full migration to also enable the User Preferences section:

```sql
-- Create user_preferences table
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
```

Then uncomment lines 35-36 in `client/src/pages/Settings.tsx` and redeploy.

## Why This Happened

The code was deployed before the database migration was applied. This is a common deployment sequencing issue.

## Prevention for Next Time

Always apply database migrations **BEFORE** deploying code that uses new columns/tables:

1. Apply migration to production database
2. Deploy new code
3. Test

NOT the other way around!

