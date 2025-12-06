# GitHub Webhook Deployment Server

This webhook server automatically deploys your application when you push to GitHub.

## 🚀 Quick Setup

### Step 1: Configure the Webhook Server

1. Edit `deploy.config.json` and update these values:

```json
{
  "secret": "your-random-secret-string-here",
  "appPath": "/var/www/mantodeus-manager",
  "pm2AppName": "mantodeus-manager",
  "port": 9000,
  "usePnpm": false,
  "logFile": "./deploy.log"
}
```

**Important Settings:**
- `secret`: Generate a random string (e.g., `openssl rand -hex 32`) - you'll use this in GitHub
- `appPath`: Full path to your Node.js application directory
- `pm2AppName`: The name of your PM2 process (check with `pm2 list`)
- `usePnpm`: Set to `true` if you use pnpm, `false` for npm
- `port`: Port for the webhook server (default: 9000)

### Step 2: Install Dependencies

```bash
cd deploy
npm install
```

### Step 3: Start the Webhook Server

**Option A: Using PM2 (Recommended)**

```bash
pm2 start deploy.js --name github-webhook
pm2 save
pm2 startup  # Run this once to start on boot
```

**Option B: Using Screen**

```bash
screen -S webhook
node deploy.js
# Press Ctrl+A then D to detach
```

**Option C: Using Systemd (Linux)**

Create `/etc/systemd/system/github-webhook.service`:

```ini
[Unit]
Description=GitHub Webhook Deployment Server
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/deploy
ExecStart=/usr/bin/node deploy.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable github-webhook
sudo systemctl start github-webhook
```

### Step 4: Configure GitHub Webhook

1. Go to your GitHub repository
2. Navigate to **Settings** → **Webhooks** → **Add webhook**
3. Configure:
   - **Payload URL**: `https://your-domain.com:9000/github-webhook`
   - **Content type**: `application/json`
   - **Secret**: Same value as in `deploy.config.json`
   - **Which events**: Select "Just the push event"
4. Click **Add webhook**

### Step 5: Test the Deployment

1. Make a small change in your repository
2. Commit and push to `main` or `master` branch
3. Check the logs:
   ```bash
   tail -f deploy/deploy.log
   # or if using PM2:
   pm2 logs github-webhook
   ```

## 📋 What Happens on Deployment

When you push to GitHub, the webhook server will:

1. ✅ Verify the webhook signature (security)
2. ✅ Pull latest code (`git pull`)
3. ✅ Install dependencies (`npm ci` or `pnpm install`)
4. ✅ Build the application (`npm run build` or `pnpm build`)
5. ✅ Restart the app (`pm2 restart <app-name>`)

## 🔒 Security Recommendations

### 1. Use HTTPS

The webhook server should run behind HTTPS. Use a reverse proxy (Nginx) with SSL:

**Nginx Configuration:**

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /github-webhook {
        proxy_pass http://localhost:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Firewall Configuration

Only allow GitHub IP ranges (optional but recommended):

```bash
# Get GitHub webhook IPs
# GitHub publishes their IP ranges at: https://api.github.com/meta

# Example: Allow only GitHub IPs
sudo ufw allow from 140.82.112.0/20 to any port 9000
```

### 3. Strong Secret

Generate a strong secret:

```bash
openssl rand -hex 32
```

Use this value in both `deploy.config.json` and GitHub webhook settings.

## 📊 Monitoring

### View Logs

```bash
# Real-time logs
tail -f deploy/deploy.log

# Last 50 lines
tail -n 50 deploy/deploy.log

# If using PM2
pm2 logs github-webhook
```

### Health Check

The server includes a health check endpoint:

```bash
curl http://localhost:9000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-29T12:00:00.000Z",
  "config": {
    "appPath": "/var/www/mantodeus-manager",
    "pm2AppName": "mantodeus-manager",
    "usePnpm": false
  }
}
```

## 🐛 Troubleshooting

### Webhook Not Triggering

1. **Check GitHub webhook delivery logs:**
   - Go to Settings → Webhooks → Your webhook → Recent Deliveries
   - Check if requests are being sent and what responses are received

2. **Check webhook server logs:**
   ```bash
   tail -f deploy/deploy.log
   ```

3. **Verify webhook server is running:**
   ```bash
   curl http://localhost:9000/health
   ```

### Deployment Fails

1. **Check permissions:**
   - Ensure the webhook server user can write to the app directory
   - Ensure PM2 has permission to restart the app

2. **Check paths:**
   - Verify `appPath` in config is correct
   - Verify `pm2AppName` matches your PM2 process name

3. **Check build errors:**
   - Look in `deploy.log` for specific error messages
   - Try running the deployment commands manually

### Signature Verification Fails

- Ensure the secret in `deploy.config.json` matches GitHub webhook secret
- Check that GitHub is sending the `x-hub-signature-256` header
- Verify the webhook content type is `application/json`

## 🔄 Manual Deployment

If you need to deploy manually without a webhook:

```bash
cd /path/to/your/app
git pull
npm ci  # or pnpm install
npm run build  # or pnpm build
pm2 restart mantodeus-manager
```

## 📝 Environment Variables

You can also configure using environment variables instead of `deploy.config.json`:

```bash
export WEBHOOK_SECRET="your-secret"
export APP_PATH="/var/www/mantodeus-manager"
export PM2_APP_NAME="mantodeus-manager"
export WEBHOOK_PORT=9000
export USE_PNPM=false
export LOG_FILE="./deploy.log"
```

## 🎯 Next Steps

1. ✅ Configure `deploy.config.json` with your settings
2. ✅ Install dependencies: `npm install`
3. ✅ Start the webhook server with PM2
4. ✅ Add webhook in GitHub repository settings
5. ✅ Test with a small commit and push
6. ✅ Monitor logs to ensure everything works

---

**Status**: Ready to deploy  
**Last Updated**: November 29, 2025

