/**
 * Image Pipeline Utilities
 *
 * Generates responsive image variants (thumb/preview/full) using Sharp,
 * persists them to S3, and returns metadata used by tRPC routers when
 * registering uploads or issuing signed URLs.
 */
import sharp from "sharp";
import { getPublicUrl, storagePut, deleteMultipleFromStorage, createPresignedReadUrl } from "../storage";
import type { StoredImageMetadata, ImageVariantRecord } from "../../drizzle/schema";

export type ImageVariant = "thumb" | "preview" | "full";

const JPEG_OUTPUT_OPTIONS: sharp.JpegOptions = {
  quality: 80,
  mozjpeg: true,
  chromaSubsampling: "4:4:4",
};

const VARIANT_CONFIG: Record<ImageVariant, { max: number; filename: string }> = {
  thumb: { max: 300, filename: "thumb_300.jpg" },
  preview: { max: 1200, filename: "preview_1200.jpg" },
  full: { max: 2000, filename: "full.jpg" },
};

const VARIANT_KEYS = Object.keys(VARIANT_CONFIG) as ImageVariant[];

function normalizeImageMetadata(
  metadata: StoredImageMetadata | string | null | undefined
): StoredImageMetadata | null {
  if (!metadata) return null;

  let parsed: unknown = metadata;

  if (typeof metadata === "string") {
    try {
      parsed = JSON.parse(metadata);
    } catch (error) {
      console.warn("[ImagePipeline] Failed to parse stored image metadata:", error);
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const candidate = parsed as Partial<StoredImageMetadata>;
  const variants = candidate.variants as Partial<Record<ImageVariant, ImageVariantRecord>> | undefined;
  if (!variants) {
    return null;
  }

  const hasAllVariants = VARIANT_KEYS.every((variant) => {
    const record = variants[variant];
    return Boolean(record && typeof record.key === "string");
  });

  if (!hasAllVariants) {
    return null;
  }

  return candidate as StoredImageMetadata;
}

function buildBaseName(projectId: number | null): string {
  const idPart = typeof projectId === "number" && projectId > 0 ? projectId : "legacy";
  return `project_${idPart}_${Date.now()}`;
}

function buildBaseDirectory(baseName: string, projectId: number | null, prefix?: string): string {
  const safePrefix = prefix ?? (typeof projectId === "number" && projectId > 0 ? `projects/${projectId}/images` : "legacy/images");
  return `${safePrefix}/${baseName}`;
}

async function generateVariantRecord(
  baseSharp: sharp.Sharp,
  key: string,
  maxDimension: number
): Promise<ImageVariantRecord> {
  const buffer = await baseSharp
    .clone()
    .resize(maxDimension, maxDimension, { fit: "inside", withoutEnlargement: true })
    .jpeg(JPEG_OUTPUT_OPTIONS)
    .toBuffer();

  const metadata = await sharp(buffer).metadata();

  await storagePut(key, buffer, "image/jpeg");

  return {
    key,
    url: getPublicUrl(key),
    width: metadata.width ?? maxDimension,
    height: metadata.height ?? maxDimension,
    size: buffer.length,
  };
}

export interface ImagePipelineOptions {
  projectId: number | null;
  keyPrefix?: string;
}

/**
 * Process an uploaded image buffer into responsive variants and upload them to storage.
 * Returns structured metadata that can be stored with the file record.
 */
export async function processAndUploadImageVariants(
  buffer: Buffer,
  { projectId, keyPrefix }: ImagePipelineOptions
): Promise<StoredImageMetadata> {
  const baseName = buildBaseName(projectId);
  const baseDir = buildBaseDirectory(baseName, projectId, keyPrefix);

  const sharpInstance = sharp(buffer).rotate();

  const [thumb, preview, full] = await Promise.all([
    generateVariantRecord(sharpInstance, `${baseDir}/${VARIANT_CONFIG.thumb.filename}`, VARIANT_CONFIG.thumb.max),
    generateVariantRecord(sharpInstance, `${baseDir}/${VARIANT_CONFIG.preview.filename}`, VARIANT_CONFIG.preview.max),
    generateVariantRecord(sharpInstance, `${baseDir}/${VARIANT_CONFIG.full.filename}`, VARIANT_CONFIG.full.max),
  ]);

  return {
    baseName,
    mimeType: "image/jpeg",
    createdAt: new Date().toISOString(),
    variants: {
      thumb,
      preview,
      full,
    },
  };
}

export async function deleteImageVariants(
  metadata: StoredImageMetadata | string | null | undefined
): Promise<void> {
  const normalized = normalizeImageMetadata(metadata);
  if (!normalized) return;
  const keys = VARIANT_KEYS.map((variant) => normalized.variants[variant].key);
  await deleteMultipleFromStorage(keys);
}

export async function generateSignedVariantUrls(
  metadata: StoredImageMetadata | string | null | undefined,
  expiresInSeconds = 60 * 60
): Promise<Record<ImageVariant, string> | null> {
  const normalized = normalizeImageMetadata(metadata);
  if (!normalized) return null;
  const entries = await Promise.all(
    VARIANT_KEYS.map(async (variant) => {
      const variantKey = normalized.variants[variant].key;
      const url = await createPresignedReadUrl(variantKey, expiresInSeconds);
      return [variant, url] as const;
    })
  );

  return Object.fromEntries(entries) as Record<ImageVariant, string>;
}
