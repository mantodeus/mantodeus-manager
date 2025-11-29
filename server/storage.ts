import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

type S3Config = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

let s3Client: S3Client | null = null;

function getS3Config(): S3Config {
  const { s3Endpoint, s3Region, s3Bucket, s3AccessKeyId, s3SecretAccessKey } = ENV;

  // Debug logging to help diagnose missing variables
  if (!s3Endpoint || !s3Region || !s3Bucket || !s3AccessKeyId || !s3SecretAccessKey) {
    const missing = [];
    if (!s3Endpoint) missing.push("S3_ENDPOINT");
    if (!s3Region) missing.push("S3_REGION");
    if (!s3Bucket) missing.push("S3_BUCKET");
    if (!s3AccessKeyId) missing.push("S3_ACCESS_KEY_ID");
    if (!s3SecretAccessKey) missing.push("S3_SECRET_ACCESS_KEY");
    
    console.error("[S3 Config] Missing environment variables:", missing.join(", "));
    throw new Error(
      `S3 storage is not configured. Missing: ${missing.join(", ")}. Please set S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY in your environment.`
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
    forcePathStyle: true, // Infomaniak uses path-style URLs
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return s3Client;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function getPublicUrl(key: string): string {
  const { endpoint, bucket } = getS3Config();
  const normalized = normalizeKey(key);
  // Path-style URL: https://endpoint/bucket/key
  return `${endpoint}/${bucket}/${encodeURI(normalized)}`;
}

/**
 * Direct upload helper used for server-side uploads (e.g. when we already have file bytes).
 * Most browser uploads should use createPresignedUploadUrl instead.
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const client = getS3Client();
  const config = getS3Config();

  try {
    const body =
      typeof data === "string"
        ? Buffer.from(data, "base64")
        : (data as Buffer | Uint8Array);

    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: "public-read", // Make uploaded files publicly readable
    });

    await client.send(command);

    return {
      key,
      url: getPublicUrl(key),
    };
  } catch (error) {
    console.error("[S3] Upload failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Storage upload failed: ${message}`);
  }
}

/**
 * Create a presigned URL that the frontend can use to upload a file directly to S3.
 */
export async function createPresignedUploadUrl(
  relKey: string,
  contentType: string,
  expiresInSeconds = 15 * 60
): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
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
 * Get an object from S3 storage (for proxying to client)
 */
export async function storageGet(relKey: string): Promise<{ data: Buffer; contentType: string }> {
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
    };
  } catch (error) {
    console.error("[S3] Get failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Storage get failed: ${message}`);
  }
}

/**
 * Create a presigned URL for reading a file from S3
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



