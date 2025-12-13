# Migration to PM2 Process Control (legacy filename)

## Summary

This repository previously documented an **Infomaniak-control-panel-only** process control workflow.

**That is no longer the case.** The canonical process manager is now **PM2**, and the deployment scripts perform a build and then restart the PM2 process.

## Canonical workflow

On the server:

```bash
cd /srv/customer/sites/manager.mantodeus.com
bash infra/production/deploy-production.sh
```

This will:
- Pull latest code
- Install dependencies
- Build (`npm run build`)
- Restart via PM2 (`npx pm2 restart <PM2_APP_NAME>`)

## Restart only

```bash
npx pm2 restart mantodeus-manager
```

## Notes

- `infra/shared/run-background.sh` and `infra/shared/stop-env.sh` remain **disabled** (kept only for reference). Use PM2 + the deploy/restart scripts instead.
- The server reads `PORT` from `process.env.PORT` when provided by the host, otherwise it falls back to `3000`.
