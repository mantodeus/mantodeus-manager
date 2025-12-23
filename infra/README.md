# Infrastructure

**Mantodeus Manager is a production-only system by design.**

## Directory Structure

```
infra/
├── deploy/
│   └── deploy.sh      # THE canonical deploy script
├── webhook/           # GitHub webhook handler
├── ssh/               # SSH key management
└── shared/            # Shared utilities
```

## The Only Deployment Path

```
git push origin main → GitHub Webhook → infra/deploy/deploy.sh → PM2 restart
```

## Configuration

| Component | Value |
|-----------|-------|
| Domain | `manager.mantodeus.com` |
| Server Path | `/srv/customer/sites/manager.mantodeus.com` |
| PM2 Process | `mantodeus-manager` |
| Port | 3000 (or `process.env.PORT`) |

## Manual Deployment

```bash
ssh mantodeus-server
cd /srv/customer/sites/manager.mantodeus.com
bash infra/deploy/deploy.sh
```

## What the Deploy Script Does

1. `git fetch origin && git reset --hard origin/main`
2. `npm install --include=dev`
3. `npx puppeteer browsers install chrome`
4. `npm run build`
5. Verify `dist/index.js` and `dist/public/` exist
6. `npx pm2 restart mantodeus-manager`

## PM2 Commands

```bash
pm2 status                              # View status
pm2 logs mantodeus-manager --lines 200  # View logs
pm2 restart mantodeus-manager           # Restart
```

## Environment

One `.env` file with all required variables. The app fails fast if anything is missing.

See `.env.example` for the template.

## SSH Configuration

```
Host mantodeus-server
    HostName 57-105224.ssh.hosting-ik.com
    User M4S5mQQMRhu_mantodeus
    IdentityFile ~/.ssh/mantodeus_deploy_key
    Port 22
```

## Webhook Setup

1. Generate secret: `openssl rand -hex 32`
2. Add to `.env`: `WEBHOOK_SECRET=your_secret`
3. Configure in GitHub: Repository → Settings → Webhooks
4. Payload URL: `https://manager.mantodeus.com:9000/webhook`

## Troubleshooting

```bash
# Check logs
pm2 logs mantodeus-manager --lines 200

# Check status
pm2 status

# Health check
curl https://manager.mantodeus.com/api/health
```

## Philosophy

> Complexity is the enemy. Safety comes from clarity, not environments.
