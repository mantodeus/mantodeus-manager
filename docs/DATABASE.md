# Database Guide

## Overview

Mantodeus Manager uses:
- **Database**: MySQL 8.0 / MariaDB 10.5+
- **ORM**: Drizzle ORM
- **Migrations**: Drizzle Kit
- **Schema**: `drizzle/schema.ts`

## Connection

Database connection is configured via `DATABASE_URL` environment variable:

```env
DATABASE_URL=mysql://user:password@host:3306/mantodeus_manager
```

## Schema Management

### Making Schema Changes

1. **Edit the schema** in `drizzle/schema.ts`
2. **Generate migration**:
   ```bash
   pnpm db:generate
   ```
3. **Review the generated SQL** in `drizzle/XXXX_*.sql`
4. **Apply the migration** locally:
   ```bash
   pnpm db:migrate
   ```
5. **Commit both files**:
   ```bash
   git add drizzle/
   git commit -m "feat(db): description of change"
   ```

### Production Migrations

After deploying code with schema changes:

```bash
ssh mantodeus-server
cd /srv/customer/sites/manager.mantodeus.com
pnpm db:migrate
```

### Available Scripts

| Command | Purpose | Use When |
|---------|---------|----------|
| `pnpm db:generate` | Generate migration from schema changes | After editing `schema.ts` |
| `pnpm db:migrate` | Apply pending migrations | After deployment with schema changes |
| `pnpm db:push-direct` | Push schema directly (⚠️ dev only) | Local development only |
| `pnpm db:studio` | Launch Drizzle Studio GUI | Inspecting database locally |
| `pnpm db:check-url` | Verify database connection | Troubleshooting connection |

## Migration Workflow Rules

### ✅ DO

- ✅ **Always generate migrations** with `pnpm db:generate`
- ✅ **Review generated SQL** before committing
- ✅ **Test migrations locally** before production
- ✅ **Use `db:migrate`** in production
- ✅ **Commit migration files** with schema changes
- ✅ **Keep migrations immutable** once committed

### ❌ DON'T

- ❌ **Never use `db:push` in production** - it can cause data loss
- ❌ **Never edit migration files** after committing
- ❌ **Never skip migration generation** - direct schema changes break migrations
- ❌ **Never delete old migrations** - they're part of history
- ❌ **Don't apply untested migrations** to production

## Database Backups

### Automated Backups (Recommended)

The project includes automated backup scripts that run daily and store backups both locally and in S3.

**Features:**
- Daily automated backups at 3 AM
- Compressed SQL dumps (gzip)
- 30-day retention policy
- Optional S3 upload for off-site storage
- Detailed logging

**Setup:**

1. **Configure cron job** on the server:
   ```bash
   ssh mantodeus-server
   crontab -e
   ```

2. **Add the following line**:
   ```bash
   0 3 * * * /srv/customer/sites/manager.mantodeus.com/scripts/backup-db.sh >> /srv/customer/sites/manager.mantodeus.com/logs/backup.log 2>&1
   ```

3. **Verify cron job**:
   ```bash
   crontab -l
   ```

**Manual backup:**
```bash
ssh mantodeus-server
cd /srv/customer/sites/manager.mantodeus.com
bash scripts/backup-db.sh
```

**Backup location:**
- Local: `/srv/customer/sites/manager.mantodeus.com/backups/db/`
- S3: `s3://mantodeus-manager-files/backups/db/` (if configured)

### Restore from Backup

**Using the restore script (recommended):**

```bash
ssh mantodeus-server
cd /srv/customer/sites/manager.mantodeus.com

# List available backups
ls -lh backups/db/

# Restore from a specific backup
bash scripts/restore-db.sh backups/db/mantodeus-20251223-030000.sql.gz
```

**Manual restore:**

```bash
# SSH into server
ssh mantodeus-server

# Decompress backup
gunzip -c backups/db/mantodeus-YYYYMMDD-HHMMSS.sql.gz > backup.sql

# Stop application
pnpm pm2 stop mantodeus-manager

# Restore database
mysql -h host -u user -p database_name < backup.sql

# Restart application
pnpm pm2 restart mantodeus-manager
```

### Backup Testing

Test your backup setup before relying on it:

```bash
# 1. Create a test backup
bash scripts/backup-db.sh

# 2. Verify backup was created
ls -lh backups/db/

# 3. Test restore to a temporary database (optional but recommended)
# Create a test database first, then restore to it
```

## Key Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts and authentication |
| `company_settings` | Per-user company information and settings |
| `projects` | Construction projects |
| `project_jobs` | Jobs within projects |
| `project_contacts` | Clients and contractors |
| `project_invoices` | Invoice metadata |
| `project_images` | Image gallery with variants |
| `project_notes` | Notes and documentation |

## Common Queries

### Check Connection

```bash
pnpm db:check-url
```

### View Pending Migrations

```bash
pnpm drizzle-kit check
```

### Reset Database (⚠️ DESTRUCTIVE - Dev Only)

```bash
# Drop all tables
mysql -h host -u user -p database_name -e "DROP DATABASE IF EXISTS database_name; CREATE DATABASE database_name;"

# Reapply all migrations
pnpm db:migrate
```

## Troubleshooting

### Connection Timeout

```
Error: connect ETIMEDOUT
```

**Solutions:**
1. Verify `DATABASE_URL` is correct
2. Check database server is running
3. Verify network connectivity
4. Check firewall rules

### Migration Conflicts

```
Error: Migration X has already been applied
```

**Solutions:**
1. Check migration history: `SELECT * FROM __drizzle_migrations`
2. If needed, manually mark as applied or rolled back
3. Never edit applied migrations

### Schema Drift

```
Error: Your schema is out of sync
```

**Solutions:**
1. Generate new migration: `pnpm db:generate`
2. Review and apply: `pnpm db:migrate`
3. Don't use `db:push` in production

### Duplicate Entry Errors

```
Error: Duplicate entry 'value' for key 'unique_constraint'
```

**Solutions:**
1. Check for race conditions in application code
2. Review unique constraints in schema
3. Consider using database transactions

## Security Best Practices

- ✅ Use strong, unique database passwords
- ✅ Limit database user permissions (no DROP, CREATE USER)
- ✅ Keep `DATABASE_URL` in `.env`, never commit
- ✅ Use SSL/TLS for database connections if available
- ✅ Regular backups with tested restore procedures
- ✅ Monitor slow queries and optimize indexes

## Philosophy

> Migrations are immutable history. Schema changes are explicit and reviewable.
> Direct database modifications bypass version control and break reproducibility.
