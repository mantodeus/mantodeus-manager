# Fixing SSH Disconnection During npm install

## Problem
When running `npm install` on the server, the SSH connection closes after a few minutes with:
```
Connection to 57-105224.ssh.hosting-ik.com closed.
```

This happens because:
1. **SSH idle timeout**: The server closes idle SSH connections
2. **Long-running process**: `npm install` can take 5-15+ minutes
3. **No output**: npm may not produce output for long periods, making SSH think it's idle

## Solutions

### Option 1: Use the Install Script (Recommended)
The `install-deps.sh` script runs npm install in the background using `nohup`, so it survives SSH disconnection:

```bash
cd /srv/customer/sites/manager.mantodeus.com
bash infra/deploy/install-deps.sh
```

This will:
- Start npm install in the background
- Create a log file you can monitor
- Continue even if you disconnect from SSH
- Show you the process ID to check status

**Monitor progress:**
```bash
# Watch the log file
tail -f npm-install-*.log

# Check if process is still running
ps aux | grep npm
```

### Option 2: Use nohup Manually
```bash
cd /srv/customer/sites/manager.mantodeus.com

# Start installation in background
nohup npm install > npm-install.log 2>&1 &

# Note the process ID (shown after &)
# Example: [1] 12345

# Monitor progress
tail -f npm-install.log

# Check status
ps aux | grep 12345
```

### Option 3: Use screen or tmux
If available on the server:

**With screen:**
```bash
screen -S npm-install
npm install
# Press Ctrl+A then D to detach
# Reconnect later with: screen -r npm-install
```

**With tmux:**
```bash
tmux new -s npm-install
npm install
# Press Ctrl+B then D to detach
# Reconnect later with: tmux attach -t npm-install
```

### Option 4: Keep SSH Connection Alive
Add to your local `~/.ssh/config`:
```
Host 57-105224.ssh.hosting-ik.com
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

This sends keepalive packets every 60 seconds to prevent timeout.

### Option 5: Use the Deploy Script
The deploy script (`scripts/deploy.sh`) handles this automatically:
```bash
bash scripts/deploy.sh
```

## Checking Installation Status

After starting installation (with any method):

```bash
# Check if npm process is running
ps aux | grep npm

# Check log file (if using install-deps.sh)
tail -20 npm-install-*.log

# Check for node_modules directory
ls -la node_modules | head -20

# Check disk space (in case it failed due to space)
df -h .
```

## If Installation Fails

1. **Check the log file:**
   ```bash
   cat npm-install-*.log
   ```

2. **Common issues:**
   - **ENOTEMPTY errors**: Run `bash infra/deploy/fix-npm-enotempty.sh`
   - **Disk space**: Check with `df -h .`
   - **Network issues**: Check connectivity
   - **Permission issues**: Check file permissions

3. **Retry:**
   ```bash
   rm -rf node_modules
   bash infra/deploy/install-deps.sh
   ```

## Best Practice

For production deployments, always use:
```bash
bash scripts/deploy.sh
```

This script:
- ✅ Handles SSH disconnections
- ✅ Cleans node_modules properly
- ✅ Uses the correct package manager
- ✅ Builds the application
- ✅ Restarts PM2
- ✅ Provides detailed logging

## Quick Reference

| Task | Command |
|------|---------|
| Install deps (SSH-safe) | `bash infra/deploy/install-deps.sh` |
| Monitor install | `tail -f npm-install-*.log` |
| Check if running | `ps aux | grep npm` |
| Full deploy | `bash scripts/deploy.sh` |
| Fix ENOTEMPTY | `bash infra/deploy/fix-npm-enotempty.sh` |

