# Test the Webhook Deployment - Step by Step

## 🚀 Step 1: Set Up on Your Server

SSH into your server and run:

```bash
# 1. Navigate to your app
cd ~/sites/manager.mantodeus.com

# 2. Pull the latest code (to get deploy files)
git pull origin main

# 3. Verify deploy directory exists
ls -la deploy/

# 4. Install webhook server dependencies
cd deploy
npm install

# 5. Find your PM2 app name
pm2 list
# Note the name (might be "manager" or something similar)

# 6. Get your full app path
pwd
# Note the full path (should be something like /home/client/sites/manager.mantodeus.com)

# 7. Update config with correct values
nano deploy.config.json
# Update:
# - "appPath": use the full path from step 6
# - "pm2AppName": use the name from step 5
# Save and exit (Ctrl+X, then Y, then Enter)

# 8. Start the webhook server
pm2 start deploy.js --name github-webhook
pm2 save

# 9. Verify it's running
pm2 status github-webhook
pm2 logs github-webhook --lines 10
```

## 🧪 Step 2: Test the Webhook

### Option A: Make a Test Commit (Recommended)

On your **local machine**, make a small change:

```bash
# In your local repo
echo "Webhook test: $(Get-Date)" >> test-webhook.txt
git add test-webhook.txt
git commit -m "Test: Trigger webhook deployment"
git push origin main
```

### Option B: Use GitHub's Redeliver

1. Go to your GitHub repository
2. **Settings** → **Webhooks** → Your webhook
3. Click on a recent delivery
4. Click **"Redeliver"**

## 👀 Step 3: Watch the Deployment

On your **server**, watch the logs:

```bash
# Watch logs in real-time
tail -f deploy/deploy.log

# OR watch PM2 logs
pm2 logs github-webhook --lines 0
```

## ✅ Step 4: What to Look For

### Success Indicators:

```
[INFO] Webhook received - Event: push, Ref: refs/heads/main
[INFO] Push to main/master detected, starting deployment...
[INFO] Starting deployment...
[INFO] Executing: cd /path/to/app && git pull && npm ci && npm run build && pm2 restart app
[INFO] Deployment successful!
[SUCCESS] Deployment completed successfully
```

### Check GitHub Webhook Delivery:

1. Go to: **Repository** → **Settings** → **Webhooks** → Your webhook
2. Click **"Recent Deliveries"**
3. Latest delivery should show:
   - ✅ **200 OK** status
   - Response: "Deployment started"

## 🐛 Troubleshooting

**If webhook doesn't trigger:**
- Check webhook server is running: `pm2 status github-webhook`
- Check GitHub webhook URL is correct
- Verify secret matches in both places

**If deployment fails:**
- Check logs: `tail -n 50 deploy/deploy.log`
- Verify `appPath` is correct
- Verify `pm2AppName` matches your PM2 process
- Check permissions on app directory

---

**Ready?** Start with Step 1 on your server! 🚀

