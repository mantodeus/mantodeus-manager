# S3 Configuration Debugging

## Error: "Storage proxy credentials missing"

This error is actually from the **Google Maps integration**, not S3 storage. However, it suggests your environment variables might not be loading correctly.

## Step 1: Verify S3 Environment Variables

Make sure these are set in your Infomaniak environment:

```
S3_ENDPOINT=https://s3.pub1.infomaniak.cloud
S3_REGION=us-east-1
S3_BUCKET=mantodeus-manager-files
S3_ACCESS_KEY_ID=ba794c9e6d034ccc9ac0bb2d3aa55b1b
S3_SECRET_ACCESS_KEY=e78e5ef0cebb462faf397ea621b1d87a
```

## Step 2: Check Application Logs

In Infomaniak Manager:
1. Go to your Node.js application
2. Check the **Logs** or **Console Output**
3. Look for errors like:
   - "S3 storage is not configured"
   - Any S3-related errors
   - Environment variable loading issues

## Step 3: Verify S3 Configuration is Loading

The S3 storage code will throw this error if variables are missing:
```
S3 storage is not configured. Please set S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY in your environment.
```

If you see this, the S3 variables aren't being loaded.

## Step 4: About the "Storage proxy" Error

The error "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY" is from:
- **Google Maps geocoding** (when creating/updating jobs with locations)
- **NOT from image uploads**

Image uploads use S3 directly and should work if S3 variables are set.

## Step 5: Quick Test

1. Try uploading an image to a job **without a location** - this should work if S3 is configured
2. If it still fails, check the exact error message in browser console (F12)

## Common Issues

1. **Environment variables not saved** - Make sure you clicked "Save" in Infomaniak panel
2. **Application not restarted** - Restart after setting environment variables
3. **Variable names with typos** - Double-check spelling (case-sensitive)
4. **Missing bucket** - Verify bucket `mantodeus-manager-files` exists

## Next Steps

1. Check Infomaniak logs for the actual S3 error
2. Verify all 5 S3 environment variables are set
3. Restart the application
4. Try uploading again

