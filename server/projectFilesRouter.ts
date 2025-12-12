/**
 * Project Files Router - tRPC procedures for file uploads/downloads
 * 
 * Implements project-based file storage with S3:
 * - Presigned upload URLs for direct browser-to-S3 uploads
 * - File registration in database after upload
 * - Presigned download URLs for secure file access
 * 
 * S3 Key Pattern:
 * - With jobId: projects/{projectId}/jobs/{jobId}/{timestamp}-{uuid}-{originalFileName}
 * - Without jobId: projects/{projectId}/_project/{timestamp}-{uuid}-{originalFileName}
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { 
  createPresignedUploadUrl, 
  createPresignedReadUrl,
  deleteFromStorage,
  storagePut,
  storageGet,
} from "./storage";
import { nanoid } from "nanoid";
import type { TrpcContext } from "./_core/context";
import { 
  processImage, 
  shouldProcessImage, 
} from "./_core/imageProcessing";
import { 
  processAndUploadImageVariants,
  generateSignedVariantUrls,
  deleteImageVariants,
  type ImageVariant,
} from "./_core/imagePipeline";
import type { StoredImageMetadata } from "../drizzle/schema";

// =============================================================================
// CONSTANTS
// =============================================================================

// Allowed MIME types for file uploads
const ALLOWED_MIME_TYPES = [
  // Images (including HEIC/HEIF which will be converted to JPEG)
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // Text
  "text/plain",
  "text/csv",
  // Archives
  "application/zip",
  "application/x-zip-compressed",
] as const;

// Maximum file size (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Presigned URL expiration times
const UPLOAD_URL_EXPIRY_SECONDS = 15 * 60; // 15 minutes
const DOWNLOAD_URL_EXPIRY_SECONDS = 60 * 60; // 1 hour

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate S3 key for project files
 * Pattern: projects/{projectId}/jobs/{jobId}/{timestamp}-{uuid}-{sanitizedFileName}
 * If jobId is null: projects/{projectId}/_project/{timestamp}-{uuid}-{sanitizedFileName}
 */
function generateProjectFileKey(
  projectId: number,
  jobId: number | null,
  originalFileName: string
): string {
  const timestamp = Date.now();
  const uuid = nanoid(12);
  const sanitizedFileName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  
  const jobPart = jobId ? `jobs/${jobId}` : "_project";
  
  return `projects/${projectId}/${jobPart}/${timestamp}-${uuid}-${sanitizedFileName}`;
}

async function hydrateFileWithSignedUrls<T extends { imageMetadata: StoredImageMetadata | null }>(
  file: T
): Promise<T & { imageUrls: Record<ImageVariant, string> | null }> {
  const imageUrls = await generateSignedVariantUrls(file.imageMetadata);
  return {
    ...file,
    imageUrls,
  };
}

/**
 * Validate MIME type
 */
function validateMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType as typeof ALLOWED_MIME_TYPES[number]);
}

/**
 * Check if user can access a project
 */
async function canAccessProject(
  user: NonNullable<TrpcContext["user"]>,
  projectId: number
): Promise<boolean> {
  const project = await db.getProjectById(projectId);
  
  if (!project) {
    return false;
  }
  
  // Admin can access all projects
  if (user.role === "admin") {
    return true;
  }
  
  // Regular user can only access their own projects
  return project.createdBy === user.id;
}

/**
 * Verify project access and throw if unauthorized
 */
async function requireProjectAccess(
  user: NonNullable<TrpcContext["user"]>,
  projectId: number
): Promise<void> {
  const hasAccess = await canAccessProject(user, projectId);
  
  if (!hasAccess) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You don't have permission to access this project's files",
    });
  }
}

/**
 * Verify job exists and belongs to project
 */
async function verifyJobBelongsToProject(
  projectId: number,
  jobId: number
): Promise<void> {
  const job = await db.getProjectJobById(jobId);
  
  if (!job) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Job with id ${jobId} not found`,
    });
  }
  
  if (job.projectId !== projectId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Job ${jobId} does not belong to project ${projectId}`,
    });
  }
}

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

const presignUploadSchema = z.object({
  projectId: z.number(),
  jobId: z.number().optional().nullable(),
  filename: z.string().min(1, "Filename is required"),
  contentType: z.string().refine(validateMimeType, {
    message: `Invalid file type. Allowed types: images, PDFs, documents, spreadsheets, text files, and ZIP archives.`,
  }),
  fileSize: z.number().max(MAX_FILE_SIZE, `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`).optional(),
});

const registerFileSchema = z.object({
  projectId: z.number(),
  jobId: z.number().optional().nullable(),
  s3Key: z.string().min(1, "S3 key is required"),
  originalName: z.string().min(1, "Original filename is required"),
  mimeType: z.string().min(1, "MIME type is required"),
  fileSize: z.number().optional(),
});

const imageVariantEnum = z.enum(["thumb", "preview", "full"]);

const getPresignedUrlSchema = z.union([
  z.object({ fileId: z.number(), variant: imageVariantEnum.optional() }),
  z.object({ s3Key: z.string(), variant: imageVariantEnum.optional() }),
]);

// =============================================================================
// PROJECT FILES ROUTER
// =============================================================================

export const projectFilesRouter = router({
  /**
   * Generate a presigned URL for uploading a file directly to S3
   * 
   * The client should:
   * 1. Call this endpoint to get the presigned URL and S3 key
   * 2. PUT the file directly to the uploadUrl
   * 3. Call files.register to save the file metadata
   * 
   * @returns { uploadUrl: string, s3Key: string }
   */
  presignUpload: protectedProcedure
    .input(presignUploadSchema)
    .mutation(async ({ input, ctx }) => {
      // Verify project access
      await requireProjectAccess(ctx.user, input.projectId);

      if (shouldProcessImage(input.contentType, input.filename)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Direct uploads are disabled for images. Please use the server-side uploader.",
        });
      }
      
      // Verify job belongs to project if jobId is provided
      if (input.jobId) {
        await verifyJobBelongsToProject(input.projectId, input.jobId);
      }
      
      // Generate the S3 key
      const s3Key = generateProjectFileKey(
        input.projectId,
        input.jobId ?? null,
        input.filename
      );
      
      // Create presigned upload URL
      const { uploadUrl } = await createPresignedUploadUrl(
        s3Key,
        input.contentType,
        UPLOAD_URL_EXPIRY_SECONDS
      );
      
      return {
        uploadUrl,
        s3Key,
      };
    }),

  /**
   * Register a file in the database after it has been uploaded to S3
   * 
   * This should be called after the client has successfully uploaded
   * the file using the presigned URL from presignUpload.
   * 
   * @returns The stored file metadata
   */
  register: protectedProcedure
    .input(registerFileSchema)
    .mutation(async ({ input, ctx }) => {
      // Verify project access
      await requireProjectAccess(ctx.user, input.projectId);

      if (shouldProcessImage(input.mimeType, input.originalName)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Direct uploads are not supported for images. Please use the server-side uploader.",
        });
      }
      
      // Verify job belongs to project if jobId is provided
      if (input.jobId) {
        await verifyJobBelongsToProject(input.projectId, input.jobId);
      }
      
      // Verify the S3 key follows our expected pattern
      const expectedPrefix = `projects/${input.projectId}/`;
      if (!input.s3Key.startsWith(expectedPrefix)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid S3 key format - key must belong to the specified project",
        });
      }
      
      // Check if file is already registered (idempotency)
      const existingFile = await db.getFileMetadataByS3Key(input.s3Key);
      if (existingFile) {
        return {
          success: true,
          file: existingFile,
          alreadyRegistered: true,
        };
      }
      
      // Register the file in database
      const result = await db.createFileMetadata({
        projectId: input.projectId,
        jobId: input.jobId ?? null,
        s3Key: input.s3Key,
        originalName: input.originalName,
        mimeType: input.mimeType,
        fileSize: input.fileSize ?? null,
        uploadedBy: ctx.user.id,
      });
      
      // Fetch and return the created record
      const file = await db.getFileMetadataById(result[0].insertId);
      if (!file) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "File metadata not found after registration",
        });
      }
      
      return {
        success: true,
        file: await hydrateFileWithSignedUrls(file),
        alreadyRegistered: false,
      };
    }),

  /**
   * Get a presigned URL for viewing/downloading a file
   * 
   * Accepts either fileId or s3Key to identify the file.
   * Verifies the user has access to the project before returning the URL.
   * 
   * @returns { url: string, expiresIn: number }
   */
  getPresignedUrl: protectedProcedure
    .input(getPresignedUrlSchema)
    .query(async ({ input, ctx }) => {
      let file;
      const requestedVariant = "variant" in input ? input.variant : undefined;
      
      if ("fileId" in input) {
        file = await db.getFileMetadataById(input.fileId);
        if (!file) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `File with id ${input.fileId} not found`,
          });
        }
      } else {
        file = await db.getFileMetadataByS3Key(input.s3Key);
        if (!file) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `File with key ${input.s3Key} not found`,
          });
        }
      }
      
      // Verify project access
      await requireProjectAccess(ctx.user, file.projectId);
      const targetKey =
        requestedVariant && file.imageMetadata?.variants?.[requestedVariant]
          ? file.imageMetadata.variants[requestedVariant].key
          : file.s3Key;
      
      // Generate presigned read URL
      const url = await createPresignedReadUrl(targetKey, DOWNLOAD_URL_EXPIRY_SECONDS);
      
      return {
        url,
        expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS,
        file: await hydrateFileWithSignedUrls(file),
      };
    }),

  /**
   * Server-side image proxy (bypasses CORS)
   * 
   * Fetches the image from S3 and returns it as base64.
   * Use this when the browser can't directly fetch from S3 due to CORS restrictions.
   */
  getImageBlob: protectedProcedure
    .input(z.object({
      fileId: z.number(),
      variant: z.enum(["thumb", "preview", "full"]).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const file = await db.getFileMetadataById(input.fileId);
      
      if (!file) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `File with id ${input.fileId} not found`,
        });
      }
      
      // Verify project access
      await requireProjectAccess(ctx.user, file.projectId);
      
      // Determine which S3 key to fetch
      const requestedVariant = input.variant ?? "preview";
      const targetKey =
        file.imageMetadata?.variants?.[requestedVariant]?.key ?? file.s3Key;
      
      try {
        const { data, contentType } = await storageGet(targetKey);
        
        // Return as base64 for easy consumption by the client
        return {
          base64: data.toString("base64"),
          contentType,
          size: data.length,
        };
      } catch (error) {
        console.error("[ProjectFiles] Failed to fetch image from S3:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch image from storage",
        });
      }
    }),

  /**
   * List files for a project
   */
  listByProject: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireProjectAccess(ctx.user, input.projectId);
      const files = await db.getFilesByProjectId(input.projectId);
      return await Promise.all(files.map((file) => hydrateFileWithSignedUrls(file)));
    }),

  /**
   * List files for a specific job within a project
   */
  listByJob: protectedProcedure
    .input(z.object({ projectId: z.number(), jobId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireProjectAccess(ctx.user, input.projectId);
      await verifyJobBelongsToProject(input.projectId, input.jobId);
      const files = await db.getFilesByJobId(input.projectId, input.jobId);
      return await Promise.all(files.map((file) => hydrateFileWithSignedUrls(file)));
    }),

  /**
   * Delete a file from both S3 and the database
   */
  delete: protectedProcedure
    .input(z.object({ fileId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const file = await db.getFileMetadataById(input.fileId);
      
      if (!file) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `File with id ${input.fileId} not found`,
        });
      }
      
      // Verify project access
      await requireProjectAccess(ctx.user, file.projectId);
      
      // Delete from S3
      try {
        if (file.imageMetadata) {
          await deleteImageVariants(file.imageMetadata);
        } else {
          await deleteFromStorage(file.s3Key);
        }
      } catch (error) {
        console.error("[ProjectFiles] Failed to delete from S3:", error);
        // Continue with DB delete even if S3 delete fails
        // The S3 file will be orphaned but we don't want to leave stale DB records
      }
      
      // Delete from database
      await db.deleteFileMetadata(input.fileId);
      
      return { success: true };
    }),

  /**
   * Server-side upload (for when presigned URLs aren't suitable)
   * Accepts base64-encoded file data and uploads directly to S3
   * 
   * For images:
   * - Optimizes with high quality (92%)
   * - Converts HEIC/HEIF to JPEG for compatibility
   */
  upload: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      jobId: z.number().optional().nullable(),
      filename: z.string().min(1),
      mimeType: z.string(),
      base64Data: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      let { filename, mimeType } = input;
      
      // Validate MIME type
      if (!validateMimeType(mimeType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid file type",
        });
      }
      
      // Verify project access
      await requireProjectAccess(ctx.user, input.projectId);
      
      // Verify job belongs to project if jobId is provided
      if (input.jobId) {
        await verifyJobBelongsToProject(input.projectId, input.jobId);
      }
      
      // Convert base64 to buffer
      let buffer: Buffer = Buffer.from(input.base64Data, "base64");
      let fileSize = buffer.length;
      
      // Validate file size
      if (fileSize > MAX_FILE_SIZE) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `File size exceeds maximum of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        });
      }
      const isImageUpload = shouldProcessImage(mimeType, filename);
      let imageMetadata: StoredImageMetadata | null = null;
      let s3Key: string;
      
      if (isImageUpload) {
        const metadata = await processAndUploadImageVariants(buffer, { projectId: input.projectId });
        imageMetadata = metadata;
        mimeType = metadata.mimeType;
        fileSize = metadata.variants.full.size;
        s3Key = metadata.variants.full.key;
      } else {
        // Generate S3 key with potentially updated filename
        s3Key = generateProjectFileKey(
          input.projectId,
          input.jobId ?? null,
          filename
        );
        
        // Upload to S3
        await storagePut(s3Key, buffer, mimeType);
      }
      
      // Register in database
      const result = await db.createFileMetadata({
        projectId: input.projectId,
        jobId: input.jobId ?? null,
        s3Key,
        originalName: filename,
        mimeType,
        fileSize,
        uploadedBy: ctx.user.id,
        imageMetadata,
      });
      
      const file = await db.getFileMetadataById(result[0].insertId);
      if (!file) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "File metadata not found after upload",
        });
      }
      
      return {
        success: true,
        file: await hydrateFileWithSignedUrls(file),
      };
    }),
});
