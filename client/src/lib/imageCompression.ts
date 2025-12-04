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
  /** Maximum file size in MB (default: 2) */
  maxSizeMB?: number;
  /** Maximum width/height in pixels (default: 2560 for 2K) */
  maxWidthOrHeight?: number;
  /** Use WebWorker for non-blocking compression (default: true) */
  useWebWorker?: boolean;
  /** Preserve EXIF orientation (default: true) */
  preserveExif?: boolean;
  /** File types to compress (default: image/jpeg, image/png, image/webp) */
  fileType?: string;
}

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  wasCompressed: boolean;
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxSizeMB: 2,
  maxWidthOrHeight: 2560, // 2K resolution - good balance of quality and size
  useWebWorker: true,
  preserveExif: true,
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

  // Skip compression for already small files (< 500KB)
  if (originalSize < 500 * 1024) {
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
    const compressedFile = await imageCompression(file, {
      maxSizeMB: opts.maxSizeMB!,
      maxWidthOrHeight: opts.maxWidthOrHeight!,
      useWebWorker: opts.useWebWorker!,
      preserveExif: opts.preserveExif!,
      fileType: opts.fileType,
    });

    const compressedSize = compressedFile.size;
    const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

    console.log(
      `[ImageCompression] ${file.name}: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (${compressionRatio.toFixed(1)}% smaller)`
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
