# Migration to Infomaniak-Only Process Control

## Summary

This project has been migrated to use **Infomaniak's Node.js application manager** as the exclusive process manager. All manual process management scripts have been disabled.

## Changes Made

### 1. ✅ Disabled Background Process Scripts

**Files Modified:**
- `infra/shared/run-background.sh` - Now exits with error, directing users to Infomaniak control panel
- `infra/shared/stop-env.sh` - Now exits with error, directing users to Infomaniak control panel

These scripts are kept for reference but will not execute. They display clear error messages directing users to use Infomaniak control panel instead.

### 2. ✅ Updated Deployment Scripts

**Files Modified:**
- `infra/production/deploy-production.sh` - Removed all start/stop logic, only builds
- `infra/preview/deploy-preview.sh` - Removed all start/stop logic, only builds

**What they do now:**
- ✅ Pull latest code from Git
- ✅ Install dependencies (`npm install`)
- ✅ Build the application (`npm run build`)
- ✅ Verify build outputs
- ❌ **DO NOT** start or restart the server
- ❌ **DO NOT** manage processes
- ❌ **DO NOT** create PID files

**What they tell you:**
- Clear instructions to restart in Infomaniak control panel
- Reminder that Infomaniak manages the process

### 3. ✅ Updated Local Helper Scripts

**Files Modified:**
- `scripts/deploy-production-local.sh` - Added Infomaniak restart instructions
- `scripts/deploy-preview-local.sh` - Added Infomaniak restart instructions

### 4. ✅ Server Configuration Verified

**File Checked:**
- `server/_core/index.ts` - Already correctly reads `PORT` from `process.env.PORT`

The server code was already correct:
```typescript
const port = parseInt(process.env.PORT || "3000");
```

This means:
- Infomaniak sets `process.env.PORT` automatically
- Server uses that port (or falls back to 3000)
- No manual port binding needed

### 5. ✅ Environment Variable Loading

**File Verified:**
- `server/_core/load-env.ts` - Already correctly loads `.env` at runtime

The environment loading works correctly:
- Backend loads `.env` at runtime via `load-env.ts`
- Frontend embeds `VITE_*` variables at build time
- No missing variable errors

### 6. ✅ Documentation Updated

**Files Created/Updated:**
- `INFOMANIAK_DEPLOYMENT.md` - New comprehensive deployment guide
- `docs/INFOMANIAK_ENVIRONMENTS.md` - Updated to reflect Infomaniak-only process control
- `README.md` - Added Infomaniak deployment section

### 7. ✅ Removed PID File Logic

- All PID file creation/reading removed from deployment scripts
- PID files are already in `.gitignore` (no changes needed)
- No scripts attempt to manage processes via PID files

## Deployment Workflow

### Before (Old Way - DISABLED)
```bash
# ❌ OLD - No longer works
bash infra/production/deploy-production.sh  # Would start server
bash infra/shared/stop-env.sh production   # Would stop server
bash infra/shared/run-background.sh production 3000  # Would start server
```

### After (New Way - CORRECT)
```bash
# ✅ NEW - Correct workflow
# 1. Deploy (builds only)
bash infra/production/deploy-production.sh

# 2. Restart in Infomaniak control panel
#    - Log into Infomaniak
#    - Navigate to Node.js Applications
#    - Click "Restart Application"
```

## Verification Checklist

- [x] `run-background.sh` disabled (exits with error)
- [x] `stop-env.sh` disabled (exits with error)
- [x] `deploy-production.sh` only builds (no start/stop)
- [x] `deploy-preview.sh` only builds (no start/stop)
- [x] No `nohup` usage in deployment scripts
- [x] No PID file creation in deployment scripts
- [x] Server reads `PORT` from `process.env.PORT` ✅ (already correct)
- [x] Environment variables load correctly ✅ (already correct)
- [x] Documentation updated
- [x] Local helper scripts updated

## What Still Works

✅ **Local Development:**
```bash
pnpm dev  # Runs development server normally
```

✅ **Build Process:**
```bash
pnpm run build  # Builds the application
```

✅ **Server Runtime:**
- Infomaniak runs: `npm start` (which runs `node dist/index.js`)
- Server loads `.env` at runtime
- Server reads `PORT` from `process.env.PORT`

## What's Disabled

❌ **Manual Process Management:**
- `run-background.sh` - Disabled
- `stop-env.sh` - Disabled
- Any `nohup` usage - Removed
- PID file management - Removed

## Next Steps

1. **Commit and push these changes**
2. **On the server, pull the latest code**
3. **Run the deployment script** (it will only build now)
4. **Restart the application in Infomaniak control panel**

## Important Notes

- **Never manually start the server via SSH** - Use Infomaniak control panel
- **Never use `nohup` or background processes** - Infomaniak manages this
- **Never create PID files** - Not needed with Infomaniak
- **Always restart in Infomaniak after deployment** - The deployment script doesn't restart

## Support

If you encounter issues:
1. Check `INFOMANIAK_DEPLOYMENT.md` for detailed instructions
2. Check `docs/INFOMANIAK_ENVIRONMENTS.md` for environment setup
3. Verify the application is running in Infomaniak control panel
4. Check Infomaniak logs for errors

