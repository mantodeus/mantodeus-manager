# Infrastructure

**Mantodeus Manager is a production-only system by design.**

## Directory Structure

```
infra/
├── deploy/            # Helper scripts (status/restart/fixes)
├── ssh/               # SSH key management
└── shared/            # Shared utilities
scripts/deploy.sh      # Canonical deploy script (root-level)
```

## The Only Deployment Path

```
git push origin main → GitHub Webhook (/api/github-webhook) → scripts/deploy.sh → PM2 restart
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
bash scripts/deploy.sh
```

## What the Deploy Script Does

1. `git fetch origin && git reset --hard origin/main`
2. Install dependencies when package files change (`pnpm install`)
3. Run `pnpm run db:migrate` (always; blocking)
4. `npm run build` (with increased memory limit)
5. Verify `dist/public/assets` exists
6. `npx pm2 restart mantodeus-manager` (or start)
7. Health check `http://localhost:3000/api/health`

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
