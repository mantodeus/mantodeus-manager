# Infomaniak Environment Configuration

This document describes the two-environment setup for the Mantodeus Manager application on Infomaniak hosting.

## Overview

The application runs in two separate environments:

1. **Production** → `https://manager.mantodeus.com`
   - Repository: `/srv/customer/sites/manager.mantodeus.com`
   - Port: `3000`
   - Environment: `APP_ENV=production`

2. **Preview** → `https://nc9eti4he7h.preview.hosting-ik.com`
   - Repository: `/srv/customer/sites/manager-preview.mantodeus.com`
   - Port: `3001`
   - Environment: `APP_ENV=preview`

Both environments use the same codebase but run independently with different configurations.

---

## SSH Connection

The SSH connection is already configured on your machine:

```bash
ssh mantodeus-server
```

This uses the configuration from `~/.ssh/config`:
```
Host mantodeus-server
    HostName 57-105224.ssh.hosting-ik.com
    User M4S5mQQMRhu_mantodeus
    IdentityFile C:/Users/Mantodeus/.ssh/mantodeus_cursor
    Port 22
```

---

## Initial Setup

### Production Setup

Production should already be set up at `/srv/customer/sites/manager.mantodeus.com`. If not:

1. SSH into the server:
   ```bash
   ssh mantodeus-server
   ```

2. Navigate to the sites directory:
   ```bash
   cd /srv/customer/sites
   ```

3. Clone the repository (if not already done):
   ```bash
   git clone <your-github-repo-url> manager.mantodeus.com
   cd manager.mantodeus.com
   ```

4. Create `.env` file from the example:
   ```bash
   # Copy the example and fill in values
   # See Environment Variables section below
   ```

### Preview Setup

1. SSH into the server:
   ```bash
   ssh mantodeus-server
   ```

2. Create the preview directory:
   ```bash
   mkdir -p /srv/customer/sites/manager-preview.mantodeus.com
   cd /srv/customer/sites/manager-preview.mantodeus.com
   ```

3. Clone the repository:
   ```bash
   git clone <your-github-repo-url> .
   ```

4. Create `.env` file for preview:
   ```bash
   # Copy the example and fill in values
   # See Environment Variables section below
   ```

5. Ensure the directory has proper permissions (Infomaniak may handle this automatically).

---

## Environment Variables

### Production Environment Variables

Create `.env` in `/srv/customer/sites/manager.mantodeus.com`:

```bash
# Environment Configuration
APP_ENV=production
PORT=3000
NODE_ENV=production

# Database
DATABASE_URL=mysql://username:password@host:port/database_name

# JWT Secret (generate a random string, at least 32 characters)
JWT_SECRET=your_jwt_secret_here

# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
OWNER_SUPABASE_ID=your_owner_supabase_id_here

# OAuth Configuration
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
VITE_APP_ID=your_app_id_here
OAUTH_SERVER_URL=https://api.manus.im

# S3 Storage (Infomaniak)
# For production, use your production S3 bucket
S3_ENDPOINT=https://s3.pub1.infomaniak.cloud
S3_REGION=us-east-1
S3_BUCKET=your-production-bucket-name
S3_ACCESS_KEY_ID=your_access_key_id
S3_SECRET_ACCESS_KEY=your_secret_access_key

# GitHub Webhook (optional, for auto-deployment)
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# Application Configuration (optional)
VITE_APP_TITLE=Mantodeus Manager
VITE_APP_LOGO=/mantodeus-logo.png
```

### Preview Environment Variables

Create `.env` in `/srv/customer/sites/manager-preview.mantodeus.com`:

```bash
# Environment Configuration
APP_ENV=preview
PORT=3001
NODE_ENV=production

# Database
# Preview can use the same database or a separate preview database
DATABASE_URL=mysql://username:password@host:port/database_name

# JWT Secret (generate a random string, at least 32 characters)
# Use a different secret from production for security
JWT_SECRET=your_preview_jwt_secret_here

# Supabase Configuration
# Preview can use the same Supabase project or a separate one
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
OWNER_SUPABASE_ID=your_owner_supabase_id_here

# OAuth Configuration
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
VITE_APP_ID=your_app_id_here
OAUTH_SERVER_URL=https://api.manus.im

# S3 Storage (Infomaniak)
# For preview, consider using a separate preview bucket
# or prefix your keys with "preview/" to separate from production
S3_ENDPOINT=https://s3.pub1.infomaniak.cloud
S3_REGION=us-east-1
S3_BUCKET=your-preview-bucket-name
S3_ACCESS_KEY_ID=your_access_key_id
S3_SECRET_ACCESS_KEY=your_secret_access_key

# GitHub Webhook (optional, for auto-deployment)
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# Application Configuration (optional)
VITE_APP_TITLE=Mantodeus Manager (Preview)
VITE_APP_LOGO=/mantodeus-logo.png
```

**Important Notes:**
- Use different `JWT_SECRET` values for production and preview
- Consider using separate S3 buckets or key prefixes to avoid data mixing
- Preview can share the same database, but be aware of data conflicts during testing

---

## Deployment

### Deploy Production

**From your local machine:**
```bash
ssh mantodeus-server 'cd /srv/customer/sites/manager.mantodeus.com && bash infra/production/deploy-production.sh'
```

**Or SSH first, then run:**
```bash
ssh mantodeus-server
cd /srv/customer/sites/manager.mantodeus.com
bash infra/production/deploy-production.sh
```

**Or use the local helper script:**
```bash
bash scripts/deploy-production-local.sh
```

The deployment script will:
1. Fetch latest changes from `origin/main`
2. Reset to `origin/main`
3. Install dependencies (using `npm ci` or `pnpm install` based on lockfile)
4. Build the application (`npm run build`)
5. Stop any existing production server
6. Start the server on port 3000 with `APP_ENV=production`
7. Output JSON status indicating success or failure

### Deploy Preview

**From your local machine:**
```bash
ssh mantodeus-server 'cd /srv/customer/sites/manager-preview.mantodeus.com && bash infra/preview/deploy-preview.sh'
```

**Or SSH first, then run:**
```bash
ssh mantodeus-server
cd /srv/customer/sites/manager-preview.mantodeus.com
bash infra/preview/deploy-preview.sh
```

**Or use the local helper script:**
```bash
bash scripts/deploy-preview-local.sh
```

**To use a different branch for preview:**
```bash
PREVIEW_BRANCH=develop bash infra/preview/deploy-preview.sh
```

The deployment script will:
1. Fetch latest changes from `origin/main` (or specified branch)
2. Reset to the target branch
3. Install dependencies
4. Build the application
5. Stop any existing preview server
6. Start the server on port 3001 with `APP_ENV=preview`
7. Output JSON status indicating success or failure

---

## Process Management

**⚠️ IMPORTANT: Process management is handled EXCLUSIVELY by Infomaniak's Node.js application manager.**

The deployment scripts **DO NOT** start or manage the server process. They only:
- Pull latest code
- Install dependencies
- Build the application

### Starting/Stopping the Server

**All server process management must be done via Infomaniak control panel:**

1. Log into [Infomaniak control panel](https://www.infomaniak.com/)
2. Navigate to: **Web Hosting** → **Node.js Applications**
3. Find your application: `manager.mantodeus.com` (or preview)
4. Use the control panel buttons:
   - **Start Application**
   - **Stop Application**
   - **Restart Application** ← Use this after deployment

### After Deployment

**After running the deployment script, you MUST restart the application in Infomaniak:**

```bash
# 1. Deploy (builds the app)
cd ~/sites/manager.mantodeus.com
bash infra/production/deploy-production.sh

# 2. Then restart in Infomaniak control panel (see above)
```

The server will:
- Read `PORT` from `process.env.PORT` (set by Infomaniak automatically)
- Load environment variables from `.env` file at runtime
- Start via `npm start` (which runs `node dist/index.js`)

### Disabled Scripts

The following scripts are **disabled** and should NOT be used:
- ❌ `infra/shared/run-background.sh` - Use Infomaniak restart instead
- ❌ `infra/shared/stop-env.sh` - Use Infomaniak stop/restart instead

These scripts will exit with an error if called, directing you to use Infomaniak control panel.

---

## Logs

### View Production Logs

```bash
# Tail logs in real-time
tail -f /srv/customer/sites/manager.mantodeus.com/logs/production.log

# View last 100 lines
tail -n 100 /srv/customer/sites/manager.mantodeus.com/logs/production.log

# View entire log
cat /srv/customer/sites/manager.mantodeus.com/logs/production.log
```

### View Preview Logs

```bash
# Tail logs in real-time
tail -f /srv/customer/sites/manager-preview.mantodeus.com/logs/preview.log

# View last 100 lines
tail -n 100 /srv/customer/sites/manager-preview.mantodeus.com/logs/preview.log

# View entire log
cat /srv/customer/sites/manager-preview.mantodeus.com/logs/preview.log
```

---

## Infomaniak Control Panel Configuration

In the Infomaniak control panel, configure the domain mappings:

1. **Production Domain:**
   - Domain: `manager.mantodeus.com`
   - Document root: `/srv/customer/sites/manager.mantodeus.com`
   - Start command: `npm start` (Infomaniak runs this automatically)
   - Port: Set automatically by Infomaniak via `process.env.PORT`

2. **Preview Domain:**
   - Domain: `nc9eti4he7h.preview.hosting-ik.com` (or mapped vhost)
   - Document root: `/srv/customer/sites/manager-preview.mantodeus.com`
   - Start command: `npm start` (Infomaniak runs this automatically)
   - Port: Set automatically by Infomaniak via `process.env.PORT`

**Important:** The server reads `PORT` from `process.env.PORT` (set by Infomaniak). The `.env` file's `PORT` value is only a fallback and may be overridden by Infomaniak.

---

## Troubleshooting

### Server Won't Start

1. **Check Infomaniak logs:**
   - Infomaniak control panel → Node.js Application → Logs
   - Or check application status in control panel

2. **Verify build output exists:**
   ```bash
   ls -la dist/index.js dist/public
   ```

3. **Verify environment variables are set:**
   ```bash
   cat .env | grep -E "APP_ENV|VITE_SUPABASE|SUPABASE_SERVICE"
   ```

4. **Restart in Infomaniak control panel:**
   - Sometimes a restart fixes issues
   - The control panel will show any startup errors

### Build Fails

1. Check Node.js version:
   ```bash
   node --version
   ```

2. Check if dependencies are installed:
   ```bash
   ls -la node_modules
   ```

3. Try cleaning and rebuilding:
   ```bash
   rm -rf node_modules dist
   npm ci  # or pnpm install
   npm run build
   ```

### Application Not Running

If the application is not running in Infomaniak:

1. **Check Infomaniak control panel:**
   - Navigate to Node.js Application
   - Check application status
   - View logs for errors

2. **Restart via Infomaniak control panel:**
   - Click "Restart Application"
   - Check logs after restart

3. **Verify deployment completed:**
   ```bash
   ls -la dist/index.js dist/public
   ```

---

## Architecture Notes

### Port Configuration

The server reads the port from `process.env.PORT` (set by Infomaniak):
```typescript
const port = parseInt(process.env.PORT || "3000");
```

**Important:**
- Infomaniak sets `process.env.PORT` automatically
- The `.env` file's `PORT` value is only a fallback
- Do NOT manually bind ports in scripts
- Let Infomaniak manage the port assignment

### Environment Awareness

The application can distinguish between environments using `APP_ENV`:
- `APP_ENV=production` → Production environment
- `APP_ENV=preview` → Preview environment

Access in code via `ENV.appEnv` or `ENV.runtimeEnv` from `server/_core/env.ts`.

This allows environment-specific logic such as:
- Different S3 buckets
- Different logging levels
- Different feature flags
- Different database connections (if needed)

---

## Quick Reference

### Deploy Production
```bash
ssh mantodeus-server 'cd /srv/customer/sites/manager.mantodeus.com && bash infra/production/deploy-production.sh'
```

### Deploy Preview
```bash
ssh mantodeus-server 'cd /srv/customer/sites/manager-preview.mantodeus.com && bash infra/preview/deploy-preview.sh'
```

### View Production Logs
```bash
ssh mantodeus-server 'tail -f /srv/customer/sites/manager.mantodeus.com/logs/production.log'
```

### View Preview Logs
```bash
ssh mantodeus-server 'tail -f /srv/customer/sites/manager-preview.mantodeus.com/logs/preview.log'
```

### Restart Production (After Deployment)
1. Run deployment script (see "Deploy Production" above)
2. Log into Infomaniak control panel
3. Navigate to Node.js Application → manager.mantodeus.com
4. Click "Restart Application"

### Restart Preview (After Deployment)
1. Run deployment script (see "Deploy Preview" above)
2. Log into Infomaniak control panel
3. Navigate to Node.js Application → manager-preview.mantodeus.com
4. Click "Restart Application"

---

## File Structure

```
mantodeus-manager/
├── infra/
│   ├── shared/
│   │   ├── run-background.sh      # ⚠️ DISABLED - Use Infomaniak restart
│   │   └── stop-env.sh            # ⚠️ DISABLED - Use Infomaniak stop/restart
│   ├── production/
│   │   └── deploy-production.sh   # Production deployment (builds only)
│   └── preview/
│       └── deploy-preview.sh      # Preview deployment (builds only)
├── scripts/
│   ├── deploy-production-local.sh # Local helper (prints command)
│   └── deploy-preview-local.sh     # Local helper (prints command)
└── docs/
    └── INFOMANIAK_ENVIRONMENTS.md  # This file
```

---

## Notes

- All scripts use `#!/usr/bin/env bash` and `set -euo pipefail` for safety
- Scripts output JSON status for easy parsing
- **Process management is handled EXCLUSIVELY by Infomaniak** - deployment scripts only build
- Both environments can run simultaneously (Infomaniak manages ports automatically)
- The preview environment defaults to the `main` branch but can be configured to use `develop` or any other branch
- After deployment, always restart the application in Infomaniak control panel
- The server reads `PORT` from `process.env.PORT` (set by Infomaniak), not from `.env` file

