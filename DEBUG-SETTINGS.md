# Debugging Settings Page Loading Issue

## Steps to Debug:

### 1. Check Browser Console
Open the browser DevTools (F12) and look for:
- Red errors in the Console tab
- Failed network requests in the Network tab
- Look for any tRPC query errors

### 2. Check Server Logs
Look at your terminal where the server is running. Check for:
- Database connection errors
- Migration errors
- SQL query errors mentioning `company_settings` or `user_preferences`

### 3. Temporary Fix - Disable Logo Section

If Settings still won't load, try this temporary fix in `client/src/pages/Settings.tsx`:

**Comment out the Logo Upload Section (lines 167-181):**

```typescript
{/* Logo Upload Section - TEMPORARILY DISABLED FOR DEBUGGING
<Card>
  <CardHeader>
    <div className="flex items-center gap-2">
      <ImageIcon className="h-5 w-5 text-primary" />
      <CardTitle>Company Logo</CardTitle>
    </div>
    <CardDescription>
      Logo appears on invoices and reports (max 800x200px)
    </CardDescription>
  </CardHeader>
  <CardContent>
    <LogoUploadSection />
  </CardContent>
</Card>
*/}
```

This will help identify if the issue is with the LogoUploadSection component.

### 4. Check Database Connection

The most likely issue is that the database migration hasn't been applied yet.

**To check if migration is needed:**
1. Open your database tool (phpMyAdmin, MySQL Workbench, etc.)
2. Check if `company_settings` table has these columns:
   - `logoS3Key`
   - `logoUrl`
   - `logoWidth`
   - `logoHeight`
3. Check if `user_preferences` table exists

**If columns are missing, apply migration manually:**

```sql
-- Copy and paste this into your MySQL console:

-- Add logo fields to company_settings
ALTER TABLE `company_settings`
  ADD COLUMN IF NOT EXISTS `logoS3Key` VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS `logoUrl` TEXT NULL,
  ADD COLUMN IF NOT EXISTS `logoWidth` INT NULL,
  ADD COLUMN IF NOT EXISTS `logoHeight` INT NULL;

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

### 5. After Applying Migration

1. Restart your dev server (Ctrl+C, then `pnpm dev`)
2. Uncomment lines 35-36 in `client/src/pages/Settings.tsx`:

```typescript
// Change FROM:
// const { data: preferences, isLoading: preferencesLoading } = trpc.settings.preferences.get.useQuery();
const preferences = null;
const preferencesLoading = false;

// Change TO:
const { data: preferences, isLoading: preferencesLoading } = trpc.settings.preferences.get.useQuery();
```

3. Refresh the Settings page

### 6. Common Issues

**Issue: Page loads but Logo section doesn't show**
- Solution: Check S3 configuration in `.env` file

**Issue: "Table doesn't exist" error**
- Solution: Run the migration SQL above

**Issue: Settings page hangs forever**
- Solution: Comment out the LogoUploadSection temporarily, check browser console

**Issue: TypeScript errors**
- Solution: Restart TypeScript server in VSCode (Cmd/Ctrl+Shift+P → "Restart TypeScript Server")

## What Should Work Right Now

Even without the migration applied:
- ✅ Theme settings should work
- ✅ Company information should work
- ✅ All existing settings should work

With partial migration (just ALTER TABLE):
- ✅ Logo upload section will appear
- ❌ User preferences section won't appear (needs full migration)

With full migration:
- ✅ Everything should work!
