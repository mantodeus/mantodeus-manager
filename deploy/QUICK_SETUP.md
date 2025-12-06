# Quick Setup on Your Server

Based on your server path (`~/sites/manager.mantodeus.com`), here's how to set up the webhook:

## 🚀 On Your Server (SSH)

### Step 1: Navigate to your app directory
```bash
cd ~/sites/manager.mantodeus.com
```

### Step 2: Pull latest code (to get deploy files)
```bash
git pull origin main
```

### Step 3: Run setup script
```bash
chmod +x deploy/setup-on-server.sh
./deploy/setup-on-server.sh
```

**OR manually:**

### Step 3 (Manual): Install and start webhook server
```bash
cd deploy
npm install
```

### Step 4: Update config with your paths
Edit `deploy/deploy.config.json`:
```json
{
  "secret": "mc3t3iyEMTp62ncTB2wnY2H9xvbj/kpn1RIXZ/yq1f8",
  "appPath": "/home/client/sites/manager.mantodeus.com",
  "pm2AppName": "your-pm2-app-name",
  "port": 9000,
  "usePnpm": false,
  "logFile": "./deploy.log"
}
```

**To find your PM2 app name:**
```bash
pm2 list
```

**To find your full app path:**
```bash
pwd
# Should show something like: /home/client/sites/manager.mantodeus.com
```

### Step 5: Start the webhook server
```bash
cd deploy
pm2 start deploy.js --name github-webhook
pm2 save
```

### Step 6: Verify it's running
```bash
# Check status
pm2 status github-webhook

# Check health
curl http://localhost:9000/health

# Watch logs
pm2 logs github-webhook --lines 0
```

## ✅ Test It

1. Make a small commit and push to GitHub
2. Watch the logs:
   ```bash
   tail -f deploy/deploy.log
   # or
   pm2 logs github-webhook --lines 0
   ```

## 🔧 Troubleshooting

**If deploy.log doesn't exist:**
- The webhook server hasn't received any requests yet
- Make sure the server is running: `pm2 status github-webhook`
- Check GitHub webhook is configured correctly

**If webhook server won't start:**
- Check Node.js version: `node --version` (needs 18+)
- Check if port 9000 is available: `netstat -tuln | grep 9000`
- Check logs: `pm2 logs github-webhook`

**If paths are wrong:**
- Get absolute path: `cd ~/sites/manager.mantodeus.com && pwd`
- Update `appPath` in `deploy.config.json`
- Restart: `pm2 restart github-webhook`

