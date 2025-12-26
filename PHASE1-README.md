# Phase 1: Settings (Logo + Preferences) - FIXED

## Issue Resolved

The Settings page was hanging because it tried to query the `user_preferences` table before the migration was applied.

## Current Status

✅ **Settings page now loads successfully!**

The page currently shows:
- ✅ Theme settings
- ✅ Logo upload section (fully functional)
- ✅ Company information
- ✅ Tax information
- ✅ Banking details
- ✅ Invoice settings
- ⏸️ User Preferences section (hidden until migration applied)

## To Enable User Preferences Section

### Step 1: Apply the Database Migration

Choose one method:

**Option A: Using the batch script (Windows)**
```bash
apply-phase1-migration.bat
```

**Option B: Using bash script (Linux/Mac/WSL)**
```bash
chmod +x apply-phase1-migration.sh
./apply-phase1-migration.sh
```

**Option C: Manual SQL**
```bash
mysql -u username -p database_name < drizzle/0013_settings_logo_preferences.sql
```

### Step 2: Uncomment the Preferences Query

Edit `client/src/pages/Settings.tsx` lines 33-37:

**Change from:**
```typescript
// Preferences query - disabled until migration is applied
// Uncomment after running: drizzle/0013_settings_logo_preferences.sql
// const { data: preferences, isLoading: preferencesLoading } = trpc.settings.preferences.get.useQuery();
const preferences = null;
const preferencesLoading = false;
```

**Change to:**
```typescript
// Preferences query - enabled after migration
const { data: preferences, isLoading: preferencesLoading } = trpc.settings.preferences.get.useQuery();
```

### Step 3: Restart Dev Server

```bash
pnpm dev
```

The User Preferences section will now appear on the Settings page!

## What Was Implemented

### 1. Database Schema
- ✅ Added logo fields to `company_settings` table
- ✅ Created `user_preferences` table with defaults

### 2. Backend Functions
- ✅ `getUserPreferencesByUserId()` - Auto-creates with defaults
- ✅ `uploadCompanyLogo()` - Handles image upload with Sharp
- ✅ `deleteCompanyLogo()` - Removes logo from S3 and DB

### 3. API Endpoints
- ✅ `settings.preferences.get` - Fetch preferences
- ✅ `settings.preferences.update` - Update preferences
- ✅ `settings.uploadLogo` - Upload and resize logo
- ✅ `settings.deleteLogo` - Delete logo

### 4. Frontend Components
- ✅ `LogoUploadSection` - Drag-and-drop logo upload
- ✅ User Preferences form with:
  - Date format selector
  - Time format (12h/24h)
  - Timezone selector
  - Language selector
  - Currency selector
  - Notifications toggle

## Features

### Logo Upload
- ✅ Drag-and-drop support
- ✅ File validation (PNG/JPG/SVG, max 5MB)
- ✅ Client-side compression
- ✅ Server-side resize to max 800x200px
- ✅ S3 upload with presigned URLs
- ✅ Delete functionality
- ✅ Live preview

### User Preferences
- ✅ Date format (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD)
- ✅ Time format (12h, 24h)
- ✅ Timezone selection
- ✅ Language (English, Deutsch)
- ✅ Currency (EUR, USD, GBP, CHF)
- ✅ Notification toggle

## Files Modified

### Database
- `drizzle/schema.ts` - Added logo fields and user_preferences table
- `drizzle/0013_settings_logo_preferences.sql` - Migration SQL
- `server/db.ts` - Added database functions with error handling

### Backend
- `server/settingsRouter.ts` - Added preferences router and logo endpoints

### Frontend
- `client/src/pages/Settings.tsx` - Added logo and preferences sections
- `client/src/components/LogoUploadSection.tsx` - New component

## Migration SQL

The migration adds these fields to `company_settings`:
```sql
ALTER TABLE `company_settings`
  ADD COLUMN IF NOT EXISTS `logoS3Key` VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS `logoUrl` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `logoWidth` INT NULL,
  ADD COLUMN IF NOT EXISTS `logoHeight` INT NULL;
```

And creates the `user_preferences` table:
```sql
CREATE TABLE IF NOT EXISTS `user_preferences` (
  `id` SERIAL PRIMARY KEY,
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
```

## Next Phase

Phase 2: Comments (Cross-Module) - See Master Execution Plan
