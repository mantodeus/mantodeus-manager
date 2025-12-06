# Setup Webhook on Infomaniak Server

Based on your server setup, here's the correct way to set it up:

## Step 1: Pull Latest Code (Get Deploy Directory)

```bash
cd /srv/customer/sites/manager.mantodeus.com
git pull origin main

# Verify deploy directory exists
ls -la deploy/
```

## Step 2: Install PM2 Locally (Not Globally)

Since you can't install globally, install PM2 locally:

```bash
cd deploy
npm install pm2 --save-dev
```

## Step 3: Update Config

The config should already have the correct path: `/srv/customer/sites/manager.mantodeus.com`

Check your PM2 app name:
```bash
# If you have PM2 running your main app, check:
# (You might need to use npx or check how your app is running)

# Find your app's process name
ps aux | grep node
```

## Step 4: Start Webhook Server

### Option A: Use npx (Recommended - No Installation)

```bash
cd /srv/customer/sites/manager.mantodeus.com/deploy
npx pm2 start deploy.js --name github-webhook
npx pm2 save
```

### Option B: Use Local PM2

```bash
cd /srv/customer/sites/manager.mantodeus.com/deploy
./node_modules/.bin/pm2 start deploy.js --name github-webhook
./node_modules/.bin/pm2 save
```

### Option C: Run Directly (For Testing)

```bash
cd /srv/customer/sites/manager.mantodeus.com/deploy
node deploy.js
```

**Note:** This runs in foreground. Press Ctrl+C to stop. For production, use PM2.

## Step 5: Verify It's Running

```bash
# Check with npx
npx pm2 list

# Or check process
ps aux | grep deploy.js

# Check health
curl http://localhost:9000/health
```

## Step 6: Watch Logs

```bash
# If using PM2
npx pm2 logs github-webhook --lines 0

# Or watch log file directly
tail -f deploy/deploy.log
```

---

**Quick Commands Summary:**

```bash
# 1. Pull code
cd /srv/customer/sites/manager.mantodeus.com
git pull origin main

# 2. Install dependencies
cd deploy
npm install

# 3. Start with npx (easiest)
npx pm2 start deploy.js --name github-webhook
npx pm2 save

# 4. Watch logs
npx pm2 logs github-webhook --lines 0
```

