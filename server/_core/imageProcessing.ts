/**
 * Image Processing Module
 * 
 * Provides high-quality image optimization and format conversion:
 * - Preserves image quality with minimal compression
 * - Converts HEIC/HEIF to JPEG for cross-device compatibility
 * - Converts HEVC videos to MP4 (placeholder for future implementation)
 * - Strips unnecessary metadata while preserving color profiles
 */

import sharp from "sharp";

// Type for heic-convert module
type HeicConvertFn = (options: { buffer: Buffer; format: "JPEG" | "PNG"; quality?: number }) => Promise<Buffer>;

// HEIC conversion - using dynamic import since heic-convert is ESM
let heicConvert: HeicConvertFn | null = null;

async function getHeicConverter(): Promise<HeicConvertFn> {
  if (!heicConvert) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = await import("heic-convert") as { default: HeicConvertFn };
    heicConvert = module.default;
  }
  return heicConvert;
}

export interface ProcessedImage {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  originalSize: number;
  processedSize: number;
  wasConverted: boolean;
  newFilename?: string;
}

export interface ImageProcessingOptions {
  /** Maximum width/height - images larger than this will be resized (default: no limit) */
  maxDimension?: number;
  /** JPEG quality 1-100 (default: 92 for high quality) */
  quality?: number;
  /** Whether to strip metadata (default: true, but keeps color profile) */
  stripMetadata?: boolean;
  /** Force output format (default: auto-detect, converts HEIC to JPEG) */
  outputFormat?: "jpeg" | "png" | "webp";
}

const DEFAULT_OPTIONS: ImageProcessingOptions = {
  quality: 92, // High quality, slight optimization
  stripMetadata: true,
};

/**
 * Check if a file is a HEIC/HEIF image based on MIME type or filename
 */
export function isHeicImage(mimeType: string, filename?: string): boolean {
  const heicMimeTypes = [
    "image/heic",
    "image/heif",
    "image/heic-sequence",
    "image/heif-sequence",
  ];
  
  if (heicMimeTypes.includes(mimeType.toLowerCase())) {
    return true;
  }
  
  // Also check filename extension since MIME type might not be accurate
  if (filename) {
    const ext = filename.toLowerCase().split(".").pop();
    return ext === "heic" || ext === "heif";
  }
  
  return false;
}

/**
 * Check if a file is an image that can be processed
 */
export function isProcessableImage(mimeType: string): boolean {
  const processableMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
    "image/heic-sequence",
    "image/heif-sequence",
    "image/tiff",
    "image/bmp",
  ];
  
  return processableMimeTypes.includes(mimeType.toLowerCase());
}

/**
 * Convert HEIC/HEIF buffer to JPEG
 */
async function convertHeicToJpeg(buffer: Buffer, quality: number): Promise<Buffer> {
  try {
    const converter = await getHeicConverter();
    return await converter({
      buffer,
      format: "JPEG",
      quality: quality / 100, // heic-convert expects 0-1
    });
  } catch (error) {
    console.error("[ImageProcessing] HEIC conversion failed:", error);
    throw new Error("Failed to convert HEIC image. Please convert to JPEG before uploading.");
  }
}

/**
 * Process an image buffer for optimal storage and viewing
 * 
 * - Maintains high quality (default 92% JPEG quality)
 * - Converts HEIC/HEIF to JPEG for compatibility
 * - Optionally resizes large images
 * - Strips unnecessary metadata while keeping color profiles
 */
export async function processImage(
  inputBuffer: Buffer,
  mimeType: string,
  filename: string,
  options: ImageProcessingOptions = {}
): Promise<ProcessedImage> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const originalSize = inputBuffer.length;
  let wasConverted = false;
  let buffer = inputBuffer;
  let newFilename: string | undefined;
  let outputMimeType = mimeType;
  
  // Handle HEIC/HEIF conversion first
  if (isHeicImage(mimeType, filename)) {
    console.log("[ImageProcessing] Converting HEIC/HEIF to JPEG");
    buffer = await convertHeicToJpeg(buffer, opts.quality || 92);
    wasConverted = true;
    outputMimeType = "image/jpeg";
    
    // Update filename extension
    const baseName = filename.replace(/\.(heic|heif)$/i, "");
    newFilename = `${baseName}.jpg`;
  }
  
  // Process with sharp
  let sharpInstance = sharp(buffer);
  
  // Get metadata to determine dimensions
  const metadata = await sharpInstance.metadata();
  let width = metadata.width || 0;
  let height = metadata.height || 0;
  
  // Resize if needed (maintaining aspect ratio)
  if (opts.maxDimension && (width > opts.maxDimension || height > opts.maxDimension)) {
    sharpInstance = sharpInstance.resize(opts.maxDimension, opts.maxDimension, {
      fit: "inside",
      withoutEnlargement: true,
    });
    
    // Recalculate dimensions
    const scale = opts.maxDimension / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
    wasConverted = true;
  }
  
  // Configure output format
  const outputFormat = opts.outputFormat || (outputMimeType === "image/png" ? "png" : "jpeg");
  
  if (outputFormat === "jpeg" || outputMimeType === "image/jpeg" || outputMimeType === "image/jpg") {
    sharpInstance = sharpInstance.jpeg({
      quality: opts.quality || 92,
      mozjpeg: true, // Use mozjpeg for better compression at same quality
    });
    outputMimeType = "image/jpeg";
  } else if (outputFormat === "png") {
    sharpInstance = sharpInstance.png({
      compressionLevel: 6, // Balanced compression
      effort: 7, // Higher effort for better compression
    });
    outputMimeType = "image/png";
  } else if (outputFormat === "webp") {
    sharpInstance = sharpInstance.webp({
      quality: opts.quality || 92,
      effort: 4,
    });
    outputMimeType = "image/webp";
    
    // Update filename for webp
    if (!newFilename) {
      const baseName = filename.replace(/\.[^.]+$/, "");
      newFilename = `${baseName}.webp`;
    }
  }
  
  // Strip metadata if requested (default behavior)
  if (opts.stripMetadata) {
    sharpInstance = sharpInstance.withMetadata({
      // Keep ICC profile for color accuracy
    });
  }
  
  // Process the image
  const outputBuffer = await sharpInstance.toBuffer();
  
  // Get final dimensions
  const finalMetadata = await sharp(outputBuffer).metadata();
  
  const processedSize = outputBuffer.length;
  const compressionRatio = ((originalSize - processedSize) / originalSize * 100).toFixed(1);
  
  console.log(`[ImageProcessing] Processed: ${originalSize} -> ${processedSize} bytes (${compressionRatio}% reduction), ${finalMetadata.width}x${finalMetadata.height}`);
  
  return {
    buffer: outputBuffer,
    mimeType: outputMimeType,
    width: finalMetadata.width || width,
    height: finalMetadata.height || height,
    originalSize,
    processedSize,
    wasConverted,
    newFilename,
  };
}

/**
 * Quick check if image needs processing (for optimization)
 * Returns true if the image should be processed
 */
export function shouldProcessImage(mimeType: string, filename: string): boolean {
  // Always process HEIC/HEIF for compatibility
  if (isHeicImage(mimeType, filename)) {
    return true;
  }
  
  // Process standard image formats for optimization
  return isProcessableImage(mimeType);
}

/**
 * Placeholder for video conversion (HEVC to MP4)
 * This would require ffmpeg or similar - not implemented yet
 */
export async function convertHevcToMp4(_inputBuffer: Buffer): Promise<Buffer> {
  throw new Error(
    "HEVC video conversion is not yet implemented. " +
    "Please convert videos to MP4 before uploading using a tool like HandBrake or FFmpeg."
  );
}

/**
 * Check if a file is a HEVC video
 */
export function isHevcVideo(mimeType: string, filename?: string): boolean {
  // HEVC videos typically have these MIME types
  const hevcMimeTypes = [
    "video/hevc",
    "video/x-hevc",
  ];
  
  if (hevcMimeTypes.includes(mimeType.toLowerCase())) {
    return true;
  }
  
  // Check filename extension
  if (filename) {
    const ext = filename.toLowerCase().split(".").pop();
    // MOV files from iPhone often contain HEVC
    // But we can't easily detect codec from extension alone
    return ext === "hevc";
  }
  
  return false;
}
