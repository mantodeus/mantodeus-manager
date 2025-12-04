/**
 * Client-side Image Compression Utility
 * 
 * Compresses images before upload to dramatically reduce:
 * - Upload time (smaller files = faster transfer)
 * - Server processing time
 * - Storage costs
 * 
 * Uses browser-image-compression which leverages Canvas API
 * for efficient client-side compression.
 */

import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
  /** Maximum file size in MB (default: 0.8 ~ 800KB) */
  maxSizeMB?: number;
  /** Maximum width/height in pixels (default: 2000px longest edge) */
  maxWidthOrHeight?: number;
  /** Use WebWorker for non-blocking compression (default: true) */
  useWebWorker?: boolean;
  /** Target output format (default: force JPEG for consistency) */
  fileType?: string;
  /** Initial quality hint (0-1) */
  initialQuality?: number;
}

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  wasCompressed: boolean;
}

const TARGET_MIN_BYTES = 300 * 1024; // 300KB
const TARGET_MAX_BYTES = 800 * 1024; // 800KB

const DEFAULT_OPTIONS: CompressionOptions = {
  maxSizeMB: TARGET_MAX_BYTES / (1024 * 1024),
  maxWidthOrHeight: 2000,
  useWebWorker: true,
  fileType: "image/jpeg",
  initialQuality: 0.82,
};

/**
 * Compress an image file before upload
 * 
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Compressed file with metadata
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const originalSize = file.size;

  // Skip compression for tiny files
  if (originalSize < TARGET_MIN_BYTES) {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0,
      wasCompressed: false,
    };
  }

  // Skip compression for non-image files
  if (!file.type.startsWith('image/')) {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0,
      wasCompressed: false,
    };
  }

  // Skip GIFs as they may be animated
  if (file.type === 'image/gif') {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0,
      wasCompressed: false,
    };
  }

  try {
    let quality = opts.initialQuality ?? DEFAULT_OPTIONS.initialQuality!;
    let compressedFile = await imageCompression(file, {
      maxSizeMB: opts.maxSizeMB!,
      maxWidthOrHeight: opts.maxWidthOrHeight!,
      useWebWorker: opts.useWebWorker!,
      fileType: opts.fileType,
      initialQuality: quality,
    });

    while (compressedFile.size > TARGET_MAX_BYTES && quality > 0.6) {
      quality = parseFloat((quality - 0.05).toFixed(2));
      compressedFile = await imageCompression(file, {
        maxSizeMB: opts.maxSizeMB!,
        maxWidthOrHeight: opts.maxWidthOrHeight!,
        useWebWorker: opts.useWebWorker!,
        fileType: opts.fileType,
        initialQuality: quality,
      });
    }

    const compressedSize = compressedFile.size;
    const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

    console.log(
      `[ImageCompression] ${file.name}: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (${compressionRatio.toFixed(1)}% smaller, q=${quality})`
    );

    return {
      file: compressedFile,
      originalSize,
      compressedSize,
      compressionRatio,
      wasCompressed: true,
    };
  } catch (error) {
    console.error('[ImageCompression] Failed, using original:', error);
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0,
      wasCompressed: false,
    };
  }
}

/**
 * Compress multiple images in parallel
 */
export async function compressImages(
  files: File[],
  options: CompressionOptions = {}
): Promise<CompressionResult[]> {
  return Promise.all(files.map(file => compressImage(file, options)));
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Get estimated upload time based on file size
 * Assumes 2 Mbps upload speed (conservative mobile estimate)
 */
export function estimateUploadTime(bytes: number, speedMbps: number = 2): string {
  const bits = bytes * 8;
  const seconds = bits / (speedMbps * 1000000);
  
  if (seconds < 1) return 'instant';
  if (seconds < 60) return `~${Math.ceil(seconds)}s`;
  return `~${Math.ceil(seconds / 60)}min`;
}
