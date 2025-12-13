# Infomaniak Deployment Guide

## Overview

This project uses **PM2** for process management. The deployment scripts pull/build and then restart the running PM2 process.

## Deployment Process

### 1. Deploy via SSH

SSH into your Infomaniak server and run the deployment script:

**Production:**
```bash
cd ~/sites/manager.mantodeus.com
bash infra/production/deploy-production.sh
```

**Preview:**
```bash
cd ~/sites/manager-preview.mantodeus.com
bash infra/preview/deploy-preview.sh
```

The deployment script will:
- ✅ Pull latest code from Git
- ✅ Install dependencies (`npm install`)
- ✅ Build the application (`npm run build`)
- ✅ Verify build outputs exist
- ✅ Restart the server via PM2 (`npx pm2 restart ...`)

### 2. Restart (PM2)

The deployment scripts already restart via PM2. If you need to restart manually:

```bash
npx pm2 restart mantodeus-manager
```

## Environment Variables

### Production Environment

Create/update `.env` in `/srv/customer/sites/manager.mantodeus.com/`:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Database
DATABASE_URL=mysql://username:password@host:port/database_name

# JWT Secret
JWT_SECRET=your_jwt_secret_here

# Application Configuration
APP_ENV=production
PORT=3000  # Note: your hosting may override this via process.env.PORT
NODE_ENV=production
```

**Important Notes:**
- `VITE_*` variables are embedded at **build time** (during `npm run build`)
- `SUPABASE_SERVICE_ROLE_KEY` and other backend variables are loaded at **runtime** from `.env`
- `PORT` may be set by the host via `process.env.PORT` - the `.env` PORT value is a fallback

### Preview Environment

Same structure, but in `/srv/customer/sites/manager-preview.mantodeus.com/`

## How It Works

### Build Time (Deployment Script)
1. Frontend: Vite embeds `VITE_*` variables into JavaScript bundles
2. Backend: esbuild bundles the server code (variables loaded at runtime)

### Runtime (PM2)
1. PM2 runs the configured start command/script (e.g. via `ecosystem.config.js`)
2. `load-env.ts` loads `.env` file
3. Server reads `PORT` from `process.env.PORT` (if set) or falls back to `3000`
4. Server starts and serves the application

## Troubleshooting

### Server Not Starting

1. **Check PM2 logs:**
   ```bash
   pm2 logs mantodeus-manager --lines 200
   ```

2. **Verify build outputs exist:**
   ```bash
   ls -la dist/index.js dist/public
   ```

3. **Check environment variables:**
   ```bash
   cat .env | grep -E "VITE_SUPABASE|SUPABASE_SERVICE"
   ```

4. **Verify PORT is set:**
   - Infomaniak sets `process.env.PORT` automatically
   - The server reads: `process.env.PORT || 3000`

### "Invalid API key" Error

This means the Supabase anon key wasn't embedded correctly at build time:

1. **Verify `.env` has correct keys:**
   ```bash
   cat .env | grep VITE_SUPABASE_ANON_KEY
   ```

2. **Rebuild the application:**
   ```bash
   npm run build
   ```

3. **Restart via PM2:**
   ```bash
   npx pm2 restart mantodeus-manager
   ```

### Port Conflicts

- Prefer using `process.env.PORT` if your host sets it
- Avoid `nohup`/PID files for production; use PM2 to manage the process

## Disabled Scripts

The following scripts are **disabled** and should NOT be used:

- ❌ `infra/shared/run-background.sh` - Use PM2 + the deploy scripts instead
- ❌ `infra/shared/stop-env.sh` - Use PM2 + the deploy scripts instead

These scripts will exit with an error if called, directing you to use PM2.

## Local Development

For local development, use:

```bash
pnpm dev
```

This runs the development server with hot reload. It does NOT use Infomaniak process management.

## Summary

✅ **Deploy:** Run deployment script via SSH → Builds the app  
✅ **Restart:** Use PM2 (`npx pm2 restart mantodeus-manager`)  
✅ **Local:** Use `pnpm dev` → Development server  
❌ **Never:** Use `nohup`/PID-file process management for production
