# Fix: Deploy Directory Not Found

The `deploy/` directory doesn't exist because the code hasn't been pulled from GitHub yet.

## Step 1: Pull Latest Code

```bash
# Make sure you're in the app directory
cd /srv/customer/sites/manager.mantodeus.com

# Pull the latest code (this will get the deploy directory)
git pull origin main

# Verify deploy directory now exists
ls -la deploy/
```

## Step 2: Install Dependencies

```bash
cd deploy
npm install
```

## Step 3: Start the Webhook Server

```bash
# Use npx to run PM2 (no global install needed)
npx pm2 start deploy.js --name github-webhook
npx pm2 save

# Or run directly for testing
node deploy.js
```

## Step 4: Watch Logs

```bash
# If using PM2
npx pm2 logs github-webhook --lines 0

# Or watch log file
tail -f deploy/deploy.log
```

---

**The key issue:** You need to run `git pull origin main` first to get the deploy directory from GitHub!

