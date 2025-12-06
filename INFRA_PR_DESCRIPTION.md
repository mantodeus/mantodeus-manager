# Add DevOps Infrastructure for Cursor AI Deployment

## 🎯 Overview

This PR adds a comprehensive DevOps infrastructure that enables **Cursor AI** to deploy, manage, and monitor the Mantodeus Manager application on Infomaniak servers using simple natural-language commands.

## 📦 What's Included

### 1. **Deployment Scripts** (`infra/deploy/`)

Three core deployment scripts with JSON output for programmatic parsing:

- **`deploy.sh`** - Full deployment (pull, build, restart, health check)
  - Automatic backups before deployment
  - Git pull with conflict detection
  - Dependency installation
  - Build verification
  - Log rotation
  - PM2/systemd restart
  - Health verification
  - Dry-run mode support

- **`restart.sh`** - Safe restart with automatic rollback
  - Health checks with retries
  - Automatic rollback on failure
  - Manual rollback support
  - Graceful shutdown

- **`status.sh`** - Comprehensive health check
  - Application status (online/stopped/error)
  - Memory and CPU usage
  - Uptime tracking
  - Restart count
  - Git commit info
  - Recent logs
  - Build information

**Features:**
- ✅ JSON output for all scripts
- ✅ Non-root enforcement
- ✅ Automatic backups (last 5 kept)
- ✅ Health checks with retries
- ✅ Dry-run mode
- ✅ Rollback capability

---

### 2. **SSH Configuration** (`infra/ssh/`)

Complete SSH setup for secure deployment access:

- **`ssh-config.example`** - SSH configuration template
- **`generate-key.sh`** - Generate ED25519 SSH key pair
- **`install-key.sh`** - Install public key on server
- **`ssh-check.sh`** - Test SSH connection with diagnostics

**Features:**
- ✅ ED25519 keys (more secure than RSA)
- ✅ Proper permissions (600/644)
- ✅ Connection diagnostics
- ✅ Server information gathering

---

### 3. **Webhook Automation** (`infra/webhook/`)

GitHub webhook listener for automated deployments:

- **`webhook-listener.js`** - Lightweight Node.js webhook server
  - GitHub signature verification (HMAC-SHA256)
  - Automatic deployment on push to main
  - JSON logging
  - Health check endpoint
  - Graceful shutdown

**Features:**
- ✅ Secure signature verification
- ✅ Branch filtering
- ✅ Non-root execution
- ✅ PM2 compatible

---

### 4. **Environment Management** (`infra/env/`)

Safe environment variable management:

- **`env-sync.sh`** - Sync .env with .env.example
  - Detect missing variables
  - Detect extra variables
  - Validate required variables
  - Check-only mode

- **`env-update.sh`** - Update environment variables safely
  - Automatic backups
  - Variable name validation
  - No secret echoing
  - Batch updates from file

**Features:**
- ✅ Never echoes secrets
- ✅ Automatic backups
- ✅ Input validation
- ✅ Restart reminder

---

### 5. **Documentation** (`infra/`)

Comprehensive documentation for humans and AI:

- **`README.md`** - Complete infrastructure guide
  - Quick start
  - Common commands
  - Security features
  - Troubleshooting
  - Best practices

- **`cursor-prompts.md`** - Natural-language prompts for Cursor AI
  - 30+ ready-to-use prompts
  - Deployment commands
  - Status checks
  - Emergency procedures
  - Monitoring examples

- **`SAFEGUARDS.md`** - Safety features and rollback procedures
  - Security safeguards
  - Backup system
  - Rollback procedures
  - Emergency procedures
  - Best practices

---

### 6. **Testing** (`infra/tests/`)

Automated testing and verification:

- **`run-deploy-sim.sh`** - Deployment simulation
  - Local tests (15+ checks)
  - Remote tests (optional)
  - Dry-run simulation
  - Syntax validation

---

## 🚀 How to Use

### Initial Setup

```bash
# 1. Generate SSH key
cd infra/ssh
./generate-key.sh your-email@example.com

# 2. Install key on server
./install-key.sh username@your-server.infomaniak.com

# 3. Configure SSH
cp ssh-config.example ~/.ssh/config
# Edit ~/.ssh/config with your server details

# 4. Test connection
./ssh-check.sh mantodeus-server
```

### Deploy Application

```bash
# From local machine
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/deploy.sh"

# Or use Cursor AI with natural language:
# "Deploy the Mantodeus Manager application to production"
```

### Check Status

```bash
# Get application status
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/status.sh"

# Or use Cursor AI:
# "What's the current status of the application?"
```

### Restart Application

```bash
# Safe restart with health check
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh"

# Or use Cursor AI:
# "Restart the application safely"
```

### Rollback

```bash
# Rollback to previous version
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh --rollback"

# Or use Cursor AI:
# "The application is broken. Roll back to the previous version."
```

---

## 🤖 Cursor AI Integration

This infrastructure is designed for **Cursor AI** to manage deployments using natural-language commands.

### Example Prompts

**Deploy:**
```
Deploy the Mantodeus Manager application to production.
```

**Check Status:**
```
What's the current status of the application?
```

**Restart:**
```
Restart the application with health checks.
```

**Rollback:**
```
The deployment broke production. Rollback immediately.
```

**Check Logs:**
```
Show me the last 50 lines of error logs.
```

**Update Environment:**
```
Update the DATABASE_URL environment variable and restart the app.
```

See `infra/cursor-prompts.md` for 30+ more examples.

---

## 🛡️ Security Features

### Non-Root Enforcement
All scripts refuse to run as root for security.

### Secret Protection
Scripts never echo or log sensitive values.

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

### Input Validation
- Environment variable names validated
- Git branch filtering
- File path validation

---

## 📊 JSON Output

All scripts output JSON for programmatic parsing:

```json
{
  "status": "success",
  "timestamp": "2025-12-05T14:30:00Z",
  "git_pull": "success",
  "build": "success",
  "restart": "success",
  "health": "healthy",
  "duration_seconds": 45
}
```

**Benefits:**
- Easy monitoring integration
- Complete audit trail
- Programmatic parsing
- Cursor AI can interpret results

---

## 🔄 Automated Deployment (Webhook)

### Setup GitHub Webhook

1. **Generate secret:**
   ```bash
   openssl rand -hex 32
   ```

2. **Add to server .env:**
   ```bash
   WEBHOOK_SECRET=your_generated_secret
   WEBHOOK_PORT=9000
   ```

3. **Start webhook listener:**
   ```bash
   pm2 start infra/webhook/webhook-listener.js --name webhook-listener
   pm2 save
   ```

4. **Configure GitHub:**
   - Repository Settings → Webhooks
   - Add webhook: `https://your-server.com:9000/webhook`
   - Content type: `application/json`
   - Secret: (your generated secret)
   - Events: `push`

---

## 🧪 Testing

### Run Tests

```bash
# Local tests only
./infra/tests/run-deploy-sim.sh

# Include remote tests
./infra/tests/run-deploy-sim.sh --remote
```

### Dry-Run Deployment

```bash
# Test deployment without making changes
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/deploy.sh --dry-run"
```

---

## 📁 File Structure

```
infra/
├── README.md                    # Main documentation
├── cursor-prompts.md            # Cursor AI prompts
├── SAFEGUARDS.md                # Safety features
├── deploy/
│   ├── deploy.sh                # Main deployment
│   ├── restart.sh               # Safe restart
│   └── status.sh                # Health check
├── ssh/
│   ├── ssh-config.example       # SSH config template
│   ├── generate-key.sh          # Generate SSH key
│   ├── install-key.sh           # Install key on server
│   └── ssh-check.sh             # Test SSH connection
├── webhook/
│   └── webhook-listener.js      # GitHub webhook server
├── env/
│   ├── env-sync.sh              # Sync environment vars
│   └── env-update.sh            # Update environment vars
└── tests/
    └── run-deploy-sim.sh        # Deployment simulation
```

---

## ✅ Checklist for Reviewers

- [ ] All scripts have proper permissions (755 for executables)
- [ ] Documentation is comprehensive and clear
- [ ] Security features are properly implemented
- [ ] JSON output is consistent across scripts
- [ ] Cursor AI prompts are practical and useful
- [ ] No secrets or credentials in code
- [ ] Backup and rollback procedures are tested
- [ ] SSH configuration is secure

---

## 🚨 Manual Steps Required After Merge

### 1. Generate SSH Key (Local)
```bash
cd infra/ssh
./generate-key.sh your-email@example.com
```

### 2. Install SSH Key on Server
```bash
./install-key.sh username@your-server.infomaniak.com
```

### 3. Configure SSH (Local)
```bash
cp infra/ssh/ssh-config.example ~/.ssh/config
# Edit ~/.ssh/config with your server details
```

### 4. Test SSH Connection
```bash
./infra/ssh/ssh-check.sh mantodeus-server
```

### 5. (Optional) Setup Webhook
```bash
# On server
cd /srv/customer/sites/manager.mantodeus.com
pm2 start infra/webhook/webhook-listener.js --name webhook-listener
pm2 save

# In GitHub repository settings
# Add webhook with secret
```

---

## 📚 Documentation

- [Infrastructure README](./infra/README.md) - Complete guide
- [Cursor AI Prompts](./infra/cursor-prompts.md) - 30+ ready-to-use prompts
- [Safeguards](./infra/SAFEGUARDS.md) - Safety features and procedures

---

## 🎉 Benefits

### For Developers
- ✅ Simple deployment commands
- ✅ Automatic backups
- ✅ Easy rollback
- ✅ Comprehensive logging

### For Cursor AI
- ✅ Natural-language commands
- ✅ JSON output for parsing
- ✅ Clear error messages
- ✅ Consistent interface

### For Operations
- ✅ Automated deployments
- ✅ Health monitoring
- ✅ Audit trail
- ✅ Security safeguards

---

## 🔮 Future Enhancements

- [ ] Slack/Discord notifications
- [ ] Prometheus metrics export
- [ ] Blue-green deployments
- [ ] Canary deployments
- [ ] Database migration automation
- [ ] Performance monitoring

---

## 🆘 Support

Questions or issues? Check:
1. [Infrastructure README](./infra/README.md)
2. [Cursor AI Prompts](./infra/cursor-prompts.md)
3. [Safeguards Documentation](./infra/SAFEGUARDS.md)

---

**Ready to merge!** 🚀

This infrastructure provides a solid foundation for automated deployments and enables Cursor AI to manage the application with simple natural-language commands.
