# Cursor AI Prompts for Mantodeus Manager Deployment

This document contains natural-language prompts you can use with Cursor AI to deploy and manage your application.

## 🚀 Deployment Commands

### Basic Deployment

**Prompt:**
```
Deploy the Mantodeus Manager application to production.
```

**Command Executed:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && bash scripts/deploy.sh"
```

---

**Prompt:**
```
Deploy the application with a dry run first to test the deployment process.
```

**Command Executed:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && bash scripts/deploy.sh"
```

---

**Prompt:**
```
Deploy the application without creating a backup.
```

**Command Executed:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && bash scripts/deploy.sh"
```

---

**Prompt:**
```
Deploy the application but skip the health check at the end.
```

**Command Executed:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && bash scripts/deploy.sh"
```

---

## 📊 Status and Monitoring

### Check Application Status

**Prompt:**
```
What's the current status of the Mantodeus Manager application?
```

**Command Executed:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/status.sh"
```

**Expected Output:**
```json
{
  "status": "online",
  "pm2_status": "online",
  "health": "healthy",
  "uptime_human": "2d 5h 30m",
  "memory_mb": "245.67",
  "cpu_percent": "1.2",
  "git_commit": "a1b2c3d",
  "git_branch": "main"
}
```

---

**Prompt:**
```
Show me the application uptime and resource usage.
```

**Command Executed:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/status.sh"
```

---

**Prompt:**
```
Check if the application is healthy and responding.
```

**Command Executed:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/status.sh"
```

---

**Prompt:**
```
What Git commit is currently deployed?
```

**Command Executed:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/status.sh"
```

---

## 🔄 Restart Commands

### Safe Restart

**Prompt:**
```
Restart the Mantodeus Manager application safely.
```

**Command Executed:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh"
```

---

**Prompt:**
```
Restart the application and create a backup before doing so.
```

**Command Executed:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh"
```

---

### Rollback

**Prompt:**
```
The deployment broke production. Rollback immediately.
```

**Command Executed:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh --rollback"
```

---

**Prompt:**
```
Rollback to the previous version of the application.
```

**Command Executed:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh --rollback"
```

---

**Prompt:**
```
Rollback to backup file backup-20251205-143000.tar.gz.
```

**Command Executed:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh --backup-file=backup-20251205-143000.tar.gz"
```

---

## 📝 Logs and Debugging

### View Logs

**Prompt:**
```
Show me the last 50 lines of the application logs.
```

**Command Executed:**
```bash
ssh mantodeus-server "pm2 logs mantodeus-manager --lines 50"
```

---

**Prompt:**
```
Show me the error logs from the application.
```

**Command Executed:**
```bash
ssh mantodeus-server "pm2 logs mantodeus-manager --err --lines 100"
```

---

**Prompt:**
```
Show me the webhook listener logs.
```

**Command Executed:**
```bash
ssh mantodeus-server "cat /srv/customer/sites/manager.mantodeus.com/logs/webhook.log | tail -50"
```

---

**Prompt:**
```
What errors are in the application logs?
```

**Command Executed:**
```bash
ssh mantodeus-server "pm2 logs mantodeus-manager --err --lines 100"
```

---

## 🔧 Environment Variables

### Update Environment Variables

**Prompt:**
```
Update the DATABASE_URL environment variable to mysql://user:pass@host/db.
```

**Command Executed:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/env/env-update.sh DATABASE_URL 'mysql://user:pass@host/db'"
```

---

**Prompt:**
```
Sync the .env file with .env.example to add any missing variables.
```

**Command Executed:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/env/env-sync.sh"
```

---

## 🔐 SSH and Connection

### Test SSH Connection

**Prompt:**
```
Test the SSH connection to the server.
```

**Command Executed:**
```bash
./infra/ssh/ssh-check.sh mantodeus-server
```

---

**Prompt:**
```
Verify that I can connect to the production server.
```

**Command Executed:**
```bash
./infra/ssh/ssh-check.sh mantodeus-server
```

---

## 🧪 Testing

### Run Tests

**Prompt:**
```
Run the deployment simulation tests.
```

**Command Executed:**
```bash
./infra/tests/run-deploy-sim.sh
```

---

**Prompt:**
```
Test the deployment scripts without actually deploying.
```

**Command Executed:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && bash scripts/deploy.sh"
```

---

## 🚨 Emergency Procedures

### Emergency Rollback

**Prompt:**
```
Emergency! The application is broken. Rollback to the last working version immediately.
```

**Command Executed:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh --rollback"
```

---

**Prompt:**
```
The application crashed. Restart it immediately.
```

**Command Executed:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh"
```

---

**Prompt:**
```
Stop the application immediately.
```

**Command Executed:**
```bash
ssh mantodeus-server "pm2 stop mantodeus-manager"
```

---

**Prompt:**
```
Start the application.
```

**Command Executed:**
```bash
ssh mantodeus-server "pm2 start mantodeus-manager"
```

---

## 📦 Backup Management

### List Backups

**Prompt:**
```
Show me all available backups.
```

**Command Executed:**
```bash
ssh mantodeus-server "ls -lh /srv/customer/sites/manager.mantodeus.com/backups/"
```

---

**Prompt:**
```
What backups are available for rollback?
```

**Command Executed:**
```bash
ssh mantodeus-server "ls -lt /srv/customer/sites/manager.mantodeus.com/backups/ | head -10"
```

---

## 🔄 Git Operations

### Check Git Status

**Prompt:**
```
What's the Git status on the server?
```

**Command Executed:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && git status"
```

---

**Prompt:**
```
Show me the last 5 Git commits on the server.
```

**Command Executed:**
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && git log --oneline -5"
```

---

## 🌐 Webhook Management

### Check Webhook Status

**Prompt:**
```
Is the webhook listener running?
```

**Command Executed:**
```bash
ssh mantodeus-server "pm2 status webhook-listener"
```

---

**Prompt:**
```
Show me the webhook listener logs.
```

**Command Executed:**
```bash
ssh mantodeus-server "cat /srv/customer/sites/manager.mantodeus.com/logs/webhook.log | tail -50"
```

---

## 💡 Tips for Using These Prompts

1. **Be Specific**: The more specific your prompt, the better Cursor AI can understand your intent.

2. **Use Context**: Mention "production" or "server" to ensure Cursor AI uses the correct commands.

3. **Ask for Status**: Before deploying, ask for status to understand the current state.

4. **Use Dry-Run**: For testing, always mention "dry run" or "test" to avoid actual deployments.

5. **Emergency Keywords**: Use words like "emergency", "immediately", or "broken" for urgent actions.

---

## 🎯 Common Workflows

### Standard Deployment Workflow

**Prompt Sequence:**
1. "Check the current status of the application"
2. "Deploy the application to production"
3. "Verify the deployment was successful"

### Emergency Rollback Workflow

**Prompt Sequence:**
1. "The application is broken. Rollback immediately"
2. "Check if the application is healthy now"
3. "Show me the error logs"

### Update Environment Variable Workflow

**Prompt Sequence:**
1. "Update the DATABASE_URL environment variable to [new value]"
2. "Restart the application"
3. "Check if the application is healthy"

---

## 📚 Additional Resources

- **[README.md](./README.md)** - Complete infrastructure documentation
- **[SAFEGUARDS.md](./SAFEGUARDS.md)** - Safety features and procedures

---

**Happy deploying with Cursor AI!** 🚀
