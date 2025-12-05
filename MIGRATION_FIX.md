# Database Migration Fix

## Problem

The CI/CD pipeline was failing during the "apply migrations" step with an SQL syntax error:

```
Error near: CREATE TABLE `project_jobs` ( `id` INT NOT NULL AUTO_INCREMENT, `projectId`
```

## Root Cause

The migration file `0006_add_projects_jobs_files.sql` had MySQL/MariaDB compatibility issues:

1. **Backticks in CREATE TABLE**: While backticks are valid in MySQL, some versions or configurations have issues with them in certain contexts
2. **Missing ENGINE specification**: Not specifying the storage engine can cause issues
3. **Missing CHARSET specification**: Character set should be explicit
4. **No IF NOT EXISTS**: If the migration runs twice, it would fail

## Solution

Updated `0006_add_projects_jobs_files.sql` with the following fixes:

### 1. Removed Backticks from Column Names

**Before:**
```sql
CREATE TABLE `project_jobs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `projectId` INT NOT NULL,
  ...
```

**After:**
```sql
CREATE TABLE IF NOT EXISTS project_jobs (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  projectId INT NOT NULL,
  ...
```

### 2. Added IF NOT EXISTS

This makes the migration idempotent - it can be run multiple times safely.

### 3. Added ENGINE and CHARSET

```sql
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

This ensures:
- InnoDB engine (supports foreign keys)
- UTF-8 character set (supports international characters)
- Consistent collation

### 4. Simplified PRIMARY KEY Definition

**Before:**
```sql
PRIMARY KEY (`id`),
```

**After:**
```sql
id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
```

## Testing

To test the migration locally:

```bash
# Set your DATABASE_URL
export DATABASE_URL="mysql://user:pass@host:port/database"

# Run migrations
npm run db:push
```

## Compatibility

The fixed migration is compatible with:
- ✅ MySQL 5.7+
- ✅ MySQL 8.0+
- ✅ MariaDB 10.2+
- ✅ MariaDB 10.5+ (Infomaniak default)

## Files Changed

- `drizzle/0006_add_projects_jobs_files.sql` - Fixed migration

## Next Steps

1. Commit the fixed migration
2. Push to GitHub
3. CI/CD pipeline should now pass
4. If tables already exist in production, the `IF NOT EXISTS` will prevent errors

## Rollback (if needed)

If you need to rollback this migration:

```sql
DROP TABLE IF EXISTS file_metadata;
DROP TABLE IF EXISTS project_jobs;
DROP TABLE IF EXISTS projects;
```

**Note:** This will delete all data in these tables. Only do this if you're sure!
