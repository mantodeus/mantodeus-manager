# SSH Connection Error - Investigation & Fix

## Investigation Summary

### ✅ Local Environment (Windows)
- **Git Remote**: Uses HTTPS (`https://github.com/mantodeus/mantodeus-manager.git`)
- **Package Dependencies**: All use npm registry (no git dependencies)
- **npm Registry**: Standard `https://registry.npmjs.org/`
- **No .npmrc files**: No custom npm configuration found
- **Postinstall Script**: Only runs puppeteer browser installation (no git operations)

### 🔍 Root Cause
The SSH connection error is **NOT** caused by:
- ❌ Git dependencies in package.json (none found)
- ❌ npm registry configuration (standard registry in use)
- ❌ Local git configuration (using HTTPS)

The error is likely occurring **on the server** during deployment when:
1. The server's git remote might be configured to use SSH instead of HTTPS
2. The deploy script runs `git fetch origin` which fails if SSH keys aren't configured
3. Network/firewall issues preventing SSH connections to GitHub

## Fixes Applied

### 1. Enhanced Deploy Script (`infra/deploy/deploy.sh`)
- ✅ **Auto-detects SSH remotes** and converts them to HTTPS
- ✅ **Better error handling** for git fetch operations
- ✅ **Network connectivity checks** before failing
- ✅ **Verbose error messages** for troubleshooting

### 2. Diagnostic Script (`infra/deploy/check-git-remote.sh`)
- ✅ Checks current git remote configuration
- ✅ Detects SSH-based remotes
- ✅ Optionally converts SSH remotes to HTTPS
- ✅ Tests git fetch connectivity

## How to Fix on Server

### Option 1: Run the Diagnostic Script (Recommended)
```bash
cd /srv/customer/sites/manager.mantodeus.com
bash infra/deploy/check-git-remote.sh
```

### Option 2: Manually Fix Git Remote
```bash
cd /srv/customer/sites/manager.mantodeus.com
git remote -v  # Check current remote
git remote set-url origin https://github.com/mantodeus/mantodeus-manager.git
git remote -v  # Verify change
```

### Option 3: Use Updated Deploy Script
The updated deploy script will automatically fix SSH remotes on each deployment:
```bash
cd /srv/customer/sites/manager.mantodeus.com
bash infra/deploy/deploy.sh
```

## Verification

After fixing, verify git connectivity:
```bash
# Test git fetch
git fetch origin --dry-run

# Test full fetch
git fetch origin

# Check remote URL
git remote -v
```

## Additional Troubleshooting

If issues persist after switching to HTTPS:

1. **Check network connectivity:**
   ```bash
   ping github.com
   curl -I https://github.com
   ```

2. **Check git credentials:**
   ```bash
   git config --list | grep credential
   ```

3. **Test with verbose output:**
   ```bash
   GIT_TRACE=1 git fetch origin
   ```

4. **Check firewall/proxy settings:**
   - Ensure port 443 (HTTPS) is open
   - Check if proxy configuration is needed

## Prevention

The updated deploy script now:
- Automatically converts SSH remotes to HTTPS
- Provides clear error messages
- Checks network connectivity before failing

This should prevent SSH connection errors in future deployments.

