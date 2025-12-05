# Safety Features and Safeguards

This document describes all safety features, backup systems, rollback procedures, and emergency protocols built into the Mantodeus Manager DevOps infrastructure.

---

## 🛡️ Security Safeguards

### 1. Non-Root Enforcement

**All scripts refuse to run as root:**

```bash
if [ "$(id -u)" -eq 0 ]; then
    echo "ERROR: This script should NOT be run as root"
    exit 1
fi
```

**Why:** Running deployment scripts as root is dangerous and can cause permission issues. All scripts enforce non-root execution.

**Impact:** Prevents accidental system-wide changes and maintains proper file ownership.

---

### 2. Secret Protection

**Scripts never echo or log sensitive values:**

- Database credentials (`DATABASE_URL`)
- API keys (`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`)
- JWT secrets (`JWT_SECRET`)
- Webhook secrets (`WEBHOOK_SECRET`)
- OAuth tokens

**Example:**
```bash
# env-update.sh never echoes the value
echo "✅ Updated ${VAR_NAME}"
# Value is never shown, even in logs
```

**Why:** Prevents secrets from appearing in logs, terminal history, or error messages.

**Impact:** Protects sensitive credentials from exposure.

---

### 3. SSH Key Security

**ED25519 Algorithm:**
- More secure than RSA
- Smaller key size
- Faster operations

**Proper Permissions:**
- Private key: `600` (read/write owner only)
- Public key: `644` (readable by all, writable by owner)

**Key-Based Authentication:**
- No password authentication
- Keys are never transmitted
- Proper key rotation support

**Why:** Ensures secure server access without password vulnerabilities.

---

### 4. Webhook Security

**GitHub Signature Verification:**
- HMAC-SHA256 algorithm
- Timing-safe comparison
- Prevents replay attacks

**Secret Required:**
```javascript
if (!SECRET) {
  console.warn('⚠️  WARNING: WEBHOOK_SECRET not set');
}
```

**Why:** Prevents unauthorized deployments from malicious webhook requests.

**Impact:** Only GitHub can trigger deployments (with correct secret).

---

## 💾 Backup System

### Automatic Backups

**When Backups Are Created:**
1. Before every deployment (`deploy.sh`)
2. Before every restart (`restart.sh`)
3. Before environment variable updates (`env-update.sh`)

**What Gets Backed Up:**
- `dist/` - Built application files
- `node_modules/` - Dependencies
- `package-lock.json` - Dependency lock file
- `.env` - Environment variables

**Backup Location:**
```
/srv/customer/sites/manager.mantodeus.com/backups/
```

**Backup Naming:**
```
backup-YYYYMMDD-HHMMSS.tar.gz
Example: backup-20251205-143000.tar.gz
```

### Backup Retention

**Policy:** Keep last 5 backups

**Implementation:**
```bash
# Keep only last 5 backups
ls -t "$BACKUP_DIR"/backup-*.tar.gz 2>/dev/null | tail -n +6 | xargs rm -f
```

**Why:** Prevents disk space issues while maintaining rollback capability.

**Impact:** Always have recent backups available for rollback.

---

## 🔄 Rollback Procedures

### Automatic Rollback

**When Rollback Happens:**
1. Manual rollback command (`restart.sh --rollback`)
2. After failed deployment (manual intervention)
3. After failed health check (manual intervention)

**Rollback Process:**
1. Stop PM2 process
2. Extract backup archive
3. Restore files (`dist/`, `node_modules/`, `.env`)
4. Restart PM2 process
5. Verify health check

**Rollback Command:**
```bash
./infra/deploy/restart.sh --rollback
```

**Specific Backup Rollback:**
```bash
./infra/deploy/restart.sh --backup-file=backup-20251205-143000.tar.gz
```

### Rollback Safety

**Checks Before Rollback:**
- Backup file exists
- Backup file is readable
- Project directory is writable
- PM2 is accessible

**Why:** Prevents partial rollbacks that could leave the system in an inconsistent state.

---

## 🏥 Health Checks

### Health Check System

**Endpoint:** `http://localhost:3000/api/trpc/system.health`

**Health Check Process:**
1. Wait for application to start (3 seconds)
2. Send HTTP request to health endpoint
3. Retry up to 5 times
4. Report success or failure

**Health Check Retries:**
- **Retries:** 5 attempts
- **Delay:** 3 seconds between attempts
- **Total Wait:** Up to 15 seconds

**Why:** Ensures application is actually running and responding before considering deployment successful.

**Impact:** Catches deployment failures early, before they affect users.

---

## 🚨 Emergency Procedures

### Application Down

**Symptoms:**
- Health check fails
- PM2 status shows "stopped" or "errored"
- Users cannot access the application

**Procedure:**
1. Check status: `./infra/deploy/status.sh`
2. Check logs: `pm2 logs mantodeus-manager --lines 100`
3. Restart: `./infra/deploy/restart.sh`
4. If restart fails, rollback: `./infra/deploy/restart.sh --rollback`

**Time to Resolution:** < 2 minutes

---

### Deployment Failed

**Symptoms:**
- Build fails
- Git pull fails
- PM2 restart fails
- Health check fails after deployment

**Procedure:**
1. Check deployment logs
2. Identify failure point
3. Rollback immediately: `./infra/deploy/restart.sh --rollback`
4. Investigate issue in development environment
5. Fix and redeploy

**Time to Rollback:** < 1 minute

---

### Database Connection Lost

**Symptoms:**
- Application starts but cannot connect to database
- Errors in logs about database connection
- Health check may pass but features fail

**Procedure:**
1. Check `.env` file: `cat .env | grep DATABASE_URL`
2. Verify database is accessible
3. Update connection string if needed: `./infra/env/env-update.sh DATABASE_URL 'new_connection_string'`
4. Restart application: `./infra/deploy/restart.sh`

**Time to Resolution:** < 5 minutes

---

### Disk Space Full

**Symptoms:**
- Backup creation fails
- Build fails
- Application cannot write logs

**Procedure:**
1. Check disk space: `df -h`
2. Clean old backups: `ls -t backups/ | tail -n +6 | xargs rm -f`
3. Clean old logs: `pm2 flush`
4. Clean node_modules if needed: `rm -rf node_modules && npm install`
5. Retry deployment

**Prevention:** Backup retention policy (keep only 5 backups)

---

## ✅ Best Practices

### Before Deployment

1. **Check Status:** Always check current status before deploying
   ```bash
   ./infra/deploy/status.sh
   ```

2. **Test Locally:** Test changes in development first

3. **Review Changes:** Review Git commits before deploying
   ```bash
   git log --oneline -10
   ```

4. **Dry Run:** Use `--dry-run` flag to test deployment process
   ```bash
   ./infra/deploy/deploy.sh --dry-run
   ```

### During Deployment

1. **Monitor Logs:** Watch logs during deployment
   ```bash
   pm2 logs mantodeus-manager --lines 50
   ```

2. **Wait for Health Check:** Don't interrupt the health check process

3. **Verify Success:** Check status after deployment
   ```bash
   ./infra/deploy/status.sh
   ```

### After Deployment

1. **Verify Health:** Ensure health check passes
   ```bash
   ./infra/deploy/status.sh
   ```

2. **Check Logs:** Review logs for any errors
   ```bash
   pm2 logs mantodeus-manager --err --lines 100
   ```

3. **Test Features:** Manually test critical features

4. **Monitor:** Monitor application for 5-10 minutes after deployment

---

## 🔍 Monitoring and Alerts

### Status Monitoring

**Check Application Status:**
```bash
./infra/deploy/status.sh
```

**Output Includes:**
- PM2 status (online/stopped/errored)
- Health check result (healthy/unhealthy)
- Uptime (human-readable)
- Memory usage (MB)
- CPU usage (%)
- Git commit and branch
- Uncommitted changes count

### Log Monitoring

**Application Logs:**
```bash
pm2 logs mantodeus-manager --lines 100
```

**Error Logs Only:**
```bash
pm2 logs mantodeus-manager --err --lines 100
```

**Webhook Logs:**
```bash
cat logs/webhook.log | tail -50
```

---

## 📋 Safety Checklist

Before deploying, verify:

- [ ] Status check passes
- [ ] No uncommitted changes (or intentional)
- [ ] Backup directory exists and is writable
- [ ] Disk space available (> 1GB)
- [ ] PM2 is running
- [ ] Health endpoint is accessible
- [ ] Environment variables are set correctly

After deploying, verify:

- [ ] Deployment completed successfully
- [ ] Health check passes
- [ ] No errors in logs
- [ ] Application responds to requests
- [ ] Critical features work
- [ ] Backup was created

---

## 🆘 Emergency Contacts

**If Emergency Procedures Don't Work:**

1. **Check Logs:** `pm2 logs mantodeus-manager --lines 200`
2. **Check Status:** `./infra/deploy/status.sh`
3. **Manual Rollback:** Extract backup manually if scripts fail
4. **Contact Support:** If all else fails, contact hosting provider

**Emergency Rollback (Manual):**
```bash
cd /srv/customer/sites/manager.mantodeus.com
pm2 stop mantodeus-manager
tar -xzf backups/backup-YYYYMMDD-HHMMSS.tar.gz
pm2 restart mantodeus-manager
```

---

## 📚 Additional Resources

- **[README.md](./README.md)** - Complete infrastructure documentation
- **[cursor-prompts.md](./cursor-prompts.md)** - Cursor AI natural-language prompts

---

**Safety First!** 🛡️
