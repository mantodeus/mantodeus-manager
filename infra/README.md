# Mantodeus Manager - DevOps Infrastructure

Complete DevOps infrastructure for deploying and managing Mantodeus Manager on Infomaniak hosting using Cursor AI.

## 🚀 Quick Start

### 1. Generate SSH Key (Local Machine)

```bash
cd infra/ssh
./generate-key.sh mckay@mantodeus.com
```

This creates:
- `~/.ssh/mantodeus_deploy_key` (private key)
- `~/.ssh/mantodeus_deploy_key.pub` (public key)

### 2. Install SSH Key on Server

```bash
./install-key.sh M4S5mQQMRhu_mantodeus@57-105224.ssh.hosting-ik.com
```

### 3. Configure SSH (Local Machine)

```bash
cp infra/ssh/ssh-config.example ~/.ssh/config
chmod 600 ~/.ssh/config
```

The config is already configured with:
- **Host**: `mantodeus-server`
- **HostName**: `57-105224.ssh.hosting-ik.com`
- **User**: `M4S5mQQMRhu_mantodeus`
- **Port**: `22`

### 4. Test SSH Connection

```bash
./infra/ssh/ssh-check.sh mantodeus-server
```

Expected output:
```json
{
  "connection_status": "success",
  "connection_time_seconds": "2",
  "project_dir_exists": "true",
  "infra_scripts_exist": "true"
}
```

### 5. Deploy Application

```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/deploy.sh"
```

---

## 📁 Directory Structure

```
infra/
├── README.md                    # This file
├── cursor-prompts.md            # Cursor AI natural-language prompts
├── SAFEGUARDS.md                # Safety features and procedures
├── deploy/
│   ├── deploy.sh                # Main deployment script
│   ├── restart.sh               # Safe restart with rollback
│   └── status.sh                # Health check and status
├── ssh/
│   ├── ssh-config.example       # SSH configuration template
│   ├── generate-key.sh         # Generate SSH key pair
│   ├── install-key.sh           # Install key on server
│   └── ssh-check.sh             # Test SSH connection
├── webhook/
│   └── webhook-listener.js      # GitHub webhook server
├── env/
│   ├── env-sync.sh              # Sync .env with .env.example
│   └── env-update.sh            # Update environment variables
└── tests/
    └── run-deploy-sim.sh        # Deployment simulation tests
```

---

## 🔧 Common Commands

### Deployment

```bash
# Full deployment (backup, build, restart, health check)
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/deploy.sh"

# Dry-run (test without deploying)
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/deploy.sh --dry-run"

# Deploy without backup
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/deploy.sh --no-backup"

# Deploy without health check
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/deploy.sh --skip-health-check"
```

### Restart

```bash
# Safe restart (creates backup automatically)
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh"

# Rollback to latest backup
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh --rollback"

# Rollback to specific backup
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh --backup-file=backup-20251205-143000.tar.gz"
```

### Status Check

```bash
# Check application status
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/status.sh"
```

Output includes:
- PM2 status
- Health check result
- Uptime
- Memory usage
- CPU usage
- Git commit and branch
- Uncommitted changes

### Environment Variables

```bash
# Sync .env with .env.example
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/env/env-sync.sh"

# Update a variable
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/env/env-update.sh DATABASE_URL 'mysql://user:pass@host/db'"
```

---

## 🤖 Using with Cursor AI

See `cursor-prompts.md` for 30+ natural-language prompts you can use with Cursor AI.

**Example:**
```
Deploy the Mantodeus Manager application to production.
```

Cursor AI will execute:
```bash
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/deploy.sh"
```

---

## 🔐 Security Features

### Non-Root Enforcement
All scripts refuse to run as root:
```bash
if [ "$(id -u)" -eq 0 ]; then
    echo "ERROR: This script should NOT be run as root"
    exit 1
fi
```

### Secret Protection
Scripts never echo or log sensitive values:
- Database credentials
- API keys
- JWT secrets
- Webhook secrets

### SSH Key Security
- ED25519 algorithm (more secure than RSA)
- Proper permissions (600 for private, 644 for public)
- Key-based authentication only

### Webhook Security
- GitHub signature verification (HMAC-SHA256)
- Timing-safe comparison
- Secret validation required

### Automatic Backups
- Created before all deployments
- Last 5 backups retained
- Automatic rotation

---

## 📊 Script Output Format

All scripts output JSON for programmatic parsing:

### deploy.sh Output
```json
{
  "status": "success",
  "git_pull": "success",
  "build": "success",
  "restart": "success",
  "health": "healthy"
}
```

### status.sh Output
```json
{
  "status": "online",
  "pm2_status": "online",
  "health": "healthy",
  "uptime_seconds": 172800,
  "uptime_human": "2d 0h 0m",
  "memory_mb": "245.67",
  "cpu_percent": "1.2",
  "restarts": 0,
  "git_commit": "a1b2c3d",
  "git_branch": "main",
  "git_uncommitted_changes": 0
}
```

### restart.sh Output
```json
{
  "status": "success",
  "action": "restart",
  "restart": "success",
  "health": "healthy",
  "backup_file": "backup-20251205-143000.tar.gz"
}
```

---

## 🔄 Automated Deployment (Webhook)

### Setup on Server

```bash
# 1. Generate webhook secret
openssl rand -hex 32

# 2. Add to .env
echo "WEBHOOK_SECRET=your_generated_secret" >> .env
echo "WEBHOOK_PORT=9000" >> .env

# 3. Start webhook listener
pm2 start infra/webhook/webhook-listener.js --name webhook-listener
pm2 save
```

### Setup on GitHub

1. Go to Repository Settings → Webhooks
2. Click "Add webhook"
3. **Payload URL**: `https://manager.mantodeus.com:9000/webhook`
4. **Content type**: `application/json`
5. **Secret**: (paste your generated secret)
6. **Events**: Select "Just the push event"
7. Click "Add webhook"

Now every push to `main` will automatically deploy!

---

## 🛡️ Safety Features

See `SAFEGUARDS.md` for detailed information about:
- Backup system
- Rollback procedures
- Emergency procedures
- Best practices

---

## 🧪 Testing

Run deployment simulation tests:

```bash
./infra/tests/run-deploy-sim.sh
```

Tests include:
- Script existence
- Script permissions
- Syntax validation
- Required commands
- Project directory checks
- Dry-run tests

---

## 📝 Configuration

### Server Configuration

- **Project Directory**: `/srv/customer/sites/manager.mantodeus.com`
- **PM2 App Name**: `mantodeus-manager`
- **Application Port**: `3000`
- **Health Check Endpoint**: `http://localhost:3000/api/trpc/system.health`

### SSH Configuration

- **Host**: `mantodeus-server`
- **HostName**: `57-105224.ssh.hosting-ik.com`
- **User**: `M4S5mQQMRhu_mantodeus`
- **Port**: `22`
- **Key**: `~/.ssh/mantodeus_deploy_key`

---

## 🐛 Troubleshooting

### SSH Connection Failed

```bash
# Test connection
./infra/ssh/ssh-check.sh mantodeus-server

# Check SSH config
cat ~/.ssh/config

# Test direct connection
ssh M4S5mQQMRhu_mantodeus@57-105224.ssh.hosting-ik.com
```

### Deployment Failed

```bash
# Check logs
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && pm2 logs mantodeus-manager --lines 50"

# Check status
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/status.sh"

# Rollback
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh --rollback"
```

### Health Check Failed

```bash
# Check if application is running
ssh mantodeus-server "pm2 status mantodeus-manager"

# Check application logs
ssh mantodeus-server "pm2 logs mantodeus-manager --lines 100"

# Manual health check
ssh mantodeus-server "curl http://localhost:3000/api/trpc/system.health?input=%7B%22timestamp%22%3A$(date +%s)%7D"
```

### Webhook Not Working

```bash
# Check webhook listener status
ssh mantodeus-server "pm2 status webhook-listener"

# Check webhook logs
ssh mantodeus-server "cat /srv/customer/sites/manager.mantodeus.com/logs/webhook.log | tail -20"

# Test webhook manually
curl -X POST https://manager.mantodeus.com:9000/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: ping" \
  -d '{}'
```

---

## 📚 Additional Documentation

- **[cursor-prompts.md](./cursor-prompts.md)** - Natural-language prompts for Cursor AI
- **[SAFEGUARDS.md](./SAFEGUARDS.md)** - Safety features and emergency procedures

---

## ✅ Checklist

After merging this infrastructure:

- [ ] Generate SSH key: `./infra/ssh/generate-key.sh mckay@mantodeus.com`
- [ ] Install SSH key: `./infra/ssh/install-key.sh M4S5mQQMRhu_mantodeus@57-105224.ssh.hosting-ik.com`
- [ ] Configure SSH: `cp infra/ssh/ssh-config.example ~/.ssh/config`
- [ ] Test connection: `./infra/ssh/ssh-check.sh mantodeus-server`
- [ ] Copy scripts to server: `scp -r infra mantodeus-server:/srv/customer/sites/manager.mantodeus.com/`
- [ ] Test deployment: `ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/deploy.sh --dry-run"`
- [ ] (Optional) Setup webhook for automated deployments

---

## 🎉 Success!

Your DevOps infrastructure is ready! You can now:

- ✅ Deploy with one command
- ✅ Monitor application status
- ✅ Rollback on failures
- ✅ Use Cursor AI for natural-language deployments
- ✅ Automate deployments with GitHub webhooks

**Happy deploying!** 🚀
