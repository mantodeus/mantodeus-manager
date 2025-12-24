# Server Update Instructions - ENV Import Fix

## Problem
The server crashes on startup with "ReferenceError: ENV is not defined" error. This is because the `server/_core/index.ts` file was missing the import statement for the ENV object.

## Solution

The fix has been pushed to the main branch. Run the deployment script to pull the latest code and restart:

```bash
cd /srv/customer/sites/manager.mantodeus.com
bash infra/deploy/deploy.sh
```

## What the Deploy Script Will Do

1. Pull latest code from GitHub (includes the ENV import fix)
2. Install dependencies with pnpm
3. Build the project with `npm run build`
4. Restart PM2 with the new code

## Verify Deployment

After deployment completes, check that the server is running:

```bash
# Check PM2 status - should show "online" with stable uptime
pm2 status

# View recent logs
pm2 logs mantodeus-manager --lines 50

# Test the health endpoint
curl https://manager.mantodeus.com/api/health
```

Expected health check response:
```json
{
  "status": "ok",
  "version": "64c6848",
  "timestamp": "2025-12-25T...",
  "node": "v22.x.x",
  "uptime": 123,
  "buildId": "perf-fix-2024-12-17"
}
```

## Manual Steps (if deploy script fails)

If the automated deploy script fails, run these commands manually:

```bash
cd /srv/customer/sites/manager.mantodeus.com

# 1. Pull the latest code
git fetch origin
git reset --hard origin/main

# 2. Install dependencies
npx pnpm install

# 3. Build the project
npm run build

# 4. Restart PM2
pm2 restart mantodeus-manager

# 5. Check logs
pm2 logs mantodeus-manager
```

## What Was Fixed

**File**: `server/_core/index.ts`
**Change**: Added `import { ENV } from "./env.js";` after the load-env import

**Before** (broken):
```typescript
import "./load-env.js";

import express from "express";
// ... other imports
```

**After** (fixed):
```typescript
import "./load-env.js";
import { ENV } from "./env.js";

import express from "express";
// ... other imports
```

The `ENV` object is exported from `server/_core/env.ts` and contains all validated environment configuration. It was being referenced in the code (lines 475, 519, 548) but never imported, causing the ReferenceError when the server tried to start.
