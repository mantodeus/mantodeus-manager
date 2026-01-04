# Smart Idempotent Deployment

The deployment script (`scripts/deploy-prod.sh`) is now **smart and idempotent** - it only runs steps when needed, making it safe to run repeatedly.

## How It Works

### 1. Dependency Detection
- **Checks**: Compares hash of `package.json` + lockfile with last deployment
- **Action**: Only runs `pnpm install` if dependencies changed
- **Result**: Skips expensive installs when nothing changed

### 2. Migration Detection
- **Checks**: Compares count of migration files with last deployment
- **Action**: Only runs `db:migrate` if new migration files exist
- **Note**: `drizzle-kit migrate` is already idempotent, but we skip the call if nothing changed
- **Result**: No wasted migration checks

### 3. Always Builds
- **Always runs**: `npm run build` (code may have changed even if deps/migrations didn't)
- **Reason**: Source code changes don't affect dependency/migration state

### 4. Always Restarts
- **Always runs**: `pm2 restart` (new code is built)
- **Reason**: New build means new code to run

## State Tracking

The script maintains state in `.deploy-state.json`:

```json
{
  "last_deploy": "2026-01-04T02:30:00Z",
  "last_commit": "abc1234...",
  "dependencies_hash": "sha256-hash-of-package-files",
  "migration_count": 15
}
```

This file is updated after each successful deployment.

## Benefits

✅ **Faster deployments** - Skips unnecessary steps  
✅ **Safe to run repeatedly** - No double-migrations, no wasted installs  
✅ **Idempotent** - Same result whether run once or multiple times  
✅ **Smart detection** - Only runs what's needed  

## Example Scenarios

### Scenario 1: Code-only change
```
→ Dependencies: unchanged (skips install)
→ Migrations: unchanged (skips migrate)
→ Build: runs (new code)
→ Restart: runs (new build)
```

### Scenario 2: Dependency update
```
→ Dependencies: changed (runs install)
→ Migrations: unchanged (skips migrate)
→ Build: runs (new code)
→ Restart: runs (new build)
```

### Scenario 3: New migration
```
→ Dependencies: unchanged (skips install)
→ Migrations: changed (runs migrate)
→ Build: runs (new code)
→ Restart: runs (new build)
```

### Scenario 4: Everything changed
```
→ Dependencies: changed (runs install)
→ Migrations: changed (runs migrate)
→ Build: runs (new code)
→ Restart: runs (new build)
```

## Manual Override

To force a full deployment (ignore state):

```bash
# Delete state file
rm .deploy-state.json

# Run deploy
bash scripts/deploy-prod.sh
```

## Webhook Integration

The webhook listener (`infra/webhook/webhook-listener.js`) uses the same smart script, ensuring:
- Webhook deployments are also idempotent
- Same behavior as manual deployments
- Efficient even with frequent pushes

## Troubleshooting

### State file issues
If the state file gets corrupted or you want to reset:

```bash
rm .deploy-state.json
bash scripts/deploy-prod.sh
```

### Dependencies not detected
If dependencies changed but script doesn't detect it:
- Check if `package.json` or lockfile was modified
- Verify state file exists and is readable
- Force reinstall: `rm .deploy-state.json && bash scripts/deploy-prod.sh`

### Migrations not detected
If new migrations exist but script doesn't detect them:
- Check migration files in `drizzle/*.sql`
- Verify state file has correct `migration_count`
- Force migration: `npx pnpm run db:migrate` manually

