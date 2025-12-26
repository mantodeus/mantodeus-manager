# Database Migration System

This project uses **Drizzle ORM** for database schema management and migrations.

## Overview

- **Schema Definition**: All tables are defined in `drizzle/schema.ts`
- **Migration Files**: SQL migrations are stored in `drizzle/` folder
- **Migration Tracking**: Drizzle tracks applied migrations in the `__drizzle_migrations` table
- **Auto-Deploy**: Migrations run automatically during deployment

## How It Works

### Development Workflow

When you change the database schema:

1. **Edit the schema** in `drizzle/schema.ts`
   ```typescript
   // Example: Add a new column
   export const projects = mysqlTable("projects", {
     id: int("id").primaryKey().autoincrement(),
     name: text("name").notNull(),
     // Add new column:
     priority: text("priority"),
   });
   ```

2. **Generate migration** (creates SQL file):
   ```bash
   npm run db:generate
   ```
   This creates a new file like `drizzle/0014_add_priority_column.sql`

3. **Review the migration** - Check the generated SQL:
   ```sql
   ALTER TABLE `projects` ADD `priority` text;
   ```

4. **Apply locally** (optional, for testing):
   ```bash
   npm run db:migrate:prod
   ```

5. **Commit the migration**:
   ```bash
   git add drizzle/
   git commit -m "feat: add priority column to projects"
   git push
   ```

6. **Deploy** - Migration runs automatically:
   ```bash
   # On server
   bash infra/deploy/deploy.sh
   ```

### Production Deployment

The deploy script (`infra/deploy/deploy.sh`) automatically:

1. Pulls latest code (including new migrations)
2. Installs dependencies
3. Builds the application
4. **Runs `npm run db:migrate:prod`** ← Applies pending migrations
5. Restarts PM2

### Migration Commands

```bash
# Generate new migration from schema changes
npm run db:generate

# Apply migrations (reads SQL files from drizzle/ folder)
npm run db:migrate:prod

# Development: push schema directly (skip migration files)
npm run db:push-direct

# Check database connection
npm run db:check-url
```

**Note**: `db:migrate:prod` uses `drizzle-kit migrate` which applies SQL migration files from the `drizzle/` folder.

## Migration Files

### Location
- **Schema**: `drizzle/schema.ts` - TypeScript table definitions
- **Migrations**: `drizzle/*.sql` - SQL migration files
- **Metadata**: `drizzle/meta/` - Migration snapshots and journal
- **Config**: `drizzle.config.ts` - Drizzle configuration

### Naming Convention
Drizzle auto-generates migration names:
- `0000_baseline.sql` - Initial schema
- `0014_add_priority_column.sql` - Feature migration
- `0015_fix_nullable_dates.sql` - Bug fix migration

### Migration File Example
```sql
-- File: drizzle/0014_add_priority_column.sql
ALTER TABLE `projects` ADD `priority` text;
```

## How Migrations Are Tracked

Drizzle creates a `__drizzle_migrations` table:

```sql
CREATE TABLE __drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
)
```

Each time a migration runs:
1. Drizzle checks `__drizzle_migrations` for applied migrations
2. Runs any new SQL files in `drizzle/` folder
3. Records the hash in `__drizzle_migrations`
4. Skips already-applied migrations on subsequent runs

## Common Scenarios

### Adding a New Table

1. Define in `drizzle/schema.ts`:
   ```typescript
   export const customers = mysqlTable("customers", {
     id: int("id").primaryKey().autoincrement(),
     name: text("name").notNull(),
     email: text("email").notNull(),
     createdAt: timestamp("created_at").defaultNow(),
   });
   ```

2. Generate migration:
   ```bash
   npm run db:generate
   ```

3. Commit and deploy - table will be created automatically

### Adding a Column to Existing Table

1. Edit schema in `drizzle/schema.ts`:
   ```typescript
   export const projects = mysqlTable("projects", {
     // ... existing columns
     estimatedHours: int("estimated_hours"), // NEW
   });
   ```

2. Generate migration:
   ```bash
   npm run db:generate
   ```

3. Review generated SQL:
   ```sql
   ALTER TABLE `projects` ADD `estimated_hours` int;
   ```

4. Commit and deploy

### Renaming a Column

**Warning**: Drizzle treats renames as DROP + ADD, which **loses data**.

**Safe approach**:
1. Add new column
2. Backfill data (copy old → new)
3. Remove old column in separate migration

**Manual approach** (write custom SQL):
```sql
-- File: drizzle/0015_rename_column.sql
ALTER TABLE `projects` RENAME COLUMN `old_name` TO `new_name`;
```

### Rollback (Emergency)

If a migration fails in production:

1. **SSH into server**:
   ```bash
   ssh your-server
   cd /srv/customer/sites/manager.mantodeus.com
   ```

2. **Check migration status**:
   ```bash
   npm run db:check-url
   ```

3. **Manual fix** (if needed):
   ```bash
   # Connect to MySQL
   mysql -h your-host -u your-user -p your-database

   # Check migrations table
   SELECT * FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 5;

   # Remove failed migration (CAREFUL!)
   DELETE FROM __drizzle_migrations WHERE hash = 'abc123...';
   ```

4. **Fix the migration** locally, push, and redeploy

## Best Practices

### ✅ DO:
- Always generate migrations for schema changes (don't push schema directly in production)
- Review generated SQL before committing
- Test migrations locally before deploying
- Use descriptive migration names
- Commit migrations with the code that uses them
- Make migrations backward-compatible when possible

### ❌ DON'T:
- Edit `drizzle/schema.ts` without generating a migration
- Manually edit generated migration files (unless you know what you're doing)
- Delete migration files after they've been applied
- Rename columns directly (use add + backfill + remove instead)
- Run `db:push-direct` in production (it skips migration tracking)

## Troubleshooting

### "Migration failed: Column already exists"

The migration was partially applied. Check `__drizzle_migrations`:
```sql
SELECT * FROM __drizzle_migrations WHERE hash LIKE '%column_name%';
```

If the migration is recorded but incomplete, manually complete it or remove the hash.

### "Cannot find migration files"

Ensure `drizzle/` folder contains `.sql` files and deploy pulled the latest code:
```bash
cd /srv/customer/sites/manager.mantodeus.com
git fetch origin
git reset --hard origin/main
ls drizzle/*.sql  # Verify migrations exist
```

### "Database connection failed"

Check `.env` file on server:
```bash
grep DATABASE_URL .env
```

Test connection:
```bash
npm run db:check-url
```

### Migration runs on every deploy

This is normal! Drizzle checks for pending migrations each time. Already-applied migrations are skipped automatically.

## Schema Guards vs Migrations

**Old approach** (removed):
- `server/_core/schemaGuards.ts` - Runtime table creation
- Created tables on server startup
- ❌ Couldn't alter existing tables

**New approach** (current):
- Drizzle migrations - Declarative SQL files
- Runs during deployment, not startup
- ✅ Handles all schema changes (add/modify/remove columns)

The schema guards were removed in favor of proper migrations. All schema changes now go through Drizzle's migration system.

## Resources

- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Drizzle Kit Migrations](https://orm.drizzle.team/kit-docs/overview#prototyping-with-db-push)
- [Drizzle MySQL Docs](https://orm.drizzle.team/docs/get-started-mysql)

## Summary

1. **Change schema** → Edit `drizzle/schema.ts`
2. **Generate migration** → `npm run db:generate`
3. **Review SQL** → Check `drizzle/*.sql`
4. **Commit** → `git add drizzle/ && git commit`
5. **Deploy** → `bash infra/deploy/deploy.sh` (migrations run automatically)

That's it! Your database schema will stay in sync with your code across all deployments.
