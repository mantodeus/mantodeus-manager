# Deployment Guide

**Mantodeus Manager is a production-only system by design.**

## Architecture

| Component | Value |
|-----------|-------|
| Domain | `manager.mantodeus.com` |
| Hosting | Infomaniak |
| Process Manager | PM2 |
| Repository | `/srv/customer/sites/manager.mantodeus.com` |

## The Only Deployment Path

```
git push origin main → GitHub Webhook → infra/deploy/deploy.sh → PM2 restart
```

## Automated Deployment

The preferred deployment method is via GitHub webhook:

1. Push to `main` branch
2. GitHub webhook triggers deployment automatically
3. Server pulls latest code and restarts

### Webhook Setup

The webhook listener runs on port 9000 and is managed by PM2.

**Prerequisites:**
1. Generate a webhook secret:
   ```bash
   openssl rand -hex 32
   ```
2. Add `WEBHOOK_SECRET=<generated-secret>` to `.env` file
3. Configure the same secret in GitHub repository settings:
   - Go to Settings → Webhooks → Add webhook
   - Payload URL: `http://your-server:9000/webhook`
   - Content type: `application/json`
   - Secret: (paste the generated secret)
   - Events: Just the push event

**Managing the webhook listener:**

```bash
# Check webhook status
pm2 status webhook-listener

# View webhook logs
pm2 logs webhook-listener

# Start webhook listener (if not running)
pm2 start infra/webhook/webhook-listener.js --name webhook-listener

# Restart webhook listener
pm2 restart webhook-listener
```

**Security:** The webhook listener will fail to start if `WEBHOOK_SECRET` is not set. All requests without valid signatures are rejected with HTTP 401.

## Manual Deployment

If the webhook isn't configured or you need to deploy manually:

```bash
# SSH into server
ssh mantodeus-server

# Navigate to app directory
cd /srv/customer/sites/manager.mantodeus.com

# Run the canonical deploy script
bash infra/deploy/deploy.sh
```

## What the Deploy Script Does

1. **Fetch** - `git fetch origin && git reset --hard origin/main`
2. **Install** - `pnpm install --frozen-lockfile`
3. **Build** - `pnpm build`
4. **Verify** - Check `dist/index.js` and `dist/public/` exist
5. **Restart** - `pm2 restart mantodeus-manager`

## PM2 Commands

```bash
# View status
pm2 status

# View application logs
pm2 logs mantodeus-manager --lines 200

# View all logs including errors
pm2 logs mantodeus-manager --err --lines 100

# Restart manually
pm2 restart mantodeus-manager

# Stop
pm2 stop mantodeus-manager

# Force restart (if stuck)
pm2 delete mantodeus-manager && pm2 start ecosystem.config.js
```

## Environment Setup

The `.env` file must exist at `/srv/customer/sites/manager.mantodeus.com/.env` with all required variables.

**Required variables:**

```env
# Database
DATABASE_URL=mysql://user:password@host:3306/mantodeus_manager

# Authentication
JWT_SECRET=your_32_char_secret
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OWNER_SUPABASE_ID=your_owner_id

# OAuth
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
VITE_APP_ID=your_app_id

# S3 Storage
S3_ENDPOINT=https://s3.pub1.infomaniak.cloud
S3_REGION=us-east-1
S3_BUCKET=mantodeus-manager-files
S3_ACCESS_KEY_ID=your_key
S3_SECRET_ACCESS_KEY=your_secret

# Application
PORT=3000
VITE_APP_TITLE=Mantodeus Manager
VITE_APP_URL=https://manager.mantodeus.com

# PDF Service (optional)
PDF_SERVICE_URL=https://pdf-service-withered-star-4195.fly.dev/render
PDF_SERVICE_SECRET=your_pdf_secret

# Webhook (required for automated deployment)
WEBHOOK_SECRET=your_webhook_secret_here
```

**The app fails fast if any required variable is missing.**

**Note:** `WEBHOOK_SECRET` is required to start the webhook listener. Generate with `openssl rand -hex 32`.

## SSH Configuration

Add to `~/.ssh/config`:

```
Host mantodeus-server
    HostName 57-105224.ssh.hosting-ik.com
    User M4S5mQQMRhu_mantodeus
    Port 22
    IdentityFile ~/.ssh/mantodeus_deploy_key
    IdentitiesOnly yes
    StrictHostKeyChecking accept-new
```

Then connect with:

```bash
ssh mantodeus-server
```

### SSH Troubleshooting

**Permission denied (publickey)**:
- Verify your SSH key is added to the server
- Check `~/.ssh/config` has correct path to private key
- Test connection: `ssh -v mantodeus-server`

**Connection timeout**:
- Verify you're not behind a firewall blocking port 22
- Check server is reachable: `ping 57-105224.ssh.hosting-ik.com`

**Host key verification failed**:
- Remove old key: `ssh-keygen -R 57-105224.ssh.hosting-ik.com`
- Reconnect to accept new key

## Troubleshooting

### Server Won't Start

1. Check PM2 logs: `pm2 logs mantodeus-manager --lines 200`
2. Verify build exists: `ls -la dist/index.js dist/public`
3. Check env vars: `cat .env | grep -E "SUPABASE|DATABASE"`
4. Check Node version: `node --version` (should be 22.x)

### Build Fails

1. Check for TypeScript errors: `pnpm check`
2. Clear and reinstall: `rm -rf node_modules && pnpm install`
3. Check disk space: `df -h`
4. Review build logs in PM2 output

### Database Connection Issues

1. Verify `DATABASE_URL` in `.env`
2. Test connection: `pnpm db:check-url`
3. Check migrations: `pnpm db:migrate`
4. Verify database server is running

### Deployment Fails

1. Check webhook logs: `pm2 logs webhook-listener`
2. Verify git repository is clean: `git status`
3. Check for merge conflicts: `git diff`
4. Try manual deployment: `bash infra/deploy/deploy.sh`

## Health Check

```bash
curl https://manager.mantodeus.com/api/health
```

Returns:
```json
{
  "status": "ok",
  "version": "abc1234",
  "timestamp": "2024-12-21T...",
  "uptime": 12345
}
```

## Security

- All traffic over HTTPS
- Cookies use `secure` and `sameSite=none`
- JWT tokens for authentication
- S3 presigned URLs for file access
- Fail-fast on missing configuration
- Webhook requires secret for authentication

## Rollback Procedure

If a deployment causes issues:

```bash
# View recent commits
git log --oneline -10

# Rollback to specific commit
git reset --hard <commit-hash>

# Rebuild and restart
pnpm build && pm2 restart mantodeus-manager
```

**Always test rollbacks in a backup before production.**

## Philosophy

> Complexity is the enemy. Safety comes from clarity, not environments.
> If something breaks, we fix it directly in production — fast, deliberately, and cleanly.
