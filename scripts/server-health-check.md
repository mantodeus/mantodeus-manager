# Server Health Check & Recovery

If the server is unresponsive or SSH keeps disconnecting:

## Quick Recovery Steps

### 1. Try to SSH in (may take multiple attempts)
```bash
ssh mantodeus
# If it hangs, wait 30-60 seconds, then Ctrl+C and try again
```

### 2. Once connected (even briefly), run:
```bash
cd /srv/customer/sites/manager.mantodeus.com

# Check what's running
ps aux | grep -E "(vite|pnpm|node.*build)" | grep -v grep

# Kill stuck build processes
pkill -9 -f "vite build"
pkill -9 -f "pnpm run build"
pkill -9 -f "node.*build-debug"
pkill -9 -f "esbuild"
```

### 3. Check system resources
```bash
# Memory
free -h

# CPU (top processes)
ps aux --sort=-%cpu | head -10

# Disk
df -h
```

### 4. If server is completely unresponsive:
- Contact hosting support (Infomaniak)
- They may need to restart the server or kill processes
- Reference: "Node.js build process consuming all resources"

## Prevention

### Always use nohup for builds:
```bash
cd /srv/customer/sites/manager.mantodeus.com
nohup bash -c "export NODE_OPTIONS=--max-old-space-size=4096 && npx pnpm run build" > build.log 2>&1 &
```

### Monitor build progress:
```bash
tail -f build.log
```

### Set resource limits (if possible):
- Limit Node.js memory usage
- Use build queue if multiple deployments
- Consider building locally and uploading dist/

## Alternative: Build Locally

If server builds keep causing issues:

1. Build on your local machine
2. Upload only the `dist/` folder
3. Restart PM2 on server

```bash
# Local
npm run build
tar czf dist.tar.gz dist/

# Upload to server
scp dist.tar.gz mantodeus:/srv/customer/sites/manager.mantodeus.com/

# On server
cd /srv/customer/sites/manager.mantodeus.com
tar xzf dist.tar.gz
npx pm2 restart mantodeus-manager
```

