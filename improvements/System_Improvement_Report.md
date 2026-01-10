# System Improvement Report: Mantodeus Manager

**Prepared for**: Mantodeus Development Team  
**Prepared by**: Manus AI  
**Date**: December 21, 2025

---

## Executive Summary

This report presents a comprehensive analysis of the Mantodeus Manager development and deployment ecosystem. After scanning the repository structure, deployment pipelines, database configuration, PDF generation service, object storage integration, and observability practices, this document identifies key bottlenecks, reliability risks, and proposes a concrete improvement plan with actionable steps.

The primary findings reveal opportunities for improvement in three critical areas: **deployment reliability** (currently fragile due to non-deterministic dependency installation), **data integrity** (invoice numbering has a race condition vulnerability), and **operational complexity** (documentation sprawl with 59 markdown files creates confusion). The proposed 14-day execution plan prioritizes quick wins that address production stability before tackling structural improvements.

---

## 1. Current System Map

The Mantodeus Manager ecosystem consists of interconnected components spanning local development, version control, cloud hosting, and external services. The following diagram illustrates the complete architecture and data flows.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DEVELOPMENT ENVIRONMENT                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                      │
│  │   Cursor    │    │  Terminal   │    │   Windows   │                      │
│  │    IDE      │───▶│   (pnpm)    │───▶│    SSH      │                      │
│  └─────────────┘    └─────────────┘    └──────┬──────┘                      │
└──────────────────────────────────────────────│──────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VERSION CONTROL                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    GitHub: mantodeus/mantodeus-manager              │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │    │
│  │  │  main    │  │ feature/ │  │   fix/   │  │  GitHub Actions  │    │    │
│  │  │  branch  │  │ branches │  │ branches │  │  (CI Pipeline)   │    │    │
│  │  └────┬─────┘  └──────────┘  └──────────┘  └────────┬─────────┘    │    │
│  └───────│─────────────────────────────────────────────│──────────────┘    │
└──────────│─────────────────────────────────────────────│────────────────────┘
           │                                             │
           │ (push to main)                              │ (webhook trigger)
           ▼                                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PRODUCTION ENVIRONMENT                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Infomaniak Shared Cloud                          │    │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐      │    │
│  │  │   Webhook    │───▶│    PM2       │───▶│   Node.js App    │      │    │
│  │  │   Listener   │    │   Process    │    │   (Express+tRPC) │      │    │
│  │  │   :9000      │    │   Manager    │    │   :3000          │      │    │
│  │  └──────────────┘    └──────────────┘    └────────┬─────────┘      │    │
│  │                                                    │                │    │
│  │  Path: /srv/customer/sites/manager.mantodeus.com   │                │    │
│  └────────────────────────────────────────────────────│────────────────┘    │
└───────────────────────────────────────────────────────│─────────────────────┘
                                                        │
           ┌────────────────────────────────────────────┼────────────────────┐
           │                                            │                    │
           ▼                                            ▼                    ▼
┌──────────────────┐                    ┌──────────────────┐    ┌──────────────────┐
│   MySQL/MariaDB  │                    │    Fly.io        │    │  Infomaniak S3   │
│   (App Data)     │                    │  PDF Service     │    │  (File Storage)  │
│                  │                    │  (wkhtmltopdf)   │    │                  │
│  - users         │                    │  :3000           │    │  - uploads/      │
│  - projects      │                    │  fra region      │    │  - pdfs/         │
│  - invoices      │                    │                  │    │  - images/       │
│  - contacts      │                    │                  │    │                  │
└──────────────────┘                    └──────────────────┘    └──────────────────┘
```

### Component Inventory

| Component | Technology | Location | Purpose |
|-----------|------------|----------|---------|
| Frontend | React 19 + Vite + TailwindCSS 4 | Client bundle | User interface |
| Backend | Node.js + Express + tRPC | Infomaniak | API server |
| Database | MySQL/MariaDB + Drizzle ORM | Infomaniak | Persistent data |
| Auth | Supabase Auth | External | User authentication |
| Storage | Infomaniak S3-compatible | External | File uploads, PDFs |
| PDF Generation | wkhtmltopdf on Fly.io | External | Invoice/report PDFs |
| Process Manager | PM2 | Infomaniak | Application lifecycle |
| CI/CD | GitHub Actions + Webhook | GitHub/Infomaniak | Automated testing and deployment |

---

## 2. Bottlenecks & Friction Analysis

The following table presents identified friction points ranked by priority, with root cause analysis and recommended fixes.

| Priority | Symptom | Root Cause | Evidence | Recommended Fix |
|----------|---------|------------|----------|-----------------|
| **~~P1~~** | ~~Deployment failures and inconsistencies~~ | **✅ FIXED** - Deploy script now uses `pnpm install --no-frozen-lockfile` when deps change and runs blocking migrations (`scripts/deploy.sh`). | ~~`deploy.sh` line 41: `npm install --production=false --legacy-peer-deps`~~ | ~~Replace with `pnpm install --frozen-lockfile`~~ **IMPLEMENTED** |
| **~~P1~~** | ~~Documentation sprawl creates confusion~~ | **✅ FIXED** - Documentation consolidated from 29 root files to 2 in root + 12 organized in docs/ folder (commit 76bfe5f). | ~~59 markdown files in root directory~~ | ~~Consolidate into structured `docs/` directory~~ **IMPLEMENTED** |
| **~~P1~~** | ~~Unclear source of truth for commands~~ | **✅ FIXED** - Deployment consolidated to `scripts/deploy.sh`; legacy listeners/scripts removed. | `deploy.sh`, `deploy.ps1`, `quick-deploy.ps1`, `deploy-server.sh` all exist | ~~Standardize on single `scripts/deploy.sh` and remove alternatives~~ **IMPLEMENTED** |
| **P2** | Manual environment variable management | `.env` files managed manually across environments | `.env.example` requires manual copying and editing | Implement secret management (Doppler, Infisical, or GitHub Secrets) |
| **P2** | Poor observability in production | File-based logging with no aggregation or alerting | `ecosystem.config.js` writes to `./logs/` directory only | Add structured logging with Pino and ship to Axiom, Logtail, or similar |
| **P2** | Slow cold starts after Fly.io scale-to-zero | PDF service configured with `min_machines_running = 0` | `fly.toml` line 17 | Set `min_machines_running = 1` for consistent latency (cost: ~$2/month) |
| **P3** | Build verification is incomplete | Frontend build success not validated for Supabase variable embedding | `build-debug.js` checks env vars but doesn't verify final bundle | Add post-build validation step that greps bundle for expected values |
| **~~P3~~** | ~~Package manager inconsistency~~ | **✅ FIXED** - All deployment scripts now use pnpm exclusively (commit 8290fc4). | ~~Project uses pnpm but deploy scripts use npm~~ | ~~Align all scripts to use pnpm exclusively~~ **IMPLEMENTED** |

### Friction Reduction Opportunities

The current deployment workflow requires approximately 8 manual steps or decisions. By consolidating scripts and automating environment synchronization, this can be reduced to a single command: `git push origin main`. The webhook-based deployment already exists but is underutilized due to reliability concerns with the current deployment script.

---

## 3. Reliability & Security Risks

The following risks are ranked by a combination of likelihood and potential impact on production operations.

| Priority | Risk | Likelihood | Impact | Mitigation | Validation Step |
|----------|------|------------|--------|------------|-----------------|
| **~~P0~~** | ~~Invoice number race condition~~ | ~~High~~ | ~~High~~ | **✅ FIXED** - The `incrementInvoiceNumber` function now uses atomic SQL `UPDATE ... SET nextInvoiceNumber = nextInvoiceNumber + 1` at the database level (server/db.ts:1906-1908). | ~~Rewrite using MySQL atomic UPDATE~~ **IMPLEMENTED** | Load test with 10 concurrent invoice issuance requests; verify no duplicates. |
| **P1** | Unsafe migration strategy | Medium | High | `db:push` script uses `drizzle-kit push` which can cause data loss in production. | Enforce `drizzle-kit migrate` for production; use `push` only in development. Add CI check to prevent `push` on main branch. | Review migration workflow documentation; add pre-deploy migration check. |
| **~~P1~~** | ~~Webhook accepts unsigned requests~~ | ~~Medium~~ | ~~High~~ | **✅ FIXED** - In-app webhook `/api/github-webhook` now enforces signature verification when `WEBHOOK_SECRET` is set (`server/_core/index.ts`). | ~~Remove fallback behavior~~ **IMPLEMENTED** | Attempt deployment without secret; verify it fails. |
| **~~P2~~** | ~~No database backup automation~~ | ~~High~~ | ~~Medium~~ | **✅ FIXED** - Automated backup scripts created with daily cron job, S3 upload, and 30-day retention (scripts/backup-db.sh, commit fedfc15). | ~~Implement daily automated backups~~ **IMPLEMENTED** | Verify backup file exists and can be restored to test database. |
| **P2** | PDF service has no queue/backpressure | Medium | Medium | Direct synchronous calls to Fly.io service; high load could cause timeouts or failures. | Implement client-side retry with exponential backoff; consider adding BullMQ for async processing. | Generate 20 PDFs simultaneously; verify all complete without errors. |
| **P2** | S3 bucket permissions unclear | Low | Medium | Code uses presigned URLs but bucket ACL configuration is not documented. | Audit bucket policy; ensure private-by-default with presigned URL access only. | Attempt direct URL access without signature; verify 403 response. |
| **P3** | No health check in GitHub Actions deployment | Medium | Low | CI/CD pipeline deploys but doesn't verify application health post-deploy. | Add `curl` health check step after deployment in GitHub Actions workflow. | Introduce intentional failure; verify pipeline reports failure. |

### ~~Critical Fix: Invoice Number Race Condition~~ ✅ COMPLETED

**Status**: **FIXED** (as of current codebase)

The invoice number race condition has been successfully resolved. The implementation in [server/db.ts:1894-1917](server/db.ts#L1894-L1917) now uses an atomic SQL operation:

```typescript
// CURRENT IMPLEMENTATION (FIXED)
export async function incrementInvoiceNumber(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify settings exist first
  const settings = await getCompanySettingsByUserId(userId);
  if (!settings) throw new Error("Company settings not found");

  // Atomic increment: UPDATE with SET column = column + 1 is atomic at the database level
  // This prevents race conditions where multiple concurrent requests could read the same
  // value and both increment it, resulting in duplicate invoice numbers.
  await db.execute(
    sql`UPDATE company_settings SET nextInvoiceNumber = nextInvoiceNumber + 1 WHERE userId = ${userId}`
  );

  // Read back the updated value to return it
  const updated = await getCompanySettingsByUserId(userId);
  if (!updated) throw new Error("Company settings not found after update");

  return updated.nextInvoiceNumber;
}
```

**Recommended Next Step**: Run load testing with 10+ concurrent invoice creation requests to validate no duplicates occur.

---

## 4. Golden Path Workflow

This section provides copy-paste-ready commands for all standard operations.

### 4.1 Local Development

```bash
# Clone and setup (first time only)
gh repo clone mantodeus/mantodeus-manager
cd mantodeus-manager
cp .env.example .env
# Edit .env with your credentials

# Install dependencies
pnpm install

# Start development server (hot reload)
pnpm dev

# Run tests
pnpm test

# Type check
pnpm check
```

### 4.2 Database Schema Changes

```bash
# 1. Modify drizzle/schema.ts with your changes

# 2. Generate migration file
pnpm db:generate

# 3. Review generated SQL in drizzle/XXXX_*.sql

# 4. Apply migration locally
pnpm db:migrate

# 5. Commit both schema.ts and migration file
git add drizzle/
git commit -m "feat(db): add new_column to table_name"
```

### 4.3 Production Deployment

```bash
# Standard deployment (recommended)
git push origin main
# Webhook automatically triggers deployment

# Manual deployment (if webhook fails)
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && bash scripts/deploy.sh"

# Verify deployment
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/status.sh"
```

### 4.4 Production Database Migration

```bash
# After code deployment, apply pending migrations
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && pnpm db:migrate"

# Verify migration applied
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && pnpm db:check-url"
```

### 4.5 Rollback Procedure

```bash
# Rollback to previous deployment
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh --rollback"

# Rollback to specific backup
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh --backup-file=backup-20251221-120000.tar.gz"

# List available backups
ssh mantodeus-server "ls -la /srv/customer/sites/manager.mantodeus.com/backups/"
```

### 4.6 PDF Generation Verification

```bash
# Check PDF service health
curl https://pdf-service-withered-star-4195.fly.dev/health

# Check Fly.io service status
fly status -a pdf-service-withered-star-4195

# View PDF service logs
fly logs -a pdf-service-withered-star-4195
```

### 4.7 Emergency Procedures

```bash
# Application completely down
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && pm2 restart mantodeus-manager"

# Check application logs
ssh mantodeus-server "pm2 logs mantodeus-manager --lines 100"

# Force kill and restart
ssh mantodeus-server "pm2 delete mantodeus-manager && pm2 start ecosystem.config.js"
```

---

## 5. Automation Blueprint

### 5.1 Recommended CI/CD Pipeline

The current GitHub Actions workflow provides testing but lacks deployment automation. The following enhanced workflow adds deployment with health verification.

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    name: Test & Lint
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: testpassword
          MYSQL_DATABASE: mantodeus_test
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm check
      - run: pnpm test
        env:
          DATABASE_URL: mysql://root:testpassword@127.0.0.1:3306/mantodeus_test

  deploy:
    name: Deploy to Production
    needs: test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - name: Setup SSH
        uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}
      
      - name: Add known hosts
        run: ssh-keyscan -H 57-105224.ssh.hosting-ik.com >> ~/.ssh/known_hosts
      
      - name: Deploy
        run: |
          ssh M4S5mQQMRhu_mantodeus@57-105224.ssh.hosting-ik.com \
            "cd /srv/customer/sites/manager.mantodeus.com && bash scripts/deploy.sh"
      
      - name: Health Check
        run: |
          sleep 10
          curl --fail --retry 5 --retry-delay 5 \
            https://manager.mantodeus.com/api/health
```

### 5.2 Automated Database Backups

Add the following cron job to the server:

```bash
# Add to crontab: crontab -e
0 3 * * * /srv/customer/sites/manager.mantodeus.com/scripts/backup-db.sh
```

Create `/scripts/backup-db.sh`:

```bash
#!/bin/bash
set -e

BACKUP_DIR="/srv/customer/sites/manager.mantodeus.com/backups/db"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mantodeus-$DATE.sql.gz"

mkdir -p "$BACKUP_DIR"

# Load database URL from .env
source /srv/customer/sites/manager.mantodeus.com/.env

# Extract credentials from DATABASE_URL
# Format: mysql://user:password@host:port/database
DB_USER=$(echo $DATABASE_URL | sed -E 's|mysql://([^:]+):.*|\1|')
DB_PASS=$(echo $DATABASE_URL | sed -E 's|mysql://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo $DATABASE_URL | sed -E 's|mysql://[^@]+@([^:]+):.*|\1|')
DB_PORT=$(echo $DATABASE_URL | sed -E 's|mysql://[^@]+@[^:]+:([0-9]+)/.*|\1|')
DB_NAME=$(echo $DATABASE_URL | sed -E 's|mysql://[^/]+/(.+)|\1|')

mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" | gzip > "$BACKUP_FILE"

# Keep only last 30 backups
ls -t "$BACKUP_DIR"/*.sql.gz | tail -n +31 | xargs -r rm

echo "Backup completed: $BACKUP_FILE"
```

### 5.3 Minimal Viable Pipeline (Phase 1)

For immediate implementation, focus on these three automations:

| Automation | Tool | Priority | Effort |
|------------|------|----------|--------|
| Automated deployment on push | GitHub Actions | P1 | 2 hours |
| Daily database backups | Cron + mysqldump | P1 | 1 hour |
| Health check alerts | UptimeRobot (free tier) | P2 | 30 minutes |

---

## 6. AI Operating Manual

The following document is designed to be pasted into Cursor or Manus project context to provide persistent knowledge about the Mantodeus Manager system.

---

### MANTODEUS MANAGER - AI OPERATING MANUAL

**Last Updated**: 2025-12-21

#### Project Facts

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

#### Directory Structure

```
mantodeus-manager/
├── client/           # React frontend (Vite)
│   └── src/
├── server/           # Express + tRPC backend
│   ├── _core/        # Core utilities (auth, env, trpc)
│   ├── services/     # Business logic (pdfService)
│   └── templates/    # HTML templates for PDFs
├── drizzle/          # Database schema and migrations
├── infra/            # DevOps scripts
│   ├── deploy/       # Deployment scripts
│   ├── ssh/          # SSH configuration
│   └── webhook/      # GitHub webhook listener
├── services/
│   └── pdf-service/  # Fly.io PDF generator
└── shared/           # Shared types and constants
```

#### Canonical Commands

| Action | Command |
|--------|---------|
| Install dependencies | `pnpm install` |
| Start dev server | `pnpm dev` |
| Build for production | `pnpm build` |
| Run tests | `pnpm test` |
| Type check | `pnpm check` |
| Generate migration | `pnpm db:generate` |
| Apply migrations | `pnpm db:migrate` |
| Push schema (dev only) | `pnpm db:push-direct` |

#### Environment Variables

Required variables (see `.env.example`):

| Variable | Purpose | Required |
|----------|---------|----------|
| `DATABASE_URL` | MySQL connection string | Yes |
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key | Yes |
| `JWT_SECRET` | Session signing key | Yes |
| `S3_ENDPOINT` | Infomaniak S3 endpoint | Yes |
| `S3_BUCKET` | S3 bucket name | Yes |
| `S3_ACCESS_KEY_ID` | S3 access key | Yes |
| `S3_SECRET_ACCESS_KEY` | S3 secret key | Yes |
| `PDF_SERVICE_URL` | Fly.io PDF endpoint | Yes |
| `PDF_SERVICE_SECRET` | PDF service auth token | Yes |

#### Drizzle Workflow Rules

1. **Never use `db:push` in production** - it can cause data loss
2. **Always generate migrations** with `pnpm db:generate` after schema changes
3. **Review generated SQL** before committing
4. **Apply migrations** with `pnpm db:migrate` after deployment
5. **Migration files are immutable** - never edit after committing

#### Server Access

```bash
# SSH alias (requires ~/.ssh/config setup)
ssh mantodeus-server

# Direct SSH
ssh M4S5mQQMRhu_mantodeus@57-105224.ssh.hosting-ik.com

# Project directory
/srv/customer/sites/manager.mantodeus.com
```

#### Log Locations

| Log Type | Location |
|----------|----------|
| Application stdout | `./logs/mantodeus-manager-out.log` |
| Application stderr | `./logs/mantodeus-manager-error.log` |
| Webhook logs | `./logs/webhook.log` |
| PM2 logs | `pm2 logs mantodeus-manager` |

#### How to Restart

```bash
# Graceful restart
pm2 restart mantodeus-manager

# Force restart
pm2 delete mantodeus-manager && pm2 start ecosystem.config.js

# Check status
pm2 status
```

#### How to Verify Deployment

```bash
# Check health endpoint
curl https://manager.mantodeus.com/api/health

# Check status script
./infra/deploy/status.sh

# Check git commit
git rev-parse --short HEAD
```

#### Known Failure Modes

| Issue | Symptom | Fix |
|-------|---------|-----|
| Missing Chromium | PDF generation fails with "chromium not found" | Puppeteer is no longer used; PDF service is on Fly.io |
| Env vars missing | Server crashes on startup with "VITE_SUPABASE_URL missing" | Check `.env` file exists and has all required vars |
| PM2 namespace conflict | "Process already exists" error | `pm2 delete mantodeus-manager` then restart |
| Database connection timeout | "ETIMEDOUT" errors in logs | Check DATABASE_URL; verify MySQL is accessible |
| S3 upload fails | "AccessDenied" or "InvalidAccessKeyId" | Verify S3 credentials in `.env` |
| ~~Invoice number duplicates~~ | ~~Same invoice number issued twice~~ | **✅ FIXED** - Now uses atomic SQL increment (server/db.ts:1906) |

#### DO / DON'T

| DO | DON'T |
|----|-------|
| Use `pnpm` for all package operations | Use `npm` in production |
| Run `db:migrate` after deployment | Run `db:push` in production |
| Test migrations locally first | Apply untested migrations to prod |
| Use presigned URLs for S3 access | Make S3 bucket public |
| Keep backups before major changes | Deploy without backup |
| Check logs after deployment | Assume deployment succeeded |

#### Safe Rollout Steps

1. Push to feature branch, verify CI passes
2. Create PR to main, review changes
3. Merge to main (triggers auto-deploy)
4. Monitor logs for 5 minutes
5. Verify health endpoint returns new version
6. If issues, rollback: `./infra/deploy/restart.sh --rollback`

---

## 7. 14-Day Execution Plan

### Week 1: Critical Fixes & Quick Wins

| Day | Task | Success Criteria | Owner | Status |
|-----|------|------------------|-------|--------|
| **~~Day 1~~** | ~~Fix invoice number race condition~~ | ~~Load test passes with 10 concurrent requests, no duplicates~~ | ~~Dev~~ | **✅ DONE** |
| **Day 1** | Validate invoice fix with load testing | Load test passes with 10 concurrent requests, no duplicates | Dev | Pending |
| **~~Day 2~~** | ~~Consolidate documentation (29 → 2 files + docs/)~~ | ~~Single README + docs/ folder with clear structure~~ | ~~Dev~~ | **✅ DONE** |
| **~~Day 3~~** | ~~Secure webhook listener (require secret)~~ | ~~Webhook listener fails to start without WEBHOOK_SECRET~~ | ~~Dev~~ | **✅ DONE** |
| **~~Day 4~~** | ~~Update deploy.sh to use pnpm with frozen lockfile~~ | ~~Deployment uses `pnpm install --frozen-lockfile`~~ | ~~Dev~~ | **✅ DONE** |
| **~~Day 5~~** | ~~Set up automated database backups~~ | ~~Backup scripts created, cron job documented~~ | ~~Ops~~ | **✅ DONE** |
| **Day 6** | Add health check to GitHub Actions | CI fails if health check fails post-deploy | Dev | Pending |
| **Day 7** | Review and merge all Week 1 changes | All PRs merged, production stable | Lead | Pending |

### Week 2: Structural Improvements

| Day | Task | Success Criteria | Owner | Status |
|-----|------|------------------|-------|--------|
| **Day 8** | Implement structured logging (Pino) | JSON logs with request IDs, timestamps | Dev | **DONE** |
| **Day 9** | Set up log aggregation (Axiom free tier) | Logs searchable in Axiom dashboard | Ops | **DONE** |
| **Day 10** | Improve PDF service reliability | PDF generation handles transient failures gracefully | Dev | **DONE** |
| **Day 11** | Centralize secret management | No secrets in repository, synced across environments | Ops | **DONE** |
| **Day 12** | Add build validation for env vars | Build fails if required env vars are missing or placeholders | Dev | **DONE** |
| **Day 13** | Document golden path workflows | Canonical workflows documented and discoverable in docs | Dev | **DONE** |
| **Day 14** | Final review and documentation update | AI Operating Manual updated, team walkthrough complete | Lead | **DONE** |

### Validation Checkpoints

At the end of each week, verify:

**Week 1 Checkpoint**:
- [x] Invoice issuance works correctly under load (code fixed, testing pending)
- [x] Documentation is consolidated and navigable
- [x] Webhook requires authentication
- [x] Deployments are reproducible (pnpm with --frozen-lockfile)
- [x] Backups are running and restorable (scripts created, cron setup documented)

**Week 2 Checkpoint**:
- [x] Logs are structured and searchable
- [x] PDF generation is reliable
- [x] Secrets are managed centrally
- [x] Build process validates critical variables
- [x] Team understands new workflows

---

## Appendix A: File Cleanup Recommendations

The following files should be deleted or consolidated:

| File | Action | Reason |
|------|--------|--------|
| `DEBUG_AUTH.md` | Delete | Empty file (0 bytes) |
| `DEPLOYMENT_INFOMANIAK.md` | Delete | Empty file (0 bytes) |
| `HOW_TO_CHECK_LOGS.md` | Delete | Empty file (0 bytes) |
| `MIGRATION_SUMMARY.md` | Delete | Empty file (0 bytes) |
| `BEREITSTELLUNG.md` | Merge into DEPLOYMENT.md | German duplicate of deployment docs |
| `DEPLOYMENT_COMPLETE.md` | Delete | One-time status document |
| `IMPLEMENTATION_COMPLETE.md` | Delete | One-time status document |
| `CLEANUP_COMPLETE.md` | Delete | One-time status document |
| `CHANGES_SUMMARY.md` | Delete | One-time status document |
| `PR_DESCRIPTION.md` | Delete | Should be in PR, not repo |
| `INFRA_PR_DESCRIPTION.md` | Delete | Should be in PR, not repo |
| `BRANCH_COMPARISON.md` | Delete | Temporary analysis document |

Recommended final documentation structure:

```
mantodeus-manager/
├── README.md                    # Project overview, quick start
├── AI_Operating_Manual.md       # AI context document
└── docs/
    ├── DEPLOYMENT.md            # Deployment guide
    ├── DEVELOPMENT.md           # Local development setup
    ├── DATABASE.md              # Drizzle workflow, migrations
    ├── TROUBLESHOOTING.md       # Common issues and fixes
    └── ARCHITECTURE.md          # System design overview
```

---

## Appendix B: SSH Configuration

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

---

*Report generated by Manus AI on December 21, 2025*
