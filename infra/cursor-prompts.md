# Cursor AI Prompts for Mantodeus Manager Deployment

This document provides natural-language prompts that Cursor AI can use to manage the Mantodeus Manager application on Infomaniak servers.

## 🎯 How to Use

Simply copy and paste these prompts into Cursor AI. The AI will execute the corresponding SSH commands and interpret the JSON output.

---

## 📦 Deployment

### Deploy the application

**Prompt:**
```
Deploy the Mantodeus Manager application to production. Pull latest code from GitHub, install dependencies, build, and restart the service.
```

**Command:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/deploy.sh"
```

**Expected Output:**
```json
{
  "status": "success",
  "git_pull": "success",
  "build": "success",
  "restart": "success",
  "health": "healthy"
}
```

---

### Preview deployment without making changes

**Prompt:**
```
Show me what would happen if I deployed now, but don't actually make any changes.
```

**Command:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/deploy.sh --dry-run"
```

---

### Deploy without restarting the service

**Prompt:**
```
Build the latest code but don't restart the application yet.
```

**Command:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/deploy.sh --skip-restart"
```

---

## 🔄 Restart & Rollback

### Restart the application safely

**Prompt:**
```
Restart the Mantodeus Manager application with health checks.
```

**Command:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh"
```

**Expected Output:**
```json
{
  "status": "success",
  "status_before": "online",
  "status_after": "online",
  "health": "healthy"
}
```

---

### Rollback to previous version

**Prompt:**
```
The application is broken. Roll back to the previous working version.
```

**Command:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh --rollback"
```

**Expected Output:**
```json
{
  "status": "success",
  "action": "rollback",
  "rollback": "success",
  "rollback_from": "backup-20251205-143000.tar.gz"
}
```

---

### Force restart without health checks

**Prompt:**
```
Force restart the application immediately without waiting for health checks.
```

**Command:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh --force"
```

---

## 📊 Status & Health

### Check application status

**Prompt:**
```
What's the current status of the Mantodeus Manager application?
```

**Command:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/status.sh"
```

**Expected Output:**
```json
{
  "timestamp": "2025-12-05T14:30:00Z",
  "status": "online",
  "health": "healthy",
  "uptime_human": "2d 5h 30m 15s",
  "memory_mb": "245.67",
  "cpu_percent": "1.2",
  "restart_count": "0",
  "git_commit": "a1b2c3d",
  "git_branch": "main",
  "build_exists": "true"
}
```

---

### Is the application healthy?

**Prompt:**
```
Is the application running properly? Give me a quick health check.
```

**Command:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/status.sh" | jq -r '.health'
```

**Expected Output:**
```
healthy
```

---

### How much memory is the app using?

**Prompt:**
```
How much memory is the Mantodeus Manager using right now?
```

**Command:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/status.sh" | jq -r '.memory_mb + " MB"'
```

**Expected Output:**
```
245.67 MB
```

---

### How long has the app been running?

**Prompt:**
```
How long has the application been running since the last restart?
```

**Command:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/status.sh" | jq -r '.uptime_human'
```

**Expected Output:**
```
2d 5h 30m 15s
```

---

## 📝 Logs

### Show me the latest logs

**Prompt:**
```
Show me the last 50 lines of application logs.
```

**Command:**
```bash
ssh mantodeus-server "tail -50 /srv/customer/sites/manager.mantodeus.com/logs/mantodeus-manager-out.log"
```

---

### Show me error logs

**Prompt:**
```
Show me recent error logs to help debug issues.
```

**Command:**
```bash
ssh mantodeus-server "tail -50 /srv/customer/sites/manager.mantodeus.com/logs/mantodeus-manager-error.log"
```

---

### Monitor logs in real-time

**Prompt:**
```
Show me live logs as they happen.
```

**Command:**
```bash
ssh mantodeus-server "tail -f /srv/customer/sites/manager.mantodeus.com/logs/mantodeus-manager-out.log"
```

---

## 🔧 Environment Variables

### Check environment variable sync

**Prompt:**
```
Check if all required environment variables are set properly.
```

**Command:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/env/env-sync.sh --check-only"
```

---

### Sync environment variables

**Prompt:**
```
Make sure .env has all the variables from .env.example.
```

**Command:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/env/env-sync.sh"
```

---

### Update an environment variable

**Prompt:**
```
Update the DATABASE_URL environment variable to [new-value].
```

**Command:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/env/env-update.sh DATABASE_URL 'new-value'"
```

**Note:** After updating environment variables, restart the application:
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh"
```

---

## 🔍 Diagnostics

### Run full diagnostics

**Prompt:**
```
Run a complete diagnostic check on the server and application.
```

**Commands:**
```bash
# Check SSH connection
./infra/ssh/ssh-check.sh mantodeus-server

# Check application status
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/status.sh"

# Check environment variables
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/env/env-sync.sh --check-only"

# Check recent logs
ssh mantodeus-server "tail -100 /srv/customer/sites/manager.mantodeus.com/logs/mantodeus-manager-error.log"
```

---

### Test SSH connection

**Prompt:**
```
Test if I can connect to the server via SSH.
```

**Command:**
```bash
./infra/ssh/ssh-check.sh mantodeus-server
```

**Expected Output:**
```json
{
  "connection_status": "success",
  "connection_time_seconds": "2",
  "project_dir_exists": "true",
  "infra_scripts_exist": "true"
}
```

---

## 🚨 Emergency Procedures

### Application is down - quick recovery

**Prompt:**
```
The application is down! Perform emergency recovery steps.
```

**Commands:**
```bash
# 1. Check status
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/status.sh"

# 2. Check error logs
ssh mantodeus-server "tail -100 /srv/customer/sites/manager.mantodeus.com/logs/mantodeus-manager-error.log"

# 3. Try restart
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh"

# 4. If restart fails, rollback
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh --rollback"
```

---

### Deployment failed - rollback

**Prompt:**
```
The last deployment broke the application. Rollback to the previous version immediately.
```

**Command:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh --rollback"
```

---

### Application is slow - check resources

**Prompt:**
```
The application is running slow. Check resource usage.
```

**Commands:**
```bash
# Check application memory/CPU
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/status.sh" | jq '{memory_mb, cpu_percent, restart_count}'

# Check system load
ssh mantodeus-server "uptime"

# Check disk space
ssh mantodeus-server "df -h /srv/customer/sites/manager.mantodeus.com"
```

---

## 📈 Monitoring

### Get deployment history

**Prompt:**
```
Show me the recent Git commits deployed to production.
```

**Command:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && git log --oneline -10"
```

---

### Check current deployed version

**Prompt:**
```
What version (Git commit) is currently deployed?
```

**Command:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/status.sh" | jq -r '.git_commit + " (" + .git_branch + ")"'
```

**Expected Output:**
```
a1b2c3d (main)
```

---

### Check restart count

**Prompt:**
```
How many times has the application restarted? (High restart count indicates issues)
```

**Command:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/status.sh" | jq -r '.restart_count'
```

---

## 🔐 Security

### Check SSH key status

**Prompt:**
```
Verify that my SSH key is properly configured and working.
```

**Command:**
```bash
./infra/ssh/ssh-check.sh mantodeus-server
```

---

### Rotate webhook secret

**Prompt:**
```
Generate a new webhook secret and update it on the server.
```

**Commands:**
```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -hex 32)
echo "New webhook secret: $NEW_SECRET"

# 2. Update on server
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/env/env-update.sh WEBHOOK_SECRET '$NEW_SECRET'"

# 3. Restart webhook listener
ssh mantodeus-server "pm2 restart webhook-listener"

# 4. Update in GitHub repository settings
echo "Don't forget to update the webhook secret in GitHub repository settings!"
```

---

## 💡 Tips for Cursor AI

### Interpreting JSON Output

When you receive JSON output, extract relevant information:

```javascript
// Check if deployment succeeded
if (output.status === "success") {
  console.log("✅ Deployment successful!");
}

// Check application health
if (output.health === "healthy") {
  console.log("✅ Application is healthy");
} else {
  console.log("⚠️ Application health issue:", output.health);
}

// Alert on high restarts
if (parseInt(output.restart_count) > 5) {
  console.log("⚠️ High restart count detected:", output.restart_count);
}
```

### Chaining Commands

For complex operations, chain commands:

```bash
# Deploy and verify
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/deploy.sh && sleep 5 && ./infra/deploy/status.sh"
```

### Error Handling

Always check command exit codes:

```bash
if ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/deploy.sh"; then
  echo "✅ Deployment successful"
else
  echo "❌ Deployment failed, checking logs..."
  ssh mantodeus-server "tail -50 /srv/customer/sites/manager.mantodeus.com/logs/mantodeus-manager-error.log"
fi
```

---

## 📚 Additional Resources

- [Infrastructure README](./README.md) - Complete infrastructure documentation
- [Delete Safeguards](../DELETE_SAFEGUARDS.md) - Safety features and rollback procedures
- [Deployment Guide](../DEPLOYMENT.md) - Manual deployment instructions

---

## 🆘 Getting Help

If Cursor AI encounters issues:

1. **Check connection:** `./infra/ssh/ssh-check.sh`
2. **View status:** `ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/status.sh"`
3. **Check logs:** `ssh mantodeus-server "tail -100 /srv/customer/sites/manager.mantodeus.com/logs/mantodeus-manager-error.log"`
4. **Rollback if needed:** `ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh --rollback"`
