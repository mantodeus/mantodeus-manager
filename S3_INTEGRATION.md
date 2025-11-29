# S3 Integration Guide - Infomaniak Object Storage

This document describes the S3 integration for Mantodeus Manager using Infomaniak Object Storage.

## Environment Variables

Add these variables to your `.env` file:

```env
# Infomaniak S3 Configuration
S3_ENDPOINT=https://s3.pub1.infomaniak.cloud
S3_REGION=us-east-1
S3_BUCKET=mantodeus-manager-files
S3_ACCESS_KEY_ID=your-access-key-id
S3_SECRET_ACCESS_KEY=your-secret-access-key
```

## Architecture Overview

### Why Server-Side Upload?

Infomaniak S3 does not support configuring CORS via the AWS CLI or API. While the Horizon dashboard has a CORS section, direct browser-to-S3 uploads can still fail. To ensure reliable uploads, we use a **server-side upload pattern**:

1. **Browser** → sends base64 file data → **Server**
2. **Server** → uploads to S3 using AWS SDK → **S3**

This bypasses CORS entirely since the S3 request comes from the server, not the browser.

### File Viewing

For viewing files (images, PDFs, documents), we use a **server-side proxy**:

- `/api/image-proxy?key=<fileKey>` - For images (with aggressive caching)
- `/api/file-proxy?key=<fileKey>&filename=<name>` - For documents (PDFs, etc.)
- `/api/file-proxy?key=<fileKey>&filename=<name>&download=true` - For downloads

This ensures files work regardless of bucket visibility or CORS settings.

## Backend Storage (`server/storage.ts`)

The storage module provides these main functions:

### Upload Operations

1. **`storagePut(key, data, contentType)`** - Server-side upload
   - Accepts Buffer, Uint8Array, or base64 string
   - Returns `{ key, url, size }`
   - Primary method for all uploads

2. **`createPresignedUploadUrl(key, contentType)`** - Presigned URL (for future use)
   - Available if CORS is configured in the future
   - Returns `{ uploadUrl, key, publicUrl }`

### Read Operations

3. **`storageGet(key)`** - Get file from S3
   - Returns `{ data: Buffer, contentType, size }`
   - Used by proxy endpoints

4. **`createPresignedReadUrl(key, expiresIn)`** - Signed read URL
   - Generates a time-limited URL for direct access
   - Default: 1 hour expiration

5. **`storageHead(key)`** - Get file metadata
   - Returns `{ key, size, lastModified, contentType }`

6. **`storageExists(key)`** - Check if file exists
   - Returns boolean

### List Operations

7. **`storageList(prefix, maxKeys)`** - List files
   - Returns array of `FileMetadata`

8. **`listJobFiles(jobId)`** - List all files for a job
   - Combines uploads and invoices

### Delete Operations

9. **`deleteFromStorage(key)`** - Delete single file
10. **`deleteMultipleFromStorage(keys)`** - Delete multiple files

### Utility Functions

- `generateFileKey(prefix, userId, filename)` - Generate unique file keys
- `getPublicUrl(key)` - Get public URL (for public buckets)
- `getContentType(filename)` - Detect content type from extension
- `isImageFile(filename)` - Check if file is an image
- `isPdfFile(filename)` - Check if file is a PDF

## API Endpoints

### Images Router (`/api/trpc/images.*`)

| Endpoint | Type | Description |
|----------|------|-------------|
| `listByJob` | Query | List images for a job |
| `listByTask` | Query | List images for a task |
| `getReadUrl` | Query | Get presigned read URL for an image |
| `getReadUrls` | Query | Get presigned URLs for multiple images |
| `upload` | Mutation | **Server-side upload** (base64 data) |
| `getUploadUrl` | Mutation | Get presigned upload URL (requires CORS) |
| `confirmUpload` | Mutation | Confirm direct upload |
| `updateCaption` | Mutation | Update image caption |
| `delete` | Mutation | Delete image (S3 + DB) |

### Invoices Router (`/api/trpc/invoices.*`)

| Endpoint | Type | Description |
|----------|------|-------------|
| `list` | Query | List all invoices |
| `getByJob` | Query | List invoices for a job |
| `getByContact` | Query | List invoices for a contact |
| `getReadUrl` | Query | Get presigned read URL |
| `upload` | Mutation | **Server-side upload** (base64 data) |
| `getUploadUrl` | Mutation | Get presigned upload URL (requires CORS) |
| `confirmUpload` | Mutation | Confirm direct upload |
| `delete` | Mutation | Delete invoice (S3 + DB) |

### Files Router (`/api/trpc/files.*`)

| Endpoint | Type | Description |
|----------|------|-------------|
| `listByJob` | Query | List all files for a job (images + invoices) |
| `getReadUrls` | Query | Get presigned URLs for multiple files |
| `delete` | Mutation | Delete file by type |
| `listS3` | Query | List raw S3 objects (admin) |

### Proxy Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/image-proxy` | GET | Proxy images from S3 (1 year cache) |
| `/api/file-proxy` | GET | Proxy files from S3 (1 hour cache) |

## File Organization

Files are organized in S3 with the following structure:

```
mantodeus-manager-files/
├── uploads/
│   └── {userId}/
│       └── {timestamp}-{random}-{filename}   # Images
└── invoices/
    └── {userId}/
        └── {timestamp}-{random}-{filename}   # Documents
```

## Upload Flow (Current Implementation)

### Images

```
1. User selects image file
2. Frontend converts file to base64
3. Frontend calls images.upload mutation with base64 data
4. Backend decodes base64 and uploads to S3
5. Backend saves metadata to database
6. Frontend refreshes image list
```

### Invoices

```
1. User selects document file
2. Frontend converts file to base64
3. Frontend calls invoices.upload mutation with base64 data
4. Backend decodes base64 and uploads to S3
5. Backend saves metadata to database
6. Frontend refreshes invoice list
```

## Database Schema

### Images Table

```sql
CREATE TABLE images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  jobId INT,
  taskId INT,
  fileKey VARCHAR(500) NOT NULL,
  url TEXT NOT NULL,
  filename VARCHAR(255),
  mimeType VARCHAR(100),
  fileSize INT,
  caption TEXT,
  uploadedBy INT NOT NULL,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

### Invoices Table

```sql
CREATE TABLE invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  fileKey VARCHAR(500) NOT NULL,
  fileSize INT,
  mimeType VARCHAR(100),
  jobId INT,
  contactId INT,
  uploadDate TIMESTAMP,
  uploadedBy INT NOT NULL,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

## Error Handling

All S3 operations include comprehensive error handling:

- **Upload failures**: Clear error messages with details
- **Delete failures**: Logged, but database deletion continues (prevents orphaned records)
- **Missing configuration**: Lists missing environment variables
- **Network errors**: Properly wrapped with context

## Development vs Production

The same code works in both environments. The key differences:

| Aspect | Development | Production |
|--------|-------------|------------|
| S3 Credentials | From `.env` | From Infomaniak dashboard |
| File Access | Via proxy endpoints | Via proxy endpoints |
| Cache Duration | Same | Same |

## Testing

### Test Upload Flow

1. Start the development server: `npm run dev`
2. Navigate to a job detail page
3. Upload an image
4. Verify the image appears in the gallery
5. Check browser network tab - should see `/api/trpc/images.upload` mutation

### Test Invoice Upload

1. Navigate to Invoices page
2. Click "Upload Invoice"
3. Select a PDF file
4. Verify it appears in the list
5. Click View to open in new tab

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
- Test with AWS CLI: `aws s3 ls s3://mantodeus-manager-files --profile infomaniak --endpoint-url https://s3.pub1.infomaniak.cloud`

### Images Not Loading

- Check browser console for 500 errors on `/api/image-proxy`
- Verify the `fileKey` in database is correct
- Test the proxy URL directly in browser
- Check server logs for S3 errors

### Large File Uploads Failing

- Current limit: 10MB (enforced on frontend)
- Server body limit: 50mb (in express config)
- For larger files, consider chunked uploads

### Delete Not Working

- Check S3 bucket permissions (delete access)
- Verify `fileKey` is stored correctly in database
- Check server logs for S3 delete errors
- Note: Database record is deleted even if S3 delete fails

## Security Considerations

1. **File Keys**: Include user ID to organize files
2. **Content Types**: Validated on frontend
3. **File Size Limits**: 10MB enforced on client
4. **Proxy Caching**: Images cached for 1 year, documents for 1 hour
5. **No Direct S3 Access**: All access through server proxy

## AWS CLI Commands (for debugging)

```bash
# List bucket contents
aws s3 ls s3://mantodeus-manager-files --profile infomaniak --endpoint-url https://s3.pub1.infomaniak.cloud

# Upload a test file
aws s3 cp test.jpg s3://mantodeus-manager-files/test.jpg --profile infomaniak --endpoint-url https://s3.pub1.infomaniak.cloud

# Delete a file
aws s3 rm s3://mantodeus-manager-files/uploads/1/example.jpg --profile infomaniak --endpoint-url https://s3.pub1.infomaniak.cloud
```
