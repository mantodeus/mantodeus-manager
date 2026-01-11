# Deployment Fix - Missing Font File Issue

## Problem Summary

After the latest deployment (2026-01-11 23:18), the Mantodeus Manager app showed "under construction" despite PM2 showing the app as "online". Investigation revealed:

1. **32 restarts** - App was crash-looping
2. **Build succeeded** - Frontend and backend built correctly
3. **Runtime crash** - App crashed immediately on startup

## Root Cause

The server crashes at startup when loading `server/templates/invoice.ts`, which tries to read `kanit-fonts-base64.css`:

```typescript
const kanitFontsCSS = fs.readFileSync(
  path.join(__dirname, 'kanit-fonts-base64.css'),
  'utf-8'
);
```

After bundling with esbuild, `__dirname` becomes `dist/`, but the build script didn't copy the font file there.

## Error Logs

```
Error: ENOENT: no such file or directory, open '/srv/customer/sites/manager.mantodeus.com/dist/kanit-fonts-base64.css'
    at Object.readFileSync (node:fs:440:20)
    at server/templates/invoice.ts (file:///srv/customer/sites/manager.mantodeus.com/dist/index.js:5872:24)
```

## Immediate Fix (Applied on Server)

```bash
# Copy the font file to dist
cp server/templates/kanit-fonts-base64.css dist/

# Restart PM2
npx pm2 restart mantodeus-manager
```

## Permanent Fix (Applied to Code)

Updated `build-debug.js` to automatically copy the font file during builds:

- Added `copyFileSync` to fs imports
- Added new build step 3.5 to copy `kanit-fonts-base64.css` to `dist/`
- Added error handling and warnings if file is missing

## Next Steps

1. **SSH Terminal**: Run the immediate fix commands above
2. **Verify**: Check `npx pm2 logs mantodeus-manager --lines 10`
3. **Deploy**: Commit and push the build script changes
4. **Test**: Next deployment should automatically include the font file

## Prevention

Future static files needed by the backend at runtime should be:
1. Listed in the build script to be copied to `dist/`
2. OR bundled as base64/inline code
3. OR loaded from a persistent location outside `dist/`

## Related Files

- `build-debug.js` - Updated with font file copy step
- `server/templates/invoice.ts` - Loads the font file at startup
- `server/templates/kanit-fonts-base64.css` - Font file needed for PDF generation
