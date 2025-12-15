# Complete Deployment Guide - Fixing "Storage proxy credentials" Error

## Problem

The error `Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY` occurs because:
1. The deployed frontend code is outdated (still using old `images.upload` endpoint)
2. The new code uses S3 with `images.getUploadUrl` and `images.confirmUpload`

## Solution: Complete Rebuild and Deploy

### Step 1: Build Locally (Optional but Recommended)

**On Windows (PowerShell):**
```powershell
cd C:\Dev\mantodeus-manager
.\build-complete.ps1
```

**On Linux/Mac:**
```bash
cd /path/to/mantodeus-manager
chmod +x build-complete.sh
./build-complete.sh
```

**Or use npm:**
```bash
npm run build
```

### Step 2: Commit and Push to GitHub

```bash
git add .
git commit -m "Update to S3 storage, remove old upload endpoint"
git push origin main
```

### Step 3: Deploy on Infomaniak

1. **Go to Infomaniak Manager**
2. **Navigate to your Node.js application** (`manager.mantodeus.com`)
3. **Go to Deployment/Build settings**
4. **Important**: Check "Delete node_modules" or "Clean build"
5. **Trigger a new build/deployment**
6. **Wait for build to complete** (watch the logs)

### Step 4: Verify Environment Variables

In Infomaniak Manager → Environment Variables, ensure these are set:

```
S3_ENDPOINT=https://s3.pub1.infomaniak.cloud
S3_REGION=us-east-1
S3_BUCKET=mantodeus-manager-files
S3_ACCESS_KEY_ID=ba794c9e6d034ccc9ac0bb2d3aa55b1b
S3_SECRET_ACCESS_KEY=e78e5ef0cebb462faf397ea621b1d87a
```

### Step 5: Restart Application

After build completes:
1. **Restart the application** in Infomaniak Manager
2. **Clear browser cache** (Ctrl+Shift+Delete or Cmd+Shift+Delete)
3. **Hard refresh** the page (Ctrl+F5 or Cmd+Shift+R)

### Step 6: Verify Deployment

1. Open browser DevTools (F12)
2. Go to Network tab
3. Try uploading an image
4. Check that it calls `/api/trpc/images.getUploadUrl` (not `images.upload`)
5. Check that upload succeeds

## Build Commands for Infomaniak

If Infomaniak uses automated builds, ensure these commands are set:

**Build Command:**
```bash
npm install && npm run build
```

**Start Command:**
```bash
npm start
```

**Node Version:**
- Node.js 22.x (or 18+)

## Troubleshooting

### Still Getting "Storage proxy" Error?

1. **Clear browser cache completely**
   - Chrome: Settings → Privacy → Clear browsing data → Cached images and files
   - Firefox: Settings → Privacy → Clear Data → Cached Web Content

2. **Check build logs in Infomaniak**
   - Verify `dist/index.js` was created
   - Verify `dist/public/` contains frontend files
   - Look for any build errors

3. **Verify the deployed code**
   - Check if `dist/index.js` contains `getUploadUrl` (search in file)
   - Should NOT contain `images.upload` endpoint

4. **Force rebuild**
   - Delete `node_modules` in Infomaniak
   - Delete `dist` directory
   - Trigger fresh build

### Build Fails?

1. Check Node.js version (needs 18+)
2. Check if all dependencies installed correctly
3. Look for TypeScript errors
4. Check if `vite` and `esbuild` are available

## Expected Behavior After Fix

✅ Image uploads use S3 directly
✅ No "Storage proxy" errors
✅ Files stored in `mantodeus-manager-files` bucket
✅ Uploads work without `BUILT_IN_FORGE_API_URL`

## Files Changed

- `server/storage.ts` - Uses S3 (no forge API)
- `server/routers.ts` - Has `getUploadUrl` and `confirmUpload` (no `upload`)
- `client/src/components/ImageUpload.tsx` - Uses new endpoints

## Notes

- The old `images.upload` endpoint has been removed
- All uploads now go directly to S3 via presigned URLs
- No forge API credentials needed for uploads
- Google Maps geocoding still needs `BUILT_IN_FORGE_API_URL` (if you use maps)















