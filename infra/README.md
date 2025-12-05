# Mantodeus Manager - Infrastructure & DevOps

This directory contains all infrastructure scripts and configuration for deploying and managing the Mantodeus Manager application on Infomaniak servers.

## 📁 Directory Structure

```
infra/
├── deploy/          # Deployment scripts
│   ├── deploy.sh    # Main deployment script
│   ├── restart.sh   # Safe restart with rollback
│   └── status.sh    # Health check and status
├── ssh/             # SSH configuration and key management
│   ├── ssh-config.example    # SSH config template
│   ├── generate-key.sh       # Generate SSH key pair
│   ├── install-key.sh        # Install key on server
│   └── ssh-check.sh          # Test SSH connection
├── webhook/         # GitHub webhook automation
│   └── webhook-listener.js   # Webhook server
├── env/             # Environment variable management
│   ├── env-sync.sh   # Sync .env with .env.example
│   └── env-update.sh # Update environment variables
├── tests/           # Testing and verification
│   └── run-deploy-sim.sh # Deployment simulation
└── README.md        # This file
```

## 🚀 Quick Start

### 1. Setup SSH Access

```bash
# Generate SSH key
cd infra/ssh
./generate-key.sh your-email@example.com

# Install key on server
./install-key.sh username@your-server.infomaniak.com

# Test connection
./ssh-check.sh mantodeus-server
```

### 2. Configure SSH Config

```bash
# Copy example config
cp infra/ssh/ssh-config.example ~/.ssh/config

# Edit with your details
nano ~/.ssh/config
```

### 3. Deploy Application

```bash
# From your local machine
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/deploy.sh"

# Or directly on server
cd /srv/customer/sites/manager.mantodeus.com
./infra/deploy/deploy.sh
```

## 📝 Common Commands

### Deployment

```bash
# Full deployment (pull, build, restart)
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/deploy.sh"

# Dry run (see what would happen)
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/deploy.sh --dry-run"

# Deploy without restart
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/deploy.sh --skip-restart"
```

### Restart

```bash
# Safe restart with health check
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh"

# Rollback to previous version
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh --rollback"

# Force restart without health check
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/restart.sh --force"
```

### Status & Health

```bash
# Get full status (JSON output)
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/status.sh"

# Get status with more logs
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/status.sh --logs 100"

# Pretty print with jq
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/status.sh" | jq '.'
```

### Environment Variables

```bash
# Sync .env with .env.example
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/env/env-sync.sh"

# Check only (don't modify)
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/env/env-sync.sh --check-only"

# Update a variable
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/env/env-update.sh DATABASE_URL 'mysql://...'"
```

### Logs

```bash
# View output logs
ssh mantodeus-server "tail -f /srv/customer/sites/manager.mantodeus.com/logs/mantodeus-manager-out.log"

# View error logs
ssh mantodeus-server "tail -f /srv/customer/sites/manager.mantodeus.com/logs/mantodeus-manager-error.log"

# View last 100 lines
ssh mantodeus-server "tail -100 /srv/customer/sites/manager.mantodeus.com/logs/mantodeus-manager-out.log"
```

## 🔐 Security Features

### Non-Root Execution
All scripts enforce non-root execution for security.

### Secret Protection
- Scripts never echo sensitive values
- Environment variables are handled securely
- Backups are created before modifications

### SSH Key Security
- ED25519 keys (more secure than RSA)
- Key-based authentication only
- Proper file permissions (600 for private keys)

### Webhook Security
- GitHub signature verification (HMAC-SHA256)
- Timing-safe comparison
- Secret validation required

## 🔄 Automated Deployment (Webhook)

### Setup GitHub Webhook

1. **Generate webhook secret:**
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
   cd /srv/customer/sites/manager.mantodeus.com
   pm2 start infra/webhook/webhook-listener.js --name webhook-listener
   pm2 save
   ```

4. **Configure GitHub:**
   - Go to repository Settings → Webhooks
   - Add webhook: `https://your-server.com:9000/webhook`
   - Content type: `application/json`
   - Secret: (your generated secret)
   - Events: `push`

### Test Webhook

```bash
# Health check
curl https://your-server.com:9000/health

# View webhook logs
pm2 logs webhook-listener
```

## 📊 JSON Output

All deployment scripts output JSON for programmatic parsing:

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

### Parse with jq

```bash
# Get status
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/status.sh" | jq '.status'

# Get memory usage
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/status.sh" | jq '.memory_mb'

# Check if healthy
ssh mantodeus-server "cd /srv/customer/sites/manager.mantodeus.com && ./infra/deploy/status.sh" | jq -r '.health'
```

## 🧪 Testing

### Deployment Simulation

```bash
# Run deployment simulation (no actual changes)
cd infra/tests
./run-deploy-sim.sh
```

### SSH Connection Test

```bash
# Test SSH connection
cd infra/ssh
./ssh-check.sh mantodeus-server
```

## 🔧 Troubleshooting

### Deployment Fails

```bash
# Check status
./infra/deploy/status.sh

# View logs
tail -100 logs/mantodeus-manager-error.log

# Rollback
./infra/deploy/restart.sh --rollback
```

### SSH Connection Issues

```bash
# Test connection with diagnostics
./infra/ssh/ssh-check.sh mantodeus-server

# Check SSH key
ls -la ~/.ssh/mantodeus_deploy_key*

# Test with verbose output
ssh -v mantodeus-server
```

### Environment Variable Issues

```bash
# Check sync status
./infra/env/env-sync.sh --check-only

# Sync variables
./infra/env/env-sync.sh
```

## 📚 Additional Documentation

- [Cursor AI Prompts](./cursor-prompts.md) - Natural language commands for Cursor AI
- [Delete Safeguards](../DELETE_SAFEGUARDS.md) - Safety features and rollback procedures
- [Deployment Guide](../DEPLOYMENT.md) - Full deployment documentation

## 🆘 Support

If you encounter issues:

1. Check logs: `./infra/deploy/status.sh`
2. Test SSH: `./infra/ssh/ssh-check.sh`
3. Run diagnostics: `./infra/tests/run-deploy-sim.sh`
4. Review documentation in this directory

## 🔄 Maintenance

### Update Scripts

Scripts are version-controlled in the repository. To update:

```bash
git pull origin main
# Scripts are automatically updated
```

### Backup Management

Backups are automatically created and rotated:
- Location: `backups/`
- Retention: Last 5 backups
- Created before: deployments, restarts, env updates

### Log Rotation

Logs are automatically rotated:
- Trigger: Files > 10MB
- Compression: gzip
- Retention: 30 days

## 📝 License

Part of Mantodeus Manager project.
