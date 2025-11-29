# S3 Integration Guide - Infomaniak Object Storage

This document describes the S3 integration for Mantodeus Manager using Infomaniak Object Storage.

## Environment Variables

Add these variables to your `.env` file:

```env
# Infomaniak S3 Configuration
S3_ENDPOINT=https://s3.pub1.infomaniak.cloud
S3_REGION=us-east-1
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY_ID=your-access-key-id
S3_SECRET_ACCESS_KEY=your-secret-access-key
```

## Architecture

### Backend Storage (`server/storage.ts`)

The storage module provides three main functions:

1. **`storagePut(key, data, contentType)`** - Direct server-side upload
   - Used when the server already has file bytes (e.g., base64 conversion)
   - Uploads directly to S3 using AWS SDK v3

2. **`createPresignedUploadUrl(key, contentType)`** - Presigned URL generation
   - Generates a presigned URL that allows direct browser-to-S3 uploads
   - Expires in 15 minutes by default
   - Returns both the upload URL and the public URL

3. **`deleteFromStorage(key)`** - Delete files from S3
   - Removes files from S3 when records are deleted
   - Used in both image and invoice deletion flows

### Upload Flow

#### Images (Presigned URLs)

1. Frontend requests presigned URL via `images.getUploadUrl`
2. Backend generates presigned URL and returns it
3. Frontend uploads file directly to S3 using the presigned URL
4. Frontend confirms upload via `images.confirmUpload`
5. Backend saves metadata to database

#### Invoices (Presigned URLs)

1. Frontend requests presigned URL via `invoices.getUploadUrl`
2. Backend generates presigned URL and returns it
3. Frontend uploads file directly to S3 using the presigned URL
4. Frontend confirms upload via `invoices.confirmUpload`
5. Backend saves metadata to database

### File Organization

Files are organized in S3 with the following structure:

```
uploads/
  {userId}/
    {timestamp}-{random}-{filename}  # Images
invoices/
  {userId}/
    {timestamp}-{filename}            # Invoices
```

## CORS Configuration

For Infomaniak S3 to accept direct browser uploads, you need to configure CORS on your bucket.

### Required CORS Settings

In your Infomaniak Object Storage bucket settings, add the following CORS configuration:

```json
[
  {
    "AllowedOrigins": [
      "https://manager.mantodeus.com",
      "http://localhost:3000",
      "http://localhost:5173"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag",
      "x-amz-request-id"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

### How to Configure CORS in Infomaniak

**Note:** Infomaniak's S3-compatible API does not support CORS configuration via AWS CLI. You must configure CORS through the Infomaniak web interface:

1. Log in to your Infomaniak account
2. Navigate to **Object Storage** → **Your Bucket** (`mantodeus-manager-files`)
3. Go to the **"CORS"** or **"Permissions"** section
4. Add the CORS configuration above (as JSON)
5. Save the changes

**Note:** Replace `https://manager.mantodeus.com` with your actual production domain, and add any other development domains you use.

**Alternative:** If the web interface uses a different format, you can also try configuring CORS through the Infomaniak control panel's Object Storage settings.

## Error Handling

All S3 operations include comprehensive error handling:

- **Upload failures**: Logged to console, error message returned to client
- **Delete failures**: Logged to console, but database deletion continues (prevents orphaned DB records)
- **Missing configuration**: Clear error messages guide setup

## Development vs Production

The same S3 configuration works in both environments. The only difference is:

- **Development**: Uses `http://localhost:3000` or `http://localhost:5173` in CORS
- **Production**: Uses your production domain in CORS

Make sure both are included in your CORS configuration.

## Testing

### Test Upload Flow

1. Start the development server: `npm run dev`
2. Navigate to a job detail page
3. Upload an image
4. Verify the image appears in the gallery
5. Check browser network tab to confirm direct S3 upload

### Test Delete Flow

1. Delete an image or invoice
2. Verify it's removed from the UI
3. Check S3 bucket to confirm file is deleted
4. Check database to confirm record is deleted

## Troubleshooting

### "Storage upload failed" Error

- Check that all S3 environment variables are set
- Verify S3 credentials are correct
- Check bucket name matches exactly
- Ensure bucket exists and is accessible

### CORS Errors in Browser

- Verify CORS configuration includes your domain
- Check that `AllowedMethods` includes `PUT` (for presigned uploads)
- Ensure `AllowedHeaders` includes `*` or specific headers needed
- Clear browser cache and try again

### Files Not Appearing After Upload

- Check browser console for errors
- Verify presigned URL hasn't expired (15 minutes)
- Check S3 bucket to see if file was uploaded
- Verify database record was created

### Delete Not Working

- Check S3 bucket permissions (delete access)
- Verify `fileKey` is stored correctly in database
- Check server logs for S3 delete errors
- Note: Database record is deleted even if S3 delete fails (prevents orphaned records)

## Security Considerations

1. **Presigned URLs**: Expire after 15 minutes for security
2. **File Keys**: Include user ID to prevent unauthorized access
3. **Content Types**: Validated on both client and server
4. **File Size Limits**: Enforced on client (10MB for images, configurable for invoices)

## Migration Notes

If migrating from the old storage system:

1. Existing files in the old system will continue to work via the image proxy
2. New uploads will use the new S3 system
3. Old file keys will remain in the database
4. Consider a migration script to move old files to S3 if needed

