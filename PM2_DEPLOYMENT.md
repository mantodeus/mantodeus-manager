# PM2 Deployment Fix - Preventing Restart Loops

This guide fixes the PM2 restart loop issue where multiple processes try to bind to port 3000.

## Problem

When PM2 restarts, multiple `mantodeus-manager` processes were being created, causing port conflicts and crash loops.

## Solution

We've created:
1. **`ecosystem.config.js`** - PM2 configuration file that ensures only 1 instance runs
2. **`start-server.sh`** - Startup script that kills any process on port 3000 before starting

## Deployment Steps on Infomaniak Server

### Step 1: Clean Up Existing PM2 Processes

```bash
cd ~/sites/manager.mantodeus.com
npx pm2 kill
```

### Step 2: Make Script Executable

```bash
chmod +x start-server.sh
```

### Step 3: Start Using Ecosystem Config

```bash
npx pm2 start ecosystem.config.js
npx pm2 save
```

### Step 4: Verify

```bash
npx pm2 list
```

You should see only **one** `mantodeus-manager` process.

### Step 5: Restart GitHub Webhook (if needed)

```bash
# If you have a separate webhook process
npx pm2 start deploy/deploy.js --name github-webhook
npx pm2 save
```

## How It Works

1. **`start-server.sh`** runs first and kills any process on port 3000
2. **`ecosystem.config.js`** ensures `instances: 1` - only one process can run
3. PM2 saves this clean state, so restarts will always use the same config

## Troubleshooting

If you still see duplicates:

```bash
# Kill everything
npx pm2 kill

# Delete the dump file (forces fresh start)
rm ~/.pm2/dump.pm2

# Start fresh
npx pm2 start ecosystem.config.js
npx pm2 save
```

## Restart Commands

```bash
# Restart the app
npx pm2 restart mantodeus-manager

# View logs
npx pm2 logs mantodeus-manager --lines 50

# Check status
npx pm2 status
```

