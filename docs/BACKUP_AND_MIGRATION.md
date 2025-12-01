# Backup and Migration Guide

This document provides instructions for backing up your database and migrating from the legacy jobs/tasks structure to the new projects/project_jobs structure.

## ⚠️ IMPORTANT: Always Backup First!

Before running any migration, **always create a backup** of your database. This allows you to restore data if anything goes wrong.

### MySQL Backup Commands

#### Full Database Backup

```bash
# Create a timestamped backup
mysqldump -u <username> -p <database_name> > backup-$(date +%Y%m%d-%H%M%S).sql

# Example with specific credentials
mysqldump -u root -p mantodeus_manager > backup-$(date +%Y%m%d-%H%M%S).sql

# Backup with specific host and port
mysqldump -h localhost -P 3306 -u root -p mantodeus_manager > backup.sql
```

#### Backup Specific Tables Only

```bash
# Backup only legacy tables
mysqldump -u root -p mantodeus_manager jobs tasks > legacy-tables-backup.sql

# Backup only new tables
mysqldump -u root -p mantodeus_manager projects project_jobs file_metadata > new-tables-backup.sql
```

#### Compressed Backup (for large databases)

```bash
mysqldump -u root -p mantodeus_manager | gzip > backup-$(date +%Y%m%d-%H%M%S).sql.gz
```

### Restore from Backup

```bash
# Restore from SQL file
mysql -u root -p mantodeus_manager < backup.sql

# Restore from compressed backup
gunzip < backup.sql.gz | mysql -u root -p mantodeus_manager
```

---

## Migration: Legacy Jobs/Tasks → Projects/Project_Jobs

### Overview

The migration script converts:
- Legacy `jobs` table → `projects` table
- Legacy `tasks` table → `project_jobs` table

### Status Mapping

| Legacy Job Status | New Project Status |
|-------------------|-------------------|
| `planning`        | `planned`         |
| `active`          | `active`          |
| `on_hold`         | `active`          |
| `completed`       | `completed`       |
| `cancelled`       | `archived`        |

| Legacy Task Status | New Job Status    |
|--------------------|-------------------|
| `todo`             | `pending`         |
| `in_progress`      | `in_progress`     |
| `review`           | `in_progress`     |
| `completed`        | `done`            |

### Running the Migration

#### Step 1: Create a Backup

```bash
mysqldump -u root -p mantodeus_manager > pre-migration-backup-$(date +%Y%m%d-%H%M%S).sql
```

#### Step 2: Run Database Migrations (if not already done)

```bash
npx drizzle-kit migrate
```

#### Step 3: Preview Changes (Dry Run)

```bash
npx tsx scripts/backfill-projects.ts --dry-run
```

Review the output carefully. The script will show:
- How many projects would be created
- How many jobs would be created
- Any records that would be skipped (already migrated)
- Any errors or warnings

#### Step 4: Execute the Migration

```bash
npx tsx scripts/backfill-projects.ts
```

#### Step 5: Verify the Migration

```sql
-- Check project counts
SELECT COUNT(*) AS project_count FROM projects;

-- Check job counts
SELECT COUNT(*) AS job_count FROM project_jobs;

-- Compare with legacy counts
SELECT COUNT(*) AS legacy_job_count FROM jobs;
SELECT COUNT(*) AS legacy_task_count FROM tasks;

-- Verify status distribution
SELECT status, COUNT(*) FROM projects GROUP BY status;
SELECT status, COUNT(*) FROM project_jobs GROUP BY status;
```

### Script Features

#### Idempotency

The script is **idempotent** - it can be run multiple times safely:
- Projects with matching names (prefixed with `[Migrated]`) are skipped
- Jobs with matching project ID + title combinations are skipped

#### Dry Run Mode

Use `--dry-run` to preview changes without modifying the database:

```bash
npx tsx scripts/backfill-projects.ts --dry-run
```

#### Error Handling

- Errors are logged but don't stop the entire migration
- A summary of all errors is shown at the end
- You can fix issues and re-run (script is idempotent)

---

## Post-Migration Cleanup

After verifying the migration is successful and your application is working correctly with the new tables:

### 1. Update Application Code

Ensure all application code is using the new `projects` and `project_jobs` tables instead of the legacy tables.

### 2. Remove Legacy Routes (Optional)

Once you're confident the migration is complete, you can remove the legacy routes from the frontend sidebar in `DashboardLayout.tsx`.

### 3. Drop Legacy Tables (Optional)

**⚠️ Only do this after thorough testing!**

```sql
-- Create a final backup first!
mysqldump -u root -p mantodeus_manager jobs tasks > final-legacy-backup.sql

-- Drop legacy tables
DROP TABLE tasks;
DROP TABLE job_contacts;
DROP TABLE job_dates;
DROP TABLE jobs;
```

---

## Troubleshooting

### Common Issues

#### 1. "DATABASE_URL environment variable is not set"

Set the environment variable:
```bash
export DATABASE_URL='mysql://user:password@localhost:3306/mantodeus_manager'
```

#### 2. Foreign Key Constraint Errors

If you see foreign key errors, ensure:
- The `projects` table migration ran before `project_jobs`
- The referenced user IDs exist in the `users` table

#### 3. Duplicate Key Errors

This usually means the script detected an already-migrated record. The script should skip these automatically.

### Getting Help

Run the script with `--help` for usage information:

```bash
npx tsx scripts/backfill-projects.ts --help
```

---

## Rollback Procedure

If something goes wrong, restore from your backup:

```bash
# Drop the new tables (if partially created)
mysql -u root -p mantodeus_manager -e "
  SET FOREIGN_KEY_CHECKS = 0;
  DROP TABLE IF EXISTS file_metadata;
  DROP TABLE IF EXISTS project_jobs;
  DROP TABLE IF EXISTS projects;
  SET FOREIGN_KEY_CHECKS = 1;
"

# Restore from backup
mysql -u root -p mantodeus_manager < pre-migration-backup.sql
```
