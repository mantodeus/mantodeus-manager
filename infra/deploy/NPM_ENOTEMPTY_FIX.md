# Fixing npm ENOTEMPTY Errors

## Problem
When running `npm install` or `pnpm install`, you may encounter:
```
npm error code ENOTEMPTY
npm error syscall rename
npm error path /path/to/node_modules/package-name
npm error dest /path/to/node_modules/.package-name-XXXXX
npm error errno -39
npm error ENOTEMPTY: directory not empty
```

## Root Causes
1. **File locks**: Running Node processes holding file locks
2. **Incomplete previous install**: Interrupted installation left inconsistent state
3. **Conflicting lock files**: Both `package-lock.json` and `pnpm-lock.yaml` exist (this project uses pnpm)
4. **Shared hosting limitations**: File system restrictions on shared hosting
5. **Permission issues**: Insufficient permissions to rename/delete directories
6. **Disk space**: Insufficient space for npm operations
7. **Wrong package manager**: Using `npm install` when project uses `pnpm`

## Quick Fix

### Option 1: Use the Fix Script (Recommended)
```bash
cd /srv/customer/sites/manager.mantodeus.com
bash infra/deploy/fix-npm-enotempty.sh
```

### Option 2: Manual Fix
```bash
# 1. Stop any running processes
pm2 stop all

# 2. Remove conflicting lock file (if using pnpm)
# This project uses pnpm, so remove package-lock.json if it exists
rm -f package-lock.json

# 3. Remove node_modules
rm -rf node_modules

# 4. Clean cache
pnpm store prune  # This project uses pnpm, not npm

# 5. Reinstall with correct package manager
pnpm install --frozen-lockfile
```

**Important**: This project uses **pnpm**, not npm. Always use `pnpm install`, not `npm install`.

### Option 3: Aggressive Cleanup
If standard removal fails:
```bash
# Remove files first, then directories
find node_modules -type f -delete
find node_modules -type d -exec rmdir {} +
rm -rf node_modules

# Then reinstall
pnpm install --frozen-lockfile
```

## Prevention

The updated `deploy.sh` script now:
- ✅ Cleans `node_modules` before installation
- ✅ Handles ENOTEMPTY errors gracefully
- ✅ Performs deep cleanup on failure
- ✅ Clears package manager cache

## Troubleshooting

### If node_modules won't delete:
```bash
# Check for locked files
lsof | grep node_modules

# Check permissions
ls -la | grep node_modules

# Try with chmod
chmod -R u+w node_modules
rm -rf node_modules
```

### If installation still fails:
1. **Check disk space:**
   ```bash
   df -h .
   ```

2. **Check for file locks:**
   ```bash
   lsof | grep node_modules
   ```

3. **Verify package manager:**
   ```bash
   # Use pnpm if pnpm-lock.yaml exists
   # Use npm if package-lock.json exists
   ```

4. **Try alternative installation:**
   ```bash
   # For pnpm
   pnpm install --no-frozen-lockfile
   
   # For npm
   npm install --no-package-lock
   ```

## Notes for Shared Hosting

On shared hosting (like Infomaniak):
- File operations may be slower
- Some directories may have restricted permissions
- Use `pnpm` via `npx` if global install isn't available
- The deploy script handles these limitations automatically

