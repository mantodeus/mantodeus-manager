# Debug Infomaniak Build - Comprehensive Logging Enabled

## 🔍 What Changed

I've added a **comprehensive debug build script** (`build-debug.js`) that logs every step of the build process with extensive error checking.

### New Build Command

The `npm run build` command now uses `build-debug.js` which will show:

- ✅ Node.js version and platform info
- ✅ Pre-build file checks (source files, dependencies)
- ✅ Each build step with clear markers
- ✅ esbuild version and availability
- ✅ Input file verification
- ✅ Output file verification
- ✅ File sizes and contents
- ✅ Detailed error messages if anything fails

## 🚀 Deploy with Debug Logging

### Step 1: Trigger New Build on Infomaniak

1. Go to Infomaniak dashboard → `manager.mantodeus.com`
2. **Deployment** tab
3. ✅ CHECK "Delete node_modules"
4. ✅ CHECK "Delete build cache"
5. Click **"Trigger Build"**

### Step 2: Analyze the Build Logs

The build logs will now show detailed output. Look for these sections:

#### Section 1: Pre-build Checks
```
🔍 STEP 0: Pre-build checks
────────────────────────────────────────────────────────────────────────────────
📦 Node.js version: v24.11.0
📦 Platform: linux
📦 Working directory: /srv/customer/sites/manager.mantodeus.com

🔍 Checking source files...
✅ file exists: server/_core/index.ts (2.21 KB)
✅ directory exists: server/_core
✅ directory exists: client/src
✅ file exists: package.json
✅ file exists: vite.config.ts

🔍 Checking critical dependencies...
✅ directory exists: node_modules/vite
✅ directory exists: node_modules/esbuild
✅ file exists: node_modules/esbuild/bin/esbuild
```

**What to check:**
- ✅ All source files should exist
- ✅ node_modules/esbuild should exist
- ❌ If any file is missing, that's the problem

#### Section 2: Frontend Build
```
⚛️  STEP 2: Build frontend with Vite
────────────────────────────────────────────────────────────────────────────────
vite v5.4.21 building for production...
✓ 1821 modules transformed
✓ built in 5.67s
✅ Frontend build (Vite) - SUCCESS

🔍 Verifying frontend build output...
✅ directory exists: dist/public
```

**What to check:**
- ✅ Should see "Frontend build (Vite) - SUCCESS"
- ✅ Should see "dist/public" exists
- ❌ If frontend fails, vite has an error (check above this section)

#### Section 3: Backend Build (CRITICAL)
```
🔧 STEP 3: Build backend with esbuild
────────────────────────────────────────────────────────────────────────────────
🔍 Checking esbuild availability...
✅ esbuild version: 0.25.12

🔍 Verifying input file before esbuild...
✅ file exists: server/_core/index.ts (2.21 KB)

🔧 Running esbuild...
────────────────────────────────────────────────────────────────────────────────
📌 Backend build (esbuild)
💻 Command: npx esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --log-level=info --metafile=dist/meta.json
────────────────────────────────────────────────────────────────────────────────
  dist/index.js  70.0kb
⚡ Done in 7ms
✅ Backend build (esbuild) - SUCCESS
```

**What to check:**
- ✅ Should see "esbuild version: 0.25.12" (or similar)
- ✅ Should see "file exists: server/_core/index.ts"
- ✅ Should see "dist/index.js 70.0kb"
- ✅ Should see "Backend build (esbuild) - SUCCESS"

**If you see:**
- ❌ "esbuild not found" → esbuild didn't install
- ❌ "Input file not found" → server/_core/index.ts is missing
- ❌ No "dist/index.js" output → esbuild failed silently
- ❌ "Backend build (esbuild) - FAILED" → Check error above

#### Section 4: Verification
```
🔍 STEP 4: Verify backend build output
────────────────────────────────────────────────────────────────────────────────
✅ file exists: dist/index.js (70.02 KB)
📦 dist/index.js size: 70.02 KB

📄 First 10 lines of dist/index.js:
// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
...
```

**What to check:**
- ✅ Should see "file exists: dist/index.js"
- ✅ Should show file size (~70 KB)
- ✅ Should show first 10 lines of the file
- ❌ If "dist/index.js NOT FOUND" → esbuild didn't create the file

#### Section 5: Summary
```
📊 STEP 5: Build summary
────────────────────────────────────────────────────────────────────────────────
📂 Final dist/ structure:
-rw-rw-r-- 1 ubuntu ubuntu 71K Nov 25 06:38 dist/index.js
-rw-rw-r-- 1 ubuntu ubuntu 360K Nov 25 06:38 dist/public/index.html
...

✨ BUILD COMPLETED SUCCESSFULLY! ✨
```

**What to check:**
- ✅ Should see dist/index.js in the file list
- ✅ Should see "BUILD COMPLETED SUCCESSFULLY"

## 🎯 Common Failure Scenarios

### Scenario 1: esbuild Not Installed

**Logs show:**
```
❌ esbuild not found or not executable
```

**Solution:**
- esbuild is in dependencies, so it should install
- Check if `npm install --include=dev` completed successfully
- Check if there were any npm install errors

### Scenario 2: Input File Not Found

**Logs show:**
```
❌ FATAL: Input file not found: server/_core/index.ts
```

**Solution:**
- The source file is missing from the repository
- Check if git pull completed successfully
- Verify the repository structure on Infomaniak

### Scenario 3: esbuild Runs But No Output

**Logs show:**
```
✅ esbuild version: 0.25.12
🔧 Running esbuild...
[no output]
❌ FATAL: Backend build failed - dist/index.js NOT FOUND
```

**Solution:**
- esbuild is failing silently
- Check for TypeScript errors in server/_core/index.ts
- Check if there are import errors
- Look for any error messages between "Running esbuild" and "FATAL"

### Scenario 4: Permission Issues

**Logs show:**
```
❌ Failed to create dist: EACCES: permission denied
```

**Solution:**
- Infomaniak doesn't have write permissions
- Contact Infomaniak support
- Check deployment directory permissions

## 📋 What to Send Me

If the build still fails, please copy and send me:

1. **The entire build log** (especially STEP 3 and STEP 4)
2. **Any error messages** you see
3. **The last 50 lines** of the build output

Specifically look for:
- Does it show "esbuild version: X.X.X"?
- Does it show "Running esbuild..."?
- Does it show "dist/index.js 70.0kb"?
- Does it show "Backend build (esbuild) - SUCCESS"?
- Does it show "file exists: dist/index.js"?

## 🔧 Alternative: Manual Build Test

If you have SSH access to Infomaniak, you can test manually:

```bash
# SSH into server
ssh your-user@manager.mantodeus.com

# Navigate to deployment directory
cd /srv/customer/sites/manager.mantodeus.com

# Check if source file exists
ls -lh server/_core/index.ts

# Check if esbuild exists
ls -lh node_modules/esbuild/bin/esbuild

# Try running esbuild manually
npx esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Check if output was created
ls -lh dist/index.js
```

## 🎯 Expected Result

With the debug build script, we should now see **exactly where** the build is failing:

- If esbuild isn't installed → We'll see "esbuild not found"
- If input file is missing → We'll see "Input file not found"
- If esbuild fails → We'll see the actual error message
- If esbuild succeeds → We'll see "dist/index.js 70.0kb" and "BUILD COMPLETED SUCCESSFULLY"

---

**The debug script will tell us exactly what's wrong!** 🔍

Trigger a new build on Infomaniak and send me the build logs, especially the sections marked with "STEP 3" and "STEP 4".
