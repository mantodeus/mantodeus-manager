# Webhook Listener Stability Fixes

## Problem
The webhook listener was sometimes shutting down and disappearing from PM2, requiring manual restart.

## Root Causes Identified
1. **Uncaught exceptions** - No error handlers for uncaught exceptions
2. **Unhandled promise rejections** - Could crash the process
3. **Express errors** - Server errors not properly handled
4. **Deployment errors** - Errors in deployment function could crash the listener
5. **PM2 restart settings** - Not configured to prevent rapid restart loops

## Fixes Applied

### 1. Error Handlers Added
- ✅ `uncaughtException` handler - Logs and exits gracefully
- ✅ `unhandledRejection` handler - Logs but doesn't crash (recoverable)
- ✅ Express error middleware - Catches and logs Express errors
- ✅ Server error handler - Catches HTTP server errors

### 2. PM2 Configuration Improved
- ✅ `min_uptime: '10s'` - Process must run 10s before considered stable
- ✅ `max_restarts: 10` - Max 10 restarts within time window
- ✅ `restart_delay: 4000` - Wait 4s between restarts
- ✅ `exp_backoff_restart_delay: 100` - Exponential backoff
- ✅ `time_window: '1h'` - Reset restart count after 1 hour
- ✅ `kill_timeout: 5000` - Graceful shutdown timeout
- ✅ `listen_timeout: 10000` - Wait 10s for app to start

### 3. Deployment Error Handling
- ✅ Deployment errors no longer crash the webhook listener
- ✅ All errors are logged but don't cause process exit
- ✅ Logging failures are handled gracefully

## Setup Instructions

### 1. Restart Webhook with New Config
```bash
cd /srv/customer/sites/manager.mantodeus.com

# Delete old process
npx pm2 delete webhook-listener

# Start with updated config
npx pm2 start infra/webhook/ecosystem.config.cjs
npx pm2 save
```

### 2. Set Up Monitoring (Optional but Recommended)
The monitoring script will automatically restart the webhook if it goes down:

```bash
# Make script executable
chmod +x infra/webhook/monitor-webhook.sh

# Test it manually
bash infra/webhook/monitor-webhook.sh

# Add to crontab (runs every 5 minutes)
crontab -e
# Add this line:
*/5 * * * * /srv/customer/sites/manager.mantodeus.com/infra/webhook/monitor-webhook.sh
```

### 3. Check Logs
```bash
# Webhook logs
tail -f logs/webhook.log

# PM2 logs
npx pm2 logs webhook-listener

# Monitor script logs
tail -f logs/webhook-monitor.log
```

## Monitoring

### Check Status
```bash
# Quick status check
npx pm2 list | grep webhook

# Health check
curl http://localhost:9000/health

# Full diagnostic
bash infra/webhook/check-webhook.sh
```

### If Webhook Goes Down
1. Check PM2 logs: `npx pm2 logs webhook-listener --err --lines 50`
2. Check webhook log: `tail -n 50 logs/webhook.log`
3. Check monitor log: `tail -n 20 logs/webhook-monitor.log`
4. Restart manually: `npx pm2 restart webhook-listener`

## What Changed

### Files Modified
- `infra/webhook/webhook-listener.js` - Added comprehensive error handling
- `infra/webhook/ecosystem.config.cjs` - Improved PM2 restart settings

### Files Created
- `infra/webhook/monitor-webhook.sh` - Automatic monitoring and restart script
- `infra/webhook/STABILITY_FIXES.md` - This document

## Expected Behavior

1. **Normal operation**: Webhook runs continuously, handles errors gracefully
2. **Deployment errors**: Logged but don't crash the listener
3. **Uncaught exceptions**: Logged with full stack trace, then graceful exit (PM2 will restart)
4. **Unhandled rejections**: Logged but process continues running
5. **PM2 restarts**: Controlled with exponential backoff to prevent loops

## Troubleshooting

### Webhook keeps restarting
- Check logs: `npx pm2 logs webhook-listener --err`
- Check for missing WEBHOOK_SECRET
- Check for port conflicts: `lsof -i :9000`
- Check memory: `npx pm2 monit`

### Webhook disappears from PM2
- Check PM2 daemon: `npx pm2 ping`
- Check system logs: `journalctl -u pm2` (if systemd)
- Enable monitoring script (see above)
- Check if process is being killed by OOM killer: `dmesg | grep -i "out of memory"`

### Deployment fails but webhook stays up
- This is expected behavior - deployment errors are logged but don't crash the listener
- Check deployment logs in `logs/webhook.log`
- Check deploy script output in PM2 logs

