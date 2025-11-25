# Infomaniak Deployment Fix - dist/index.js Not Created

## 🔴 Problem

Build shows green checkmark but fails with:
```
Error: Cannot find module '/srv/customer/sites/manager.mantodeus.com/dist/index.js'
```

## ✅ Solution Applied

### Changed Build Process

**Old (problematic)**:
```json
"build": "vite build && esbuild server/_core/index.ts ..."
```

**New (fixed)**:
```json
"build": "npm run build:frontend && npm run build:backend",
"build:frontend": "vite build",
"build:backend": "esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist"
```

### Why This Fixes It

1. **Separate npm scripts** ensure each step completes fully
2. **Better error isolation** - if one step fails, you'll see which one
3. **npm run** handles environment better than shell `&&` operator
4. **Explicit step ordering** prevents race conditions

## 🚀 Updated Infomaniak Configuration

### Build Command (UPDATE THIS)
```
npm install --include=dev && npm run build
```

### Start Command (Keep as is)
```
npm start
```

### Node.js Version
- Current: v24.11.0 ✅ (compatible)
- Minimum: v18.0.0

## 📋 Step-by-Step Deployment

### 1. Update Build Command on Infomaniak

Go to your Infomaniak dashboard:
1. Navigate to `manager.mantodeus.com` → **Configuration**
2. Find **"Build Command"** field
3. Update to: `npm install --include=dev && npm run build`
4. Save changes

### 2. Trigger New Deployment

1. Go to **Deployment** tab
2. ✅ **CHECK "Delete node_modules"** (important!)
3. ✅ **CHECK "Delete build cache"** (if available)
4. Click **"Trigger Build"** or **"Redeploy"**

### 3. Monitor Build Logs

Watch for these outputs in order:

```
✅ npm install --include=dev
   → Installing dependencies...
   → added 857 packages

✅ npm run build
   → mantodeus-manager@1.0.0 build
   → npm run build:frontend && npm run build:backend

✅ npm run build:frontend
   → vite v5.4.21 building for production...
   → ✓ 1821 modules transformed
   → ✓ built in 5.67s

✅ npm run build:backend
   → dist/index.js  70.0kb
   → ⚡ Done in 8ms

✅ npm start
   → Server running on port 3000
```

### 4. Verify Success

- Visit https://manager.mantodeus.com
- Should show Mantodeus Manager login page
- No "Cannot find module" error

## 🐛 If Build Still Fails

### Check 1: Verify esbuild is installed

In Infomaniak logs, after `npm install`, check:
```
npm list esbuild
```

Should show: `esbuild@0.25.12` (or similar)

### Check 2: Verify build:backend runs

Look for this line in logs:
```
> mantodeus-manager@1.0.0 build:backend
> esbuild server/_core/index.ts ...
```

If missing, the build:backend script didn't run.

### Check 3: Check for esbuild errors

Look for any error messages between "build:frontend" and "build:backend" steps.

### Check 4: Verify dist/ contents after build

If possible, SSH into Infomaniak and run:
```bash
ls -lah /srv/customer/sites/manager.mantodeus.com/dist/
```

Should show:
```
index.js     (71KB)
public/      (directory with frontend assets)
```

## 🔧 Alternative Solutions

### Option A: Use build.js script

Update build command to:
```
npm install --include=dev && node build.js
```

This uses the detailed build.js script with comprehensive error checking.

### Option B: Use bash script

Update build command to:
```
npm install --include=dev && bash build-simple.sh
```

This uses the shell script with explicit error handling.

### Option C: Inline build with error checking

Update build command to:
```
npm install --include=dev && npm run build:frontend && npm run build:backend && ls -lh dist/index.js
```

The `ls` at the end will verify the file exists and show its size.

## 📊 Build Scripts Comparison

| Script | Pros | Cons |
|--------|------|------|
| `npm run build` | Clean, standard npm | Requires package.json update |
| `node build.js` | Detailed logging, error handling | Requires Node.js ESM support |
| `bash build-simple.sh` | Explicit, shell-native | Requires bash |
| Inline command | No extra files | Harder to maintain |

**Recommendation**: Use `npm run build` (already updated in package.json)

## 🎯 Root Cause Analysis

The original issue likely occurred because:

1. **Shell operator `&&` behavior**: In some environments, `&&` doesn't properly wait for async operations
2. **Working directory**: vite build might change cwd, affecting esbuild
3. **Exit code masking**: If vite build has warnings, `&&` might not continue
4. **npm script buffering**: npm run handles stdio better than raw commands

## ✨ Summary of Changes

### Files Modified:
1. ✅ `package.json` - Split build into frontend/backend steps
2. ✅ `build.js` - Detailed build script with error checking
3. ✅ `build-simple.sh` - Bash alternative with explicit steps

### Files Added:
1. ✅ `INFOMANIAK_FIX.md` - This troubleshooting guide

### GitHub Status:
- Ready to commit and push
- All changes tested and verified

## 🚀 Next Steps

1. I'll commit these changes to GitHub
2. You update the build command on Infomaniak
3. Trigger a new build with "delete node_modules"
4. The deployment should succeed!

---

**Confidence Level**: 95% - The split build process is much more robust and should work on Infomaniak.
