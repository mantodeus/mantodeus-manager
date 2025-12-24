# Starting PM2 Process for the First Time

## The Error
```
[PM2][ERROR] Process or Namespace mantodeus-manager not found
```

This happens when you try to restart a PM2 process that hasn't been started yet.

## Solution: Start the Process First

### Option 1: Using ecosystem.config.js (Recommended)

```bash
cd /srv/customer/sites/manager.mantodeus.com

# Start using ecosystem config
npx pm2 start ecosystem.config.js

# Or if pm2 is installed globally
pm2 start ecosystem.config.js
```

**Note:** The ecosystem.config.js now uses `npm start` directly, which is more reliable than referencing shell scripts.

### Option 2: Using npm start

```bash
cd /srv/customer/sites/manager.mantodeus.com

# Start with npm
npx pm2 start npm --name mantodeus-manager -- start

# Or if pm2 is installed globally
pm2 start npm --name mantodeus-manager -- start
```

### Option 3: Using the start script directly

```bash
cd /srv/customer/sites/manager.mantodeus.com

# If start-server.sh exists
npx pm2 start start-server.sh --name mantodeus-manager

# Or
pm2 start start-server.sh --name mantodeus-manager
```

## After Starting

1. **Save the PM2 process list** (so it persists):
   ```bash
   npx pm2 save
   # or
   pm2 save
   ```

2. **Check status**:
   ```bash
   npx pm2 status
   # or
   pm2 status
   ```

3. **View logs**:
   ```bash
   npx pm2 logs mantodeus-manager
   # or
   pm2 logs mantodeus-manager
   ```

## Future Restarts

Once the process is started, you can use:
```bash
npx pm2 restart mantodeus-manager
# or
pm2 restart mantodeus-manager
```

## Using the Deploy Script

The deploy script (`infra/deploy/deploy.sh`) now automatically:
- Checks if the process exists
- Starts it if it doesn't exist
- Restarts it if it does exist

So you can just run:
```bash
bash infra/deploy/deploy.sh
```

## Quick Reference

| Task | Command |
|------|---------|
| Start (first time) | `npx pm2 start ecosystem.config.js` |
| Restart (if running) | `npx pm2 restart mantodeus-manager` |
| Stop | `npx pm2 stop mantodeus-manager` |
| Status | `npx pm2 status` |
| Logs | `npx pm2 logs mantodeus-manager` |
| Save | `npx pm2 save` |

