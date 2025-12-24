# Webhook Listener Setup

This webhook listener automatically deploys the application when code is pushed to the `main` branch on GitHub.

## Prerequisites

1. **Dependencies must be installed**: The webhook listener requires `express` and other dependencies from `package.json`. 

   ```bash
   # If pnpm is available:
   pnpm install --frozen-lockfile
   
   # Otherwise, use npm:
   npm install
   ```

2. **Environment Variables**: Set `WEBHOOK_SECRET` in your environment:
   ```bash
   export WEBHOOK_SECRET="your-secret-here"
   # Generate a secret: openssl rand -hex 32
   ```

## Starting the Webhook Listener

### Option 1: Using Ecosystem Config (Recommended)

This uses the wrapper script that ensures dependencies are available:

```bash
cd /srv/customer/sites/manager.mantodeus.com
npx pm2 start infra/webhook/ecosystem.config.cjs
npx pm2 save
```

### Option 2: Using Wrapper Script Directly

```bash
cd /srv/customer/sites/manager.mantodeus.com
chmod +x infra/webhook/start-webhook.sh
npx pm2 start infra/webhook/start-webhook.sh --name webhook-listener
npx pm2 save
```

### Option 3: Direct Start (If Dependencies Are Already Installed)

```bash
cd /srv/customer/sites/manager.mantodeus.com
export NODE_PATH="/srv/customer/sites/manager.mantodeus.com/node_modules"
npx pm2 start infra/webhook/webhook-listener.js --name webhook-listener
npx pm2 save
```

## Troubleshooting

### Error: Cannot find package 'express'

This means dependencies are not installed. Run:

```bash
cd /srv/customer/sites/manager.mantodeus.com

# If pnpm is available:
pnpm install --frozen-lockfile

# Otherwise:
npm install
```

### Error: pnpm command not found

The project uses `pnpm` but the server may not have it. You can:

1. **Install pnpm using corepack** (recommended, Node.js 16.10+):
   ```bash
   corepack enable
   corepack prepare pnpm@10.4.1 --activate
   ```

2. **Install pnpm globally via npm**:
   ```bash
   npm install -g pnpm@10.4.1
   ```

3. **Or use npm instead** (fallback, may not respect pnpm-lock.yaml exactly):
   ```bash
   npm install
   ```

**Note**: The wrapper script (`start-webhook.sh`) will automatically try to install pnpm if it's missing.

### Checking Logs

```bash
npx pm2 logs webhook-listener --lines 50
```

### Restarting

```bash
npx pm2 restart webhook-listener
```

### Stopping

```bash
npx pm2 stop webhook-listener
npx pm2 delete webhook-listener
```

## Configuration

The webhook listener can be configured via environment variables:

- `WEBHOOK_SECRET` (required): GitHub webhook secret for signature verification
- `WEBHOOK_PORT` (default: 9000): Port to listen on
- `APP_PATH` (default: /srv/customer/sites/manager.mantodeus.com): Application path
- `PM2_APP_NAME` (default: mantodeus-manager): PM2 app name to restart on deploy

## GitHub Webhook Setup

1. Go to your GitHub repository → Settings → Webhooks
2. Add webhook:
   - **Payload URL**: `https://your-domain.com:9000/webhook`
   - **Content type**: `application/json`
   - **Secret**: The same value as `WEBHOOK_SECRET`
   - **Events**: Select "Just the push event"
3. Save the webhook

## Health Check

The webhook listener exposes a health check endpoint:

```bash
curl http://localhost:9000/health
```

