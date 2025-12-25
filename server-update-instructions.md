# Server Update Instructions - Complete Recovery

## Problems Fixed
1. **ENV Import Error**: Server crashed with "ReferenceError: ENV is not defined"
2. **Package Manager Mismatch**: Deploy script was using `npm` instead of `pnpm`
3. **SSH Disconnection**: Long-running npm install caused SSH timeout

## Solution - Complete Deployment

Two fixes have been pushed to main:
- **Commit 64c6848**: Added missing ENV import in server index
- **Commit 519bb52**: Updated deploy scripts to use pnpm

### Step 1: Reconnect to Server

```bash
ssh M4S5mQQMRhu_mantodeus@57-105224.ssh.hosting-ik.com
cd /srv/customer/sites/manager.mantodeus.com
```

### Step 2: Pull Latest Code

```bash
git fetch origin
git reset --hard origin/main
```

You should now be at commit `519bb52`.

### Step 3: Install Dependencies (in background to prevent SSH timeout)

```bash
bash infra/deploy/install-deps.sh
```

This will start pnpm install in the background. The script will output:
```
✅ pnpm install started in background
📝 Log file: pnpm-install.log
```

### Step 4: Monitor Installation Progress

```bash
tail -f pnpm-install.log
```

Wait until you see installation complete (look for "Done in XXs" or similar pnpm completion message). Press `Ctrl+C` to exit the tail command.

**Note**: This may take 5-15 minutes. You can safely disconnect from SSH and reconnect later.

### Step 5: Build the Project

```bash
npm run build
```

Expected output:
```
✅ Loaded environment variables from .env
✨ BUILD COMPLETED SUCCESSFULLY! ✨
```

### Step 6: Restart PM2

```bash
pm2 restart mantodeus-manager
```

### Step 7: Verify Deployment

```bash
# Check PM2 status - should show "online" with stable uptime
pm2 status

# View logs (should NOT show ENV errors)
pm2 logs mantodeus-manager --lines 30

# Test localhost health endpoint
curl http://localhost:3000/api/health
```

Expected health check response:
```json
{
  "status": "ok",
  "version": "519bb52",
  "timestamp": "2025-12-25T...",
  "node": "v22.x.x",
  "uptime": 123,
  "buildId": "perf-fix-2024-12-17"
}
```

### Step 8: Test Public URL

```bash
curl https://manager.mantodeus.com/api/health
```

Or visit https://manager.mantodeus.com in your browser.

## Alternative: Use Full Deploy Script

Once the code is pulled, you can try the full deploy script:

```bash
bash infra/deploy/deploy.sh
```

However, this may still cause SSH disconnection during the pnpm install step. If it disconnects:
1. Reconnect to SSH
2. Run `bash infra/deploy/install-deps.sh` to resume
3. Wait for installation to complete
4. Continue with build and PM2 restart

## What Was Fixed

### Fix 1: Missing ENV Import (64c6848)

**File**: `server/_core/index.ts`

**Before**:
```typescript
import "./load-env.js";
// ENV object used but never imported!
```

**After**:
```typescript
import "./load-env.js";
import { ENV } from "./env.js";
```

### Fix 2: Package Manager (519bb52)

**File**: `infra/deploy/deploy.sh`

**Before**:
```bash
if [ -f "package-lock.json" ]; then
  INSTALL_CMD="npm ci"
else
  INSTALL_CMD="npm install"
fi
```

**After**:
```bash
INSTALL_CMD="npx pnpm install --frozen-lockfile"
```

**File**: `infra/deploy/install-deps.sh`

**Before**:
```bash
INSTALL_CMD="npm ci"  # or npm install
```

**After**:
```bash
INSTALL_CMD="npx pnpm install --frozen-lockfile"
```

## Troubleshooting

### If pnpm install fails:

```bash
# Clear caches and retry
rm -rf node_modules
npx pnpm store prune
npx pnpm install --frozen-lockfile
```

### If build fails:

```bash
# Check .env file has all required variables
cat .env

# Verify you have OWNER_SUPABASE_ID set
grep OWNER_SUPABASE_ID .env
```

### If PM2 won't start:

```bash
# Check for port conflicts
pm2 delete mantodeus-manager
pm2 start ecosystem.config.js

# View detailed logs
pm2 logs mantodeus-manager
```

### If still seeing maintenance page:

```bash
# Verify PM2 is running
pm2 status

# Test localhost directly (bypasses reverse proxy)
curl http://localhost:3000/api/health

# If localhost works but public URL doesn't, it's an Infomaniak reverse proxy issue
# Contact Infomaniak support or check web server configuration
```
