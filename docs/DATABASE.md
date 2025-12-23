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

### Manual Backup

```bash
# SSH into server
ssh mantodeus-server

# Backup database
mysqldump -h host -u user -p database_name > backup_$(date +%Y%m%d_%H%M%S).sql

# Compress backup
gzip backup_*.sql
```

### Restore from Backup

```bash
# Decompress
gunzip backup_YYYYMMDD_HHMMSS.sql.gz

# Restore
mysql -h host -u user -p database_name < backup_YYYYMMDD_HHMMSS.sql
```

### Automated Backups (Recommended)

Set up a cron job on the server:

```bash
# Edit crontab
crontab -e

# Add daily backup at 3 AM
0 3 * * * /path/to/backup-script.sh
```

Example backup script:

```bash
#!/bin/bash
set -e

BACKUP_DIR="/srv/customer/sites/manager.mantodeus.com/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mantodeus_$DATE.sql.gz"

# Load environment variables
source /srv/customer/sites/manager.mantodeus.com/.env

# Extract DB credentials from DATABASE_URL
DB_USER=$(echo $DATABASE_URL | sed -E 's|mysql://([^:]+):.*|\1|')
DB_PASS=$(echo $DATABASE_URL | sed -E 's|mysql://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo $DATABASE_URL | sed -E 's|mysql://[^@]+@([^:]+):.*|\1|')
DB_NAME=$(echo $DATABASE_URL | sed -E 's|mysql://[^/]+/(.+)|\1|')

# Create backup
mysqldump -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" | gzip > "$BACKUP_FILE"

# Keep only last 30 backups
ls -t "$BACKUP_DIR"/*.sql.gz | tail -n +31 | xargs -r rm

echo "Backup completed: $BACKUP_FILE"
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
