# Quick Start - Test Your Webhook

## ⚡ Before Testing

Make sure you've updated `deploy.config.json` on your **server** with:

```json
{
  "secret": "your-secret-here",
  "appPath": "/var/www/mantodeus-manager",  // ← UPDATE THIS
  "pm2AppName": "mantodeus-manager",        // ← UPDATE THIS (check with: pm2 list)
  "port": 9000,
  "usePnpm": false,
  "logFile": "./deploy.log"
}
```

## 🚀 On Your Server

### 1. Install Dependencies
```bash
cd /path/to/mantodeus-manager/deploy
npm install
```

### 2. Start the Webhook Server
```bash
pm2 start deploy.js --name github-webhook
pm2 save
```

### 3. Verify It's Running
```bash
# Check health
curl http://localhost:9000/health

# Or check PM2
pm2 status github-webhook
pm2 logs github-webhook
```

## 🧪 Test It Now!

### Option 1: Make a Test Commit (Easiest)

1. **On your local machine**, make a small change:
   ```bash
   echo "Test: $(date)" >> test-webhook.txt
   git add test-webhook.txt
   git commit -m "Test: Trigger webhook deployment"
   git push origin main
   ```

2. **On your server**, watch the logs:
   ```bash
   tail -f deploy/deploy.log
   # or
   pm2 logs github-webhook --lines 0
   ```

3. **Check GitHub**:
   - Go to: Repository → Settings → Webhooks
   - Click on your webhook
   - Check "Recent Deliveries" for the latest push

### Option 2: Check GitHub Webhook Status

1. Go to your repository on GitHub
2. Settings → Webhooks → Your webhook
3. Check "Recent Deliveries"
4. Click on the latest delivery to see:
   - Request payload
   - Response (should be 200)
   - Delivery status

## ✅ What Success Looks Like

**In the logs, you should see:**
```
[INFO] Webhook received - Event: push, Ref: refs/heads/main
[INFO] Push to main/master detected, starting deployment...
[INFO] Starting deployment...
[INFO] Executing: cd /path/to/app && git pull && npm ci && npm run build && pm2 restart app
[INFO] Deployment successful!
[SUCCESS] Deployment completed successfully
```

**In GitHub webhook delivery:**
- Status: ✅ 200 OK
- Response: "Deployment started"

## 🐛 Troubleshooting

**If webhook isn't triggering:**
- ✅ Check webhook server is running: `pm2 status github-webhook`
- ✅ Check GitHub webhook URL is correct
- ✅ Verify secret matches in both places
- ✅ Check firewall allows port 9000

**If deployment fails:**
- ✅ Check `appPath` is correct
- ✅ Check `pm2AppName` matches your PM2 process
- ✅ Verify you have permissions to the app directory
- ✅ Check logs: `tail -n 50 deploy/deploy.log`

---

**Ready?** Make a test commit and push! 🚀

