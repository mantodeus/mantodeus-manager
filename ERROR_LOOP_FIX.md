# Fix: Error Loop on Infomaniak

## Problem

The server on Infomaniak is stuck in an error loop:

```
Failed to start server: Error: Production build not found at /srv/customer/sites/manager.mantodeus.com/index.js
```

The server keeps restarting and failing because it's looking for a file that doesn't exist at the wrong path.

---

## Root Cause

The deployed code on Infomaniak is **outdated** and contains old startup logic that checks for files in the wrong location.

**What it's looking for:** `/srv/customer/sites/manager.mantodeus.com/index.js`  
**What actually exists:** `/srv/customer/sites/manager.mantodeus.com/dist/index.js` and `/srv/customer/sites/manager.mantodeus.com/dist/public/index.html`

---

## Solution

You need to:
1. **Stop the error loop** (stop PM2)
2. **Pull latest code** from GitHub
3. **Rebuild** the application
4. **Start fresh**

---

## Quick Fix (Recommended)

### Option 1: Run the Fix Script

SSH into your Infomaniak server and run:

```bash
cd /srv/customer/sites/manager.mantodeus.com
bash infra/fix-error-loop.sh
```

Or run remotely from your local machine:

```bash
ssh mantodeus-server 'cd /srv/customer/sites/manager.mantodeus.com && bash infra/fix-error-loop.sh'
```

---

### Option 2: Manual Steps

If you prefer to run commands manually:

```bash
# SSH into server
ssh username@your-server.infomaniak.com

# Navigate to project
cd /srv/customer/sites/manager.mantodeus.com

# Stop PM2 (stop the error loop)
./node_modules/.bin/pm2 stop all
./node_modules/.bin/pm2 delete all

# Kill any process on port 3000
fuser -k 3000/tcp 2>/dev/null || lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Wait a moment
sleep 2

# Pull latest code
git fetch --all
git reset --hard origin/main

# Install dependencies
npm install --include=dev

# Build
npm run build

# Verify build output
ls -lh dist/index.js
ls -lh dist/public/index.html

# Start fresh
./node_modules/.bin/pm2 start npm --name mantodeus-manager -- start
./node_modules/.bin/pm2 save

# Wait and check status
sleep 5
./node_modules/.bin/pm2 list
./node_modules/.bin/pm2 logs mantodeus-manager --lines 50
```

---

## Verification

After running the fix, verify the application is working:

### 1. Check PM2 Status

```bash
./node_modules/.bin/pm2 status
```

Expected output:
```
┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┐
│ id │ name               │ mode     │ ↺    │ status    │ cpu      │
├────┼────────────────────┼──────────┼──────┼───────────┼──────────┤
│ 0  │ mantodeus-manager  │ fork     │ 0    │ online    │ 0%       │
└────┴────────────────────┴──────────┴──────┴───────────┴──────────┘
```

### 2. Check Logs

```bash
./node_modules/.bin/pm2 logs mantodeus-manager --lines 50
```

Expected output should include:
```
Server running on port 3000
```

**Should NOT include:**
```
Failed to start server: Error: Production build not found
```

### 3. Visit the Website

Open your browser and visit:
```
https://manager.mantodeus.com
```

You should see the login page without errors.

---

## Why This Happened

The error loop occurred because:

1. **Old code was deployed** - The server had an outdated version of the code
2. **Startup check was wrong** - Old code checked for files in the wrong location
3. **PM2 kept restarting** - PM2 automatically restarts failed processes, creating a loop
4. **Build wasn't updated** - The old build was still being used

---

## Prevention

To prevent this in the future:

### 1. Always Deploy Latest Code

When deploying, always:
```bash
git pull origin main
npm install --include=dev
npm run build
pm2 restart mantodeus-manager
```

### 2. Use the Deployment Script

Use the deployment script in `infra/deploy/deploy.sh`:
```bash
bash infra/deploy/deploy.sh
```

### 3. Set Up Webhook (Optional)

Set up the GitHub webhook to automatically deploy on push to main:
- See `infra/webhook/webhook-listener.js`
- See `infra/README.md` for setup instructions

---

## Troubleshooting

### If the fix script fails:

**Error: "Permission denied"**
```bash
chmod +x infra/fix-error-loop.sh
bash infra/fix-error-loop.sh
```

**Error: "git pull failed"**
```bash
# Reset to latest main
git fetch --all
git reset --hard origin/main
```

**Error: "npm install failed"**
```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install --include=dev
```

**Error: "npm run build failed"**
```bash
# Check for errors
npm run check

# Try building again
npm run build
```

**Error: "PM2 command not found"**
```bash
# Use npx
npx pm2 stop all
npx pm2 delete all
npx pm2 start npm --name mantodeus-manager -- start
npx pm2 save
```

---

## Still Not Working?

If the application still won't start:

### 1. Check Environment Variables

```bash
# Check if .env exists
ls -la .env

# Check required variables
grep -E "DATABASE_URL|VITE_SUPABASE" .env
```

### 2. Check Database Connection

```bash
# Test database connection
mysql -h your-host -u your-user -p your-database -e "SHOW TABLES;"
```

### 3. Check Port Availability

```bash
# Check if port 3000 is free
lsof -i:3000
netstat -tulpn | grep 3000
```

### 4. Check Disk Space

```bash
df -h
```

### 5. Check Node.js Version

```bash
node --version  # Should be 18+ or 22+
npm --version
```

---

## Contact Support

If you're still experiencing issues after trying all the above steps:

1. Collect the following information:
   - PM2 logs: `pm2 logs mantodeus-manager --lines 100 > pm2-logs.txt`
   - Build output: `npm run build > build-output.txt 2>&1`
   - Environment: `node --version && npm --version`

2. Open an issue on GitHub with the collected information

---

## Summary

**Quick Fix:**
```bash
ssh mantodeus-server 'cd /srv/customer/sites/manager.mantodeus.com && bash infra/fix-error-loop.sh'
```

**What it does:**
1. Stops PM2 error loop
2. Pulls latest code
3. Rebuilds application
4. Starts fresh

**Expected result:**
- ✅ Application running on port 3000
- ✅ No error loop
- ✅ Website accessible at https://manager.mantodeus.com

---

**Status**: Fix script ready  
**Location**: `infra/fix-error-loop.sh`  
**Date**: December 5, 2025
