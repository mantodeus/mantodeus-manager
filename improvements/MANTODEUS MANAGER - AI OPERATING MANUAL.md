# MANTODEUS MANAGER - AI OPERATING MANUAL

**Last Updated**: 2025-12-24

This document provides persistent context for AI agents (Cursor, Manus, etc.) working on the Mantodeus Manager project. Paste this into your project context to avoid repetitive questions about project structure, commands, and workflows.

---

## Project Facts

| Attribute | Value |
|-----------|-------|
| Repository | `mantodeus/mantodeus-manager` |
| Default Branch | `main` |
| Package Manager | `pnpm` (v10.4.1) |
| Node Version | 22.x |
| Framework | React 19 + Express + tRPC |
| Database | MySQL/MariaDB via Drizzle ORM |
| Auth Provider | Supabase |
| File Storage | Infomaniak S3-compatible |
| PDF Service | Fly.io (wkhtmltopdf) |
| Hosting | Infomaniak Shared Cloud |
| Process Manager | PM2 |

---

## Directory Structure

```
mantodeus-manager/
├── client/           # React frontend (Vite)
│   └── src/
│       ├── _core/    # Core hooks and utilities
│       ├── hooks/    # Custom React hooks
│       └── lib/      # Shared libraries (trpc, supabase, utils)
├── server/           # Express + tRPC backend
│   ├── _core/        # Core utilities (auth, env, trpc, context)
│   ├── services/     # Business logic (pdfService)
│   └── templates/    # HTML templates for PDFs
├── drizzle/          # Database schema and migrations
│   ├── schema.ts     # Drizzle schema definition
│   ├── relations.ts  # Table relations
│   └── *.sql         # Migration files
├── infra/            # DevOps scripts
│   ├── deploy/       # Deployment scripts (deploy.sh, restart.sh, status.sh)
│   ├── ssh/          # SSH configuration and key management
│   ├── env/          # Environment variable management
│   └── webhook/      # GitHub webhook listener
docs/             # Documentation
  GOLDEN_PATH_WORKFLOWS.md  # Canonical workflows
├── services/
│   └── pdf-service/  # Fly.io PDF generator (wkhtmltopdf)
├── shared/           # Shared types and constants
└── scripts/          # Utility scripts (backfill, migrations)
```

---

## Canonical Commands

| Action | Command | Notes |
|--------|---------|-------|
| Install dependencies | `pnpm install` | Never use `npm install` |
| Start dev server | `pnpm dev` | Hot reload enabled |
| Build for production | `pnpm build` | Runs build-debug.js |
| Build check (CI-safe) | `pnpm build:check` | Runs build.js |
| Run tests | `pnpm test` | Vitest |
| Type check | `pnpm check` | TypeScript noEmit |
| Generate migration | `pnpm db:generate` | After schema.ts changes |
| Apply migrations | `pnpm db:migrate` | Production-safe |
| Push schema (dev only) | `pnpm db:push-direct` | **Never in production** |
| Check DB connection | `pnpm db:check-url` | Verify DATABASE_URL |

---

## Environment Variables

Required variables (see `.env.example` for template):

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | MySQL connection | `mysql://user:pass@host:3306/db` |
| `VITE_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | `eyJhbGci...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key | `eyJhbGci...` |
| `JWT_SECRET` | Session signing key | Random 32+ char string |
| `S3_ENDPOINT` | Infomaniak S3 endpoint | `https://s3.pub1.infomaniak.cloud` |
| `S3_REGION` | S3 region | `us-east-1` |
| `S3_BUCKET` | S3 bucket name | `mantodeus-manager-files` |
| `S3_ACCESS_KEY_ID` | S3 access key | From Infomaniak |
| `S3_SECRET_ACCESS_KEY` | S3 secret key | From Infomaniak |
| `PDF_SERVICE_URL` | Fly.io PDF endpoint | `https://pdf-service-xxx.fly.dev/render` |
| `PDF_SERVICE_SECRET` | PDF service auth token | Random string |
| `AXIOM_DATASET` | Axiom dataset name (optional) | `mantodeus-manager-logs` |
| `AXIOM_TOKEN` | Axiom ingestion token (optional) | `x-axiom-token` |
| `WEBHOOK_SECRET` | GitHub webhook signature secret | 64 hex chars |
| `OWNER_SUPABASE_ID` | Owner user Supabase ID | UUID |
| `OAUTH_SERVER_URL` | OAuth API base URL | `https://api.manus.im` |
| `VITE_OAUTH_PORTAL_URL` | OAuth portal URL | `https://portal.manus.im` |
| `VITE_APP_ID` | OAuth app id | `your_app_id` |

---

## Drizzle Workflow Rules

1. **Never use `db:push` or `db:push-direct` in production** - it can cause data loss
2. **Always generate migrations** with `pnpm db:generate` after modifying `drizzle/schema.ts`
3. **Review generated SQL** in `drizzle/XXXX_*.sql` before committing
4. **Apply migrations** with `pnpm db:migrate` after deploying code changes
5. **Migration files are immutable** - never edit after committing to main
6. **Commit both** `schema.ts` and the generated `.sql` file together

---

## Server Access

```bash
# SSH alias (requires ~/.ssh/config setup)
ssh mantodeus-server

# Direct SSH command
ssh M4S5mQQMRhu_mantodeus@57-105224.ssh.hosting-ik.com

# Project directory on server
/srv/customer/sites/manager.mantodeus.com

# PM2 app name
mantodeus-manager
```

---

## Log Locations

| Log Type | Location | Command |
|----------|----------|---------|
| Application stdout | `./logs/mantodeus-manager-out.log` | `tail -f logs/mantodeus-manager-out.log` |
| Application stderr | `./logs/mantodeus-manager-error.log` | `tail -f logs/mantodeus-manager-error.log` |
| Webhook logs | `./logs/webhook.log` | `tail -f logs/webhook.log` |
| PM2 combined | N/A | `pm2 logs mantodeus-manager` |
| PM2 errors only | N/A | `pm2 logs mantodeus-manager --err` |
| Axiom logs | Axiom dataset | `AXIOM_DATASET` + `AXIOM_TOKEN` |

---

## How to Restart

```bash
# Graceful restart (preferred)
pm2 restart mantodeus-manager

# Force restart (if graceful fails)
pm2 delete mantodeus-manager && pm2 start ecosystem.config.js

# Check status
pm2 status

# View process details
pm2 show mantodeus-manager
```

---

## How to Deploy

```bash
# Automatic (push to main triggers webhook)
git push origin main

# Manual deployment
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/deploy.sh"

# Check deployment status
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/status.sh"

# Rollback to previous version
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh --rollback"
```

---

## How to Verify Deployment

```bash
# Check health endpoint
curl https://manager.mantodeus.com/api/health

# Expected response includes:
# - status: "ok"
# - version: git commit hash
# - buildId: deployment identifier

# Check status script (on server)
./infra/deploy/status.sh

# Verify git commit matches
git rev-parse --short HEAD
```

---

## Known Failure Modes

| Issue | Symptom | Fix |
|-------|---------|-----|
| Missing Chromium | PDF generation fails with "chromium not found" | Puppeteer is no longer used; PDF service runs on Fly.io with wkhtmltopdf |
| Env vars missing | Server crashes with "VITE_SUPABASE_URL missing" | Verify `.env` file exists and contains all required variables |
| PM2 namespace conflict | "Process already exists" error | Run `pm2 delete mantodeus-manager` then restart |
| Database connection timeout | "ETIMEDOUT" or "ECONNREFUSED" in logs | Check DATABASE_URL format; verify MySQL server is accessible |
| S3 upload fails | "AccessDenied" or "InvalidAccessKeyId" | Verify S3 credentials in `.env`; check bucket policy |
| Invoice number duplicates | Same invoice number issued to multiple invoices | Fixed by atomic increment in `server/db.ts` (verify migrations applied) |
| Build fails with env error | "VITE_SUPABASE_URL is REPLACE_ME" | Replace placeholder values in `.env` with actual Supabase credentials |
| Webhook not triggering | Pushes to main don't deploy | Check webhook secret matches; verify webhook listener is running |

---

## DO / DON'T

| DO | DON'T |
|----|-------|
| Use `pnpm` for all package operations | Use `npm` in production scripts |
| Run `db:migrate` after deployment | Run `db:push` or `db:push-direct` in production |
| Test migrations locally first | Apply untested migrations to production |
| Use presigned URLs for S3 access | Make S3 bucket publicly accessible |
| Keep backups before major changes | Deploy without verifying backup exists |
| Check logs after deployment | Assume deployment succeeded without verification |
| Use feature branches for development | Push directly to main for large changes |
| Review generated SQL migrations | Blindly commit auto-generated migrations |
| Use `infra/env/env-update.sh` for secrets | Edit production `.env` by hand |

---

## Safe Rollout Steps

1. **Develop**: Create feature branch, implement changes
2. **Test locally**: Run `pnpm test` and `pnpm check`
3. **Push branch**: `git push origin feature/my-feature`
4. **Verify CI**: Check GitHub Actions passes
5. **Create PR**: Open pull request to main
6. **Review**: Code review and approval
7. **Merge**: Merge to main (triggers auto-deploy)
8. **Monitor**: Watch logs for 5 minutes post-deploy
9. **Verify**: Check health endpoint returns new version
10. **Rollback if needed**: `./infra/deploy/restart.sh --rollback`

---

## Key File Locations

| Purpose | File Path |
|---------|-----------|
| Main server entry | `server/_core/index.ts` |
| tRPC routers | `server/routers.ts` |
| Database schema | `drizzle/schema.ts` |
| Database operations | `server/db.ts` |
| Environment config | `server/_core/env.ts` |
| PDF service client | `server/services/pdfService.ts` |
| Logger configuration | `server/_core/logger.ts` |
| S3 storage operations | `server/storage.ts` |
| PM2 configuration | `ecosystem.config.js` |
| Build script | `build-debug.js` |
| Build validation | `build.js` |
| Deploy script | `infra/deploy/deploy.sh` |
| Webhook listener | `infra/webhook/webhook-listener.js` |
| Golden path workflows | `docs/GOLDEN_PATH_WORKFLOWS.md` |

---

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/health` | Health check (returns version, uptime) |
| `/api/trpc/*` | tRPC API routes |
| `/api/oauth/callback` | Supabase OAuth callback |
| `/api/files/:key` | File proxy for S3 objects |
| `/api/pdf/invoice/:id` | Generate invoice PDF |

---

## External Services

| Service | URL | Purpose |
|---------|-----|---------|
| Supabase | `https://uwdkafekyrqjnstbywqw.supabase.co` | Authentication |
| PDF Service | `https://pdf-service-withered-star-4195.fly.dev` | PDF generation |
| S3 Storage | `https://s3.pub1.infomaniak.cloud` | File storage |

---

*This manual should be updated whenever significant changes are made to the project structure, commands, or workflows.*
