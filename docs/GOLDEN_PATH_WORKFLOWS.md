# Golden Path Workflows

These are the happy-path, copy-paste workflows for day-to-day work. Use these first.

## Principles

- One environment, one deployment path, one `.env`.
- Prefer the canonical scripts in `infra/` over ad-hoc commands.
- Keep production safe: no `drizzle-kit push`, only migrations.

---

## 1) Local Development (first time)

```bash
git clone https://github.com/mantodeus/mantodeus-manager.git
cd mantodeus-manager
cp .env.example .env
# Fill in .env values
pnpm install
pnpm dev
```

## 2) Local Development (daily)

```bash
pnpm install
pnpm dev
```

## 3) Build Validation (before deploy)

```bash
pnpm build
```

Build will fail fast if any required `.env` variables are missing or placeholders.

## 4) Database Schema Change (safe)

```bash
# 1) Edit drizzle/schema.ts
pnpm db:generate
# 2) Review generated SQL in drizzle/
pnpm db:migrate
git add drizzle/ drizzle/schema.ts
git commit -m "feat(db): describe change"
```

## 5) Production Deployment (canonical)

```bash
git push origin main
```

Webhook triggers `infra/deploy/deploy.sh` on the server.

## 6) Manual Production Deployment (fallback)

```bash
ssh mantodeus-server
cd /srv/customer/sites/manager.mantodeus.com
bash infra/deploy/deploy.sh
```

## 7) Production Migration (after deploy)

```bash
ssh mantodeus-server
cd /srv/customer/sites/manager.mantodeus.com
pnpm db:migrate
```

## 8) Update a Single Environment Variable (production)

```bash
ssh mantodeus-server
cd /srv/customer/sites/manager.mantodeus.com
./infra/env/env-update.sh VARIABLE_NAME "value"
```

## 9) Sync .env with Template

```bash
ssh mantodeus-server
cd /srv/customer/sites/manager.mantodeus.com
./infra/env/env-sync.sh
```

## 10) Health Check After Deploy

```bash
curl https://manager.mantodeus.com/api/health
pm2 status
pm2 logs mantodeus-manager --lines 50
```

## 11) Rollback (if needed)

```bash
ssh mantodeus-server
cd /srv/customer/sites/manager.mantodeus.com
./infra/deploy/restart.sh --rollback
```

## 12) PDF Service Quick Check

```bash
curl https://pdf-service-withered-star-4195.fly.dev/health
fly status -a pdf-service-withered-star-4195
```

---

## Common Pitfalls (avoid)

- Do not run `drizzle-kit push` in production.
- Do not edit production `.env` directly; use `env-update.sh`.
- Do not deploy via other scripts; use `infra/deploy/deploy.sh`.
