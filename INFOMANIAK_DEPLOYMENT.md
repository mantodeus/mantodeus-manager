# Infomaniak Deployment Guide

## Overview

This project uses **Infomaniak's Node.js application manager** as the exclusive process manager. The deployment scripts only build the application - they do NOT start or manage the server process.

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
- ❌ **NOT** start or restart the server

### 2. Restart in Infomaniak Control Panel

**⚠️ IMPORTANT:** After deployment, you MUST restart the application in Infomaniak:

1. Log into [Infomaniak control panel](https://www.infomaniak.com/)
2. Navigate to: **Web Hosting** → **Node.js Applications**
3. Find your application: `manager.mantodeus.com` (or preview)
4. Click: **"Restart Application"**

The server will:
- Read `PORT` from `process.env.PORT` (set by Infomaniak)
- Load environment variables from `.env` file at runtime
- Start the Node.js process

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
PORT=3000  # Note: Infomaniak may override this via process.env.PORT
NODE_ENV=production
```

**Important Notes:**
- `VITE_*` variables are embedded at **build time** (during `npm run build`)
- `SUPABASE_SERVICE_ROLE_KEY` and other backend variables are loaded at **runtime** from `.env`
- `PORT` is set by Infomaniak via `process.env.PORT` - the `.env` PORT value is a fallback

### Preview Environment

Same structure, but in `/srv/customer/sites/manager-preview.mantodeus.com/`

## How It Works

### Build Time (Deployment Script)
1. Frontend: Vite embeds `VITE_*` variables into JavaScript bundles
2. Backend: esbuild bundles the server code (variables loaded at runtime)

### Runtime (Infomaniak)
1. Infomaniak runs: `npm start` (which runs `node dist/index.js`)
2. `load-env.ts` loads `.env` file
3. Server reads `PORT` from `process.env.PORT` (Infomaniak sets this)
4. Server starts and serves the application

## Troubleshooting

### Server Not Starting

1. **Check Infomaniak logs:**
   - Infomaniak control panel → Node.js Application → Logs
   - Or SSH: `tail -f /var/log/customer/...` (Infomaniak log location)

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

3. **Restart in Infomaniak control panel**

### Port Conflicts

- Infomaniak manages the port automatically via `process.env.PORT`
- Do NOT manually bind ports in scripts
- Do NOT use `nohup` or background processes
- Let Infomaniak handle all process management

## Disabled Scripts

The following scripts are **disabled** and should NOT be used:

- ❌ `infra/shared/run-background.sh` - Use Infomaniak restart instead
- ❌ `infra/shared/stop-env.sh` - Use Infomaniak stop/restart instead

These scripts will exit with an error if called, directing you to use Infomaniak control panel.

## Local Development

For local development, use:

```bash
pnpm dev
```

This runs the development server with hot reload. It does NOT use Infomaniak process management.

## Summary

✅ **Deploy:** Run deployment script via SSH → Builds the app  
✅ **Restart:** Use Infomaniak control panel → Starts the server  
✅ **Local:** Use `pnpm dev` → Development server  
❌ **Never:** Manually start server via SSH, use nohup, or manage PIDs
