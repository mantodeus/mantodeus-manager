# Infrastructure Safeguards & Safety Features

This document outlines all safety features, safeguards, and rollback procedures implemented in the Mantodeus Manager infrastructure.

## 🛡️ Core Safety Principles

1. **Never run as root** - All scripts enforce non-root execution
2. **Backup before changes** - Automatic backups before deployments and updates
3. **Validate inputs** - All user inputs are validated
4. **No secret echoing** - Sensitive values are never logged or echoed
5. **Rollback capability** - Easy rollback to previous versions
6. **Health checks** - Automatic health verification after changes

---

## 🔐 Security Safeguards

### Non-Root Enforcement

All deployment scripts check and refuse to run as root:

```bash
if [ "$(id -u)" -eq 0 ]; then
    echo "ERROR: This script should NOT be run as root"
    exit 1
fi
```

**Why:** Running as root increases security risks. Services should run with limited privileges.

---

### Secret Protection

Scripts never echo or log sensitive values:

```bash
# ❌ BAD - Echoes secret
echo "DATABASE_URL=$DATABASE_URL"

# ✅ GOOD - Protected
log_info "Variable updated (value not shown for security)"
```

**Protected variables:**
- Database credentials
- API keys
- JWT secrets
- Webhook secrets
- Any value containing "password", "secret", "key", or "token"

---

### SSH Key Security

SSH keys are generated with:
- **ED25519** algorithm (more secure than RSA)
- **Proper permissions** (600 for private, 644 for public)
- **No password** (for automation, stored securely)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/mantodeus_deploy_key -N ""
chmod 600 ~/.ssh/mantodeus_deploy_key
```

---

### Webhook Signature Verification

GitHub webhooks are verified using HMAC-SHA256:

```javascript
function verifySignature(payload, signature) {
  const hmac = crypto.createHmac('sha256', CONFIG.secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}
```

**Protection against:**
- Unauthorized deployment triggers
- Replay attacks
- Man-in-the-middle attacks

---

## 💾 Backup System

### Automatic Backups

Backups are automatically created before:
- **Deployments** (`deploy.sh`)
- **Restarts** (`restart.sh`)
- **Environment updates** (`env-update.sh`)

**Backup location:** `backups/backup-YYYYMMDD-HHMMSS.tar.gz`

**Backup contents:**
- Application code
- Built files (`dist/`)
- Configuration files (`.env`)
- **Excludes:** `node_modules`, `.git`, `logs`, `backups`

---

### Backup Rotation

Automatic cleanup keeps only the last 5 backups:

```bash
MAX_BACKUPS=5
ls -1t "$BACKUP_DIR"/backup-*.tar.gz | tail -n +$((MAX_BACKUPS + 1)) | xargs rm -f
```

**Why:** Prevents disk space issues while maintaining recent history.

---

### Manual Backup

Create a manual backup anytime:

```bash
cd /srv/customer/sites/manager.mantodeus.com
tar -czf backups/manual-backup-$(date +%Y%m%d-%H%M%S).tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='logs' \
    --exclude='backups' \
    .
```

---

## 🔄 Rollback Procedures

### Automatic Rollback

The restart script includes automatic rollback:

```bash
./infra/deploy/restart.sh --rollback
```

**What it does:**
1. Stops the application
2. Restores from latest backup
3. Restarts the application
4. Verifies health

**Output:**
```json
{
  "status": "success",
  "action": "rollback",
  "rollback": "success",
  "rollback_from": "backup-20251205-143000.tar.gz"
}
```

---

### Manual Rollback

If automatic rollback fails:

```bash
cd /srv/customer/sites/manager.mantodeus.com

# 1. Stop application
pm2 stop mantodeus-manager

# 2. Find latest backup
ls -lt backups/backup-*.tar.gz | head -1

# 3. Restore backup
tar -xzf backups/backup-YYYYMMDD-HHMMSS.tar.gz

# 4. Restart
pm2 restart mantodeus-manager --update-env
```

---

### Git Rollback

Rollback to a specific commit:

```bash
cd /srv/customer/sites/manager.mantodeus.com

# 1. Find commit to rollback to
git log --oneline -10

# 2. Reset to that commit
git reset --hard <commit-hash>

# 3. Rebuild
npm install --include=dev
npm run build

# 4. Restart
pm2 restart mantodeus-manager --update-env
```

---

## ✅ Health Checks

### Automatic Health Verification

After restart, automatic health checks verify:
- Process is running
- Status is "online"
- No immediate crashes

```bash
# Health check with 3 retries, 5 seconds apart
check_health 3 5
```

**If health check fails:**
- Deployment/restart is marked as failed
- Previous version remains running (if possible)
- Error is logged with details

---

### Manual Health Check

Check application health anytime:

```bash
./infra/deploy/status.sh
```

**Health indicators:**
- `"health": "healthy"` - ✅ All good
- `"health": "degraded"` - ⚠️ Running but issues
- `"health": "stopped"` - ❌ Not running
- `"health": "error"` - ❌ Crashed or errored

---

## 🚫 Input Validation

### Environment Variable Names

Only valid variable names are accepted:

```bash
# Valid: A-Z, 0-9, underscore, must start with A-Z or _
DATABASE_URL=...      # ✅ Valid
VITE_APP_ID=...       # ✅ Valid
my-variable=...       # ❌ Invalid (hyphen)
123_VAR=...           # ❌ Invalid (starts with number)
```

**Validation:**
```bash
if [[ ! "$var_name" =~ ^[A-Z_][A-Z0-9_]*$ ]]; then
    echo "ERROR: Invalid variable name"
    exit 1
fi
```

---

### Git Branch Validation

Webhook only triggers on specified branch:

```javascript
const branch = payload.ref?.replace('refs/heads/', '');
if (branch === CONFIG.deployBranch) {
  executeDeploy(payload);
}
```

**Default:** Only `main` branch triggers deployment.

---

### File Path Validation

All file paths are validated to prevent directory traversal:

```bash
# Ensure we're in the project directory
cd "$PROJECT_DIR" || exit 1

# Use absolute paths
PROJECT_DIR="/srv/customer/sites/manager.mantodeus.com"
```

---

## 🔍 Dry Run Mode

Test deployments without making changes:

```bash
./infra/deploy/deploy.sh --dry-run
```

**What it shows:**
- Commands that would be executed
- Files that would be changed
- Services that would be restarted

**What it doesn't do:**
- Make any actual changes
- Restart services
- Modify files

**Output:**
```json
{
  "status": "success",
  "dry_run": "true",
  "git_pull": "dry-run",
  "build": "dry-run",
  "restart": "dry-run"
}
```

---

## 📝 Logging & Audit Trail

### Deployment Logs

All deployment actions are logged:

```bash
[2025-12-05 14:30:00] INFO: Starting deployment
[2025-12-05 14:30:05] INFO: Backup created: backup-20251205-143000.tar.gz
[2025-12-05 14:30:10] INFO: Git pull: success
[2025-12-05 14:30:45] INFO: Build complete: 2.4M
[2025-12-05 14:30:50] INFO: Restart: success
[2025-12-05 14:30:55] INFO: Health check: healthy
```

---

### JSON Output

All scripts output JSON for audit trails:

```json
{
  "timestamp": "2025-12-05T14:30:00Z",
  "action": "deploy",
  "user": "ubuntu",
  "status": "success",
  "git_before": "a1b2c3d",
  "git_after": "e4f5g6h",
  "duration_seconds": 55
}
```

**Benefits:**
- Programmatic parsing
- Easy monitoring integration
- Complete audit trail
- Debugging information

---

### Webhook Logs

Webhook events are logged in JSON:

```json
{
  "timestamp": "2025-12-05T14:30:00Z",
  "level": "info",
  "message": "Webhook received",
  "event": "push",
  "repository": "mantodeus/mantodeus-manager",
  "branch": "main",
  "commit": "e4f5g6h"
}
```

---

## 🚨 Emergency Procedures

### Application Won't Start

1. **Check status:**
   ```bash
   ./infra/deploy/status.sh
   ```

2. **Check error logs:**
   ```bash
   tail -100 logs/mantodeus-manager-error.log
   ```

3. **Try restart:**
   ```bash
   ./infra/deploy/restart.sh
   ```

4. **If restart fails, rollback:**
   ```bash
   ./infra/deploy/restart.sh --rollback
   ```

---

### Deployment Broke Production

1. **Immediate rollback:**
   ```bash
   ./infra/deploy/restart.sh --rollback
   ```

2. **Verify rollback worked:**
   ```bash
   ./infra/deploy/status.sh
   ```

3. **Check what changed:**
   ```bash
   git log -1
   git diff HEAD~1
   ```

---

### Database Connection Lost

1. **Check environment variables:**
   ```bash
   ./infra/env/env-sync.sh --check-only
   ```

2. **Verify DATABASE_URL:**
   ```bash
   # Don't echo the value!
   grep DATABASE_URL .env | wc -l  # Should be 1
   ```

3. **Test database connection:**
   ```bash
   # From application logs
   tail -50 logs/mantodeus-manager-error.log | grep -i database
   ```

---

### Disk Space Full

1. **Check disk usage:**
   ```bash
   df -h /srv/customer/sites/manager.mantodeus.com
   ```

2. **Clean old logs:**
   ```bash
   find logs/ -name "*.log.*.gz" -mtime +30 -delete
   ```

3. **Clean old backups:**
   ```bash
   ls -lt backups/ | tail -n +6 | awk '{print $9}' | xargs rm -f
   ```

4. **Clean node_modules (if needed):**
   ```bash
   rm -rf node_modules
   npm install --include=dev
   ```

---

## 🔒 Access Control

### SSH Access

- **Key-based authentication only** (no passwords)
- **Dedicated deployment key** (separate from personal keys)
- **Limited to deployment user** (not root)

### File Permissions

```bash
# Scripts: executable by owner, readable by group
chmod 750 infra/deploy/*.sh

# Config files: readable by owner only
chmod 600 .env

# Backups: readable by owner only
chmod 600 backups/*.tar.gz
```

### Webhook Access

- **Secret required** for all webhook requests
- **Signature verification** using HMAC-SHA256
- **IP filtering** (optional, configure in firewall)

---

## 📊 Monitoring & Alerts

### Health Monitoring

Set up monitoring to check:

```bash
# Every 5 minutes
*/5 * * * * /srv/customer/sites/manager.mantodeus.com/infra/deploy/status.sh | jq -r '.health' | grep -q 'healthy' || echo "ALERT: Application unhealthy"
```

### Restart Count Monitoring

Alert on high restart counts:

```bash
RESTART_COUNT=$(./infra/deploy/status.sh | jq -r '.restart_count')
if [ "$RESTART_COUNT" -gt 5 ]; then
  echo "ALERT: High restart count: $RESTART_COUNT"
fi
```

### Disk Space Monitoring

Alert on low disk space:

```bash
DISK_USAGE=$(df -h /srv/customer/sites/manager.mantodeus.com | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
  echo "ALERT: Disk usage at ${DISK_USAGE}%"
fi
```

---

## 📚 Best Practices

1. **Always test in dry-run first:**
   ```bash
   ./infra/deploy/deploy.sh --dry-run
   ```

2. **Check status before and after changes:**
   ```bash
   ./infra/deploy/status.sh
   ```

3. **Keep backups for at least 5 versions**

4. **Monitor restart counts** - high counts indicate issues

5. **Review logs regularly** for warnings and errors

6. **Test rollback procedures** periodically

7. **Document all manual interventions**

8. **Use webhook for automated deployments** (after testing)

9. **Rotate secrets regularly** (webhook, JWT, database)

10. **Keep infrastructure scripts updated** with the repository

---

## 🆘 Support

If you encounter issues not covered here:

1. Check [Infrastructure README](./README.md)
2. Check [Cursor AI Prompts](./cursor-prompts.md)
3. Review application logs
4. Check system logs: `journalctl -u mantodeus-manager`
5. Contact system administrator

---

**Remember:** Safety first! When in doubt, use dry-run mode and create manual backups.
