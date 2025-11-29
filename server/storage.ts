/**
 * S3 Storage Module for Mantodeus Manager
 * 
 * Provides all file storage operations using Infomaniak S3-compatible storage.
 * All files are stored in a private bucket and accessed via presigned URLs or server proxy.
 * 
 * Architecture:
 * - Upload: Server-side upload (browser → server → S3) to bypass CORS
 * - Download: Presigned URLs or server proxy for viewing
 * - Delete: Direct S3 delete with credentials
 */

import { 
  S3Client, 
  PutObjectCommand, 
  DeleteObjectCommand, 
  GetObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  type _Object as S3Object,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

// ============================================================================
// Types
// ============================================================================

export type S3Config = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export type FileMetadata = {
  key: string;
  size: number;
  lastModified: Date;
  contentType?: string;
};

export type UploadResult = {
  key: string;
  url: string;
  size: number;
};

export type PresignedUrlResult = {
  uploadUrl: string;
  key: string;
  publicUrl: string;
};

// ============================================================================
// Configuration
// ============================================================================

let s3Client: S3Client | null = null;

function getS3Config(): S3Config {
  const { s3Endpoint, s3Region, s3Bucket, s3AccessKeyId, s3SecretAccessKey } = ENV;

  if (!s3Endpoint || !s3Region || !s3Bucket || !s3AccessKeyId || !s3SecretAccessKey) {
    const missing = [];
    if (!s3Endpoint) missing.push("S3_ENDPOINT");
    if (!s3Region) missing.push("S3_REGION");
    if (!s3Bucket) missing.push("S3_BUCKET");
    if (!s3AccessKeyId) missing.push("S3_ACCESS_KEY_ID");
    if (!s3SecretAccessKey) missing.push("S3_SECRET_ACCESS_KEY");
    
    console.error("[S3 Config] Missing environment variables:", missing.join(", "));
    throw new Error(
      `S3 storage is not configured. Missing: ${missing.join(", ")}. ` +
      `Please set S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY in your environment.`
    );
  }

  return {
    endpoint: s3Endpoint.replace(/\/+$/, ""),
    region: s3Region,
    bucket: s3Bucket,
    accessKeyId: s3AccessKeyId,
    secretAccessKey: s3SecretAccessKey,
  };
}

function getS3Client(): S3Client {
  if (s3Client) return s3Client;

  const config = getS3Config();

  s3Client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: true, // Required for Infomaniak S3
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return s3Client;
}

// ============================================================================
// Helper Functions
// ============================================================================

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

/**
 * Get the public URL for an S3 object (requires public bucket or ACL)
 * Note: For private buckets, use createPresignedReadUrl instead
 */
export function getPublicUrl(key: string): string {
  const { endpoint, bucket } = getS3Config();
  const normalized = normalizeKey(key);
  return `${endpoint}/${bucket}/${encodeURI(normalized)}`;
}

/**
 * Generate a unique file key with timestamp and random suffix
 */
export function generateFileKey(
  prefix: string,
  userId: number,
  filename: string
): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${prefix}/${userId}/${timestamp}-${randomSuffix}-${safeFilename}`;
}

// ============================================================================
// Upload Operations
// ============================================================================

/**
 * Upload a file directly to S3 (server-side upload)
 * Use this when you have the file data on the server (e.g., base64 from client)
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<UploadResult> {
  const key = normalizeKey(relKey);
  const client = getS3Client();
  const config = getS3Config();

  try {
    const body = typeof data === "string"
      ? Buffer.from(data, "base64")
      : (data as Buffer | Uint8Array);

    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await client.send(command);

    return {
      key,
      url: getPublicUrl(key),
      size: body.length,
    };
  } catch (error) {
    console.error("[S3] Upload failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Storage upload failed: ${message}`);
  }
}

/**
 * Create a presigned URL for direct browser-to-S3 upload
 * Note: This requires CORS to be configured on the bucket (Infomaniak may not support this)
 */
export async function createPresignedUploadUrl(
  relKey: string,
  contentType: string,
  expiresInSeconds = 15 * 60
): Promise<PresignedUrlResult> {
  const key = normalizeKey(relKey);
  const client = getS3Client();
  const config = getS3Config();

  try {
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: expiresInSeconds,
    });

    return {
      uploadUrl,
      key,
      publicUrl: getPublicUrl(key),
    };
  } catch (error) {
    console.error("[S3] Failed to create presigned upload URL:", error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to create upload URL: ${message}`);
  }
}

// ============================================================================
// Download/Read Operations
// ============================================================================

/**
 * Get an object from S3 (for server-side reading or proxying)
 */
export async function storageGet(
  relKey: string
): Promise<{ data: Buffer; contentType: string; size: number }> {
  const key = normalizeKey(relKey);
  const client = getS3Client();
  const config = getS3Config();

  try {
    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });

    const response = await client.send(command);
    
    if (!response.Body) {
      throw new Error("Empty response body");
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const data = Buffer.concat(chunks);
    
    return {
      data,
      contentType: response.ContentType || "application/octet-stream",
      size: response.ContentLength || data.length,
    };
  } catch (error) {
    console.error("[S3] Get failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Storage get failed: ${message}`);
  }
}

/**
 * Create a presigned URL for reading a file from S3
 * Use this for viewing images, PDFs, etc. in the browser
 */
export async function createPresignedReadUrl(
  relKey: string,
  expiresInSeconds = 60 * 60 // 1 hour default
): Promise<string> {
  const key = normalizeKey(relKey);
  const client = getS3Client();
  const config = getS3Config();

  try {
    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });

    return await getSignedUrl(client, command, {
      expiresIn: expiresInSeconds,
    });
  } catch (error) {
    console.error("[S3] Failed to create presigned read URL:", error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to create read URL: ${message}`);
  }
}

/**
 * Check if a file exists in S3
 */
export async function storageExists(relKey: string): Promise<boolean> {
  const key = normalizeKey(relKey);
  const client = getS3Client();
  const config = getS3Config();

  try {
    const command = new HeadObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch (error: unknown) {
    if ((error as { name?: string })?.name === "NotFound") {
      return false;
    }
    throw error;
  }
}

/**
 * Get metadata for a file in S3
 */
export async function storageHead(relKey: string): Promise<FileMetadata | null> {
  const key = normalizeKey(relKey);
  const client = getS3Client();
  const config = getS3Config();

  try {
    const command = new HeadObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });

    const response = await client.send(command);
    
    return {
      key,
      size: response.ContentLength || 0,
      lastModified: response.LastModified || new Date(),
      contentType: response.ContentType,
    };
  } catch (error: unknown) {
    if ((error as { name?: string })?.name === "NotFound") {
      return null;
    }
    throw error;
  }
}

// ============================================================================
// List Operations
// ============================================================================

/**
 * List files in S3 with a given prefix
 */
export async function storageList(
  prefix: string,
  maxKeys = 1000
): Promise<FileMetadata[]> {
  const normalizedPrefix = normalizeKey(prefix);
  const client = getS3Client();
  const config = getS3Config();

  try {
    const command = new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: normalizedPrefix,
      MaxKeys: maxKeys,
    });

    const response = await client.send(command);
    
    return (response.Contents || []).map((item: S3Object) => ({
      key: item.Key || "",
      size: item.Size || 0,
      lastModified: item.LastModified || new Date(),
    }));
  } catch (error) {
    console.error("[S3] List failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Storage list failed: ${message}`);
  }
}

/**
 * List files for a specific job
 */
export async function listJobFiles(jobId: number): Promise<FileMetadata[]> {
  // List both uploads and invoices for this job
  const uploadPrefix = `uploads/`;
  const invoicePrefix = `invoices/`;
  
  const [uploads, invoices] = await Promise.all([
    storageList(uploadPrefix),
    storageList(invoicePrefix),
  ]);

  // Note: S3 doesn't know about jobId associations - that's in the database
  // This function lists all files, the router should filter by jobId from DB
  return [...uploads, ...invoices];
}

// ============================================================================
// Delete Operations
// ============================================================================

/**
 * Delete a file from S3
 */
export async function deleteFromStorage(relKey: string): Promise<void> {
  const key = normalizeKey(relKey);
  const client = getS3Client();
  const config = getS3Config();

  try {
    const command = new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });

    await client.send(command);
  } catch (error) {
    console.error("[S3] Delete failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Storage delete failed: ${message}`);
  }
}

/**
 * Delete multiple files from S3
 */
export async function deleteMultipleFromStorage(keys: string[]): Promise<void> {
  // S3 batch delete requires different import, so we'll do sequential deletes
  await Promise.all(keys.map((key) => deleteFromStorage(key)));
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Copy a file within S3 (e.g., for creating annotated versions)
 */
export async function storageCopy(
  sourceKey: string,
  destKey: string
): Promise<UploadResult> {
  // Get the source file
  const { data, contentType } = await storageGet(sourceKey);
  
  // Upload to new location
  return await storagePut(destKey, data, contentType);
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

/**
 * Determine content type from filename
 */
export function getContentType(filename: string): string {
  const ext = getFileExtension(filename);
  const contentTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    txt: "text/plain",
    json: "application/json",
  };
  return contentTypes[ext] || "application/octet-stream";
}

/**
 * Check if a file is an image
 */
export function isImageFile(filename: string): boolean {
  const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
  return imageExtensions.includes(getFileExtension(filename));
}

/**
 * Check if a file is a PDF
 */
export function isPdfFile(filename: string): boolean {
  return getFileExtension(filename) === "pdf";
}
