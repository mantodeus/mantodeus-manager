# Fix: CORS Error on Invoice Upload

## Problem
The browser is trying to upload directly to S3 using presigned URLs, which triggers CORS errors because Infomaniak S3 doesn't support CORS configuration via API.

## Solution
The code has been refactored to use **server-side uploads** (browser → server → S3), but your browser is still running the old cached JavaScript.

## Steps to Fix

### 1. Rebuild the Application

```bash
cd C:\Dev\mantodeus-manager
pnpm install  # Ensure dependencies are up to date
pnpm run build  # Rebuild frontend and backend
```

### 2. Clear Browser Cache

**Option A: Hard Refresh (Quick)**
- Press `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac)
- This forces a reload without cache

**Option B: Clear Service Worker Cache (Recommended)**
1. Open browser DevTools (F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Click **Service Workers** in the left sidebar
4. Find `manager.mantodeus.com` service worker
5. Click **Unregister**
6. Go to **Cache Storage** in the left sidebar
7. Delete all caches (right-click → Delete)
8. Refresh the page (F5)

**Option C: Clear All Site Data (Nuclear Option)**
1. Open browser DevTools (F12)
2. Go to **Application** tab
3. Click **Clear storage** in the left sidebar
4. Check all boxes
5. Click **Clear site data**
6. Refresh the page

### 3. Redeploy to Server

After rebuilding, deploy the new code to your Infomaniak server:

```bash
# SSH to server (if possible) or use Infomaniak dashboard
git pull origin main
pnpm install
pnpm run build
# Restart the application via Infomaniak dashboard
```

### 4. Verify the Fix

1. Open the Invoices page
2. Try uploading a PDF
3. Check browser Network tab - you should see:
   - `POST /api/trpc/invoices.upload` (not a direct S3 PUT)
   - No CORS errors
   - Successful upload

## What Changed

### Before (Old Code - CORS Error)
```
Browser → Get presigned URL → Upload directly to S3 ❌ (CORS blocked)
```

### After (New Code - Works)
```
Browser → Convert to base64 → POST to server → Server uploads to S3 ✅
```

## Service Worker Update

The service worker version has been incremented to `v3.0.0` to force a cache clear. The service worker now:
- ✅ Skips caching POST/PUT/DELETE requests
- ✅ Skips caching OPTIONS requests (CORS preflight)
- ✅ Only caches GET requests for static assets

## Still Having Issues?

If you still see CORS errors after clearing cache:

1. **Check the Network tab** - Are you seeing `POST /api/trpc/invoices.upload` or a direct S3 PUT?
2. **Check the Console** - Any JavaScript errors?
3. **Verify the build** - Make sure `pnpm run build` completed successfully
4. **Check server logs** - Verify the new code is running on the server

## Quick Test

Open browser console and run:
```javascript
// Check if service worker is registered
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Service Workers:', regs);
  regs.forEach(reg => reg.unregister());
  console.log('Unregistered all service workers');
});

// Clear all caches
caches.keys().then(keys => {
  keys.forEach(key => caches.delete(key));
  console.log('Cleared all caches');
});

// Reload
location.reload();
```

