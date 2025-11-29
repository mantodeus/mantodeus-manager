# Testing the GitHub Webhook Deployment

## Quick Test Checklist

### ✅ Pre-Test Verification

1. **Webhook Server is Running**
   ```bash
   # On your server, check if webhook server is running
   pm2 list | grep github-webhook
   # or
   curl http://localhost:3000/health
   ```

2. **Configuration is Correct**
   - Check `deploy.config.json` has correct:
     - `appPath`: Full path to your app (e.g., `/var/www/mantodeus-manager`)
     - `pm2AppName`: Your PM2 app name (check with `pm2 list`)
     - `secret`: Matches GitHub webhook secret

3. **GitHub Webhook is Configured**
   - Payload URL: `https://your-domain.com:3000/github-webhook`
   - Secret matches `deploy.config.json`
   - Events: "Just the push event"

## 🧪 Test Methods

### Method 1: Make a Test Commit (Recommended)

1. Make a small change in your repo:
   ```bash
   echo "# Test deployment $(date)" >> test-deploy.md
   git add test-deploy.md
   git commit -m "Test: Trigger webhook deployment"
   git push origin main
   ```

2. **Watch the logs:**
   ```bash
   # On your server
   tail -f deploy/deploy.log
   # or
   pm2 logs github-webhook
   ```

3. **Check GitHub webhook delivery:**
   - Go to: Repository → Settings → Webhooks → Your webhook
   - Click on "Recent Deliveries"
   - Check the latest delivery status

### Method 2: Test Webhook Manually (curl)

```bash
# On your server, test the endpoint directly
curl -X POST http://localhost:3000/github-webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-Hub-Signature-256: sha256=test" \
  -d '{"ref":"refs/heads/main"}'
```

Note: This will fail signature verification, but you can see if the server is responding.

### Method 3: Use GitHub's "Redeliver" Feature

1. Go to: Repository → Settings → Webhooks → Your webhook
2. Click on a recent delivery
3. Click "Redeliver" to resend the webhook

## ✅ What to Look For

### Successful Deployment:

```
[INFO] Webhook received - Event: push, Ref: refs/heads/main
[INFO] Push to main/master detected, starting deployment...
[INFO] Starting deployment...
[INFO] Executing: cd /path/to/app && git pull && npm ci && npm run build && pm2 restart app
[INFO] Deployment successful!
[SUCCESS] Deployment completed successfully
```

### Common Issues:

**1. Signature Verification Failed**
```
[ERROR] Invalid signature - potential security issue!
[ERROR] Unauthorized webhook attempt
```
→ **Fix**: Ensure secret in `deploy.config.json` matches GitHub webhook secret

**2. Path Not Found**
```
[ERROR] Deployment error: ENOENT: no such file or directory
```
→ **Fix**: Update `appPath` in `deploy.config.json` to correct path

**3. PM2 App Not Found**
```
[ERROR] pm2 restart: App [app-name] not found
```
→ **Fix**: Check PM2 app name with `pm2 list` and update `pm2AppName` in config

**4. Build Failed**
```
[ERROR] npm run build failed
```
→ **Fix**: Check build errors in logs, may need to fix code or dependencies

## 🔍 Debugging Steps

1. **Check webhook server is running:**
   ```bash
   pm2 status github-webhook
   pm2 logs github-webhook --lines 50
   ```

2. **Check deployment logs:**
   ```bash
   tail -n 100 deploy/deploy.log
   ```

3. **Verify GitHub webhook delivery:**
   - Check "Recent Deliveries" in GitHub
   - Look at request/response details
   - Check if webhook is being sent

4. **Test health endpoint:**
   ```bash
   curl http://localhost:3000/health
   ```

5. **Manually test deployment commands:**
   ```bash
   cd /path/to/your/app
   git pull
   npm ci
   npm run build
   pm2 restart mantodeus-manager
   ```

## 📊 Monitoring

After a successful test, you should see:
- ✅ Webhook received in logs
- ✅ Git pull completed
- ✅ Dependencies installed
- ✅ Build completed
- ✅ PM2 app restarted
- ✅ New code is live

---

**Ready to test?** Make a small commit and push to trigger the webhook!

