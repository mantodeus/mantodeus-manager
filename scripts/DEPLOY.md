# Deployment

Canonical deploy script: `scripts/deploy.sh`

## Trigger Paths
- Push to `main` → GitHub webhook `/api/github-webhook` starts `nohup bash scripts/deploy.sh > deploy.log 2>&1 &` (non-blocking HTTP response).
- Manual SSH: `cd /srv/customer/sites/manager.mantodeus.com && bash scripts/deploy.sh`

## What the Script Does (in order)
1. Acquire lock + reset to `origin/main`.
2. Install dependencies only if package files changed (`pnpm install --no-frozen-lockfile`).
3. Load `DATABASE_URL` from `.env` (required).
4. Optional: run `db:generate` (non-blocking).
5. **Run `pnpm run db:migrate` (always, blocking).** Failure exits and aborts deploy.
6. Build (`npm run build` with higher memory), verify `dist/public/assets`.
7. Restart via PM2 (`mantodeus-manager`), run health check, save PM2 state.
8. Update `.deploy-state.json` **only after** successful migrate+build+restart.

## Logs & Debug
- Webhook/cron deploy log: `/srv/customer/sites/manager.mantodeus.com/deploy.log`
- To debug migrations:
  ```bash
  cd /srv/customer/sites/manager.mantodeus.com
  export DATABASE_URL=$(grep -v '^#' .env | grep '^DATABASE_URL=' | cut -d'=' -f2-)
  pnpm run db:migrate
  npx drizzle-kit --version
  ```

## Safety Notes
- `pnpm run db:migrate` is idempotent; it must succeed before build/restart.
- Do **not** skip migrations; `.deploy-state.json` is written only after success.
- Keep `WEBHOOK_SECRET` set so `/api/github-webhook` verifies signatures.
