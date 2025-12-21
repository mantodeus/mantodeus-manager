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
2. **Install** - `npm install --include=dev`
3. **Browser** - `npx puppeteer browsers install chrome`
4. **Build** - `npm run build`
5. **Verify** - Check `dist/index.js` and `dist/public/` exist
6. **Restart** - `npx pm2 restart mantodeus-manager`

## PM2 Commands

```bash
# View status
pm2 status

# View logs
pm2 logs mantodeus-manager --lines 200

# Restart manually
pm2 restart mantodeus-manager

# Stop
pm2 stop mantodeus-manager
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
```

**The app fails fast if any required variable is missing.**

## Troubleshooting

### Server Won't Start

1. Check PM2 logs: `pm2 logs mantodeus-manager --lines 200`
2. Verify build exists: `ls -la dist/index.js dist/public`
3. Check env vars: `cat .env | grep -E "SUPABASE|DATABASE"`

### Build Fails

1. Check Node version: `node --version` (should be 22.x)
2. Clear node_modules: `rm -rf node_modules && npm install`
3. Check for TypeScript errors: `npm run check`

### Database Connection Issues

1. Verify `DATABASE_URL` in `.env`
2. Test connection manually
3. Check migrations: `npm run db:migrate`

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

## Philosophy

> Complexity is the enemy. Safety comes from clarity, not environments.
> If something breaks, we fix it directly in production — fast, deliberately, and cleanly.
