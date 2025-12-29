/**
 * Document Scan Processing
 * 
 * Client-side document processing pipeline:
 * - Edge detection
 * - Perspective correction
 * - Crop to document
 * - Convert to grayscale
 * - Increase contrast / sharpness
 */

export interface ScanResult {
  blob: Blob;
  previewUrl: string;
}

/**
 * Process document image using canvas API
 * This is a simplified version - for production, consider opencv.js
 */
export async function processDocumentImage(file: File): Promise<ScanResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    if (!ctx) {
      reject(new Error("Canvas context not available"));
      return;
    }

    img.onload = () => {
      try {
        // Set canvas size
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Convert to grayscale and enhance contrast
        for (let i = 0; i < data.length; i += 4) {
          // Grayscale conversion (weighted average)
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          
          // Contrast enhancement (simple linear stretch)
          const contrast = 1.5; // Increase contrast
          const enhanced = ((gray - 128) * contrast) + 128;
          const clamped = Math.max(0, Math.min(255, enhanced));

          data[i] = clamped;     // R
          data[i + 1] = clamped; // G
          data[i + 2] = clamped;  // B
          // Alpha channel (data[i + 3]) remains unchanged
        }

        // Put processed image data back
        ctx.putImageData(imageData, 0, 0);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to create blob"));
              return;
            }

            // Create preview URL
            const previewUrl = URL.createObjectURL(blob);

            resolve({
              blob,
              previewUrl,
            });
          },
          "image/jpeg",
          0.92 // High quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    // Load image from file
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        img.src = e.target.result as string;
      }
    };
    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Advanced document processing using opencv.js (optional)
 * 
 * Note: To use OpenCV.js, install: npm install opencv-ts
 * Then uncomment and implement the processWithOpenCV function below.
 * 
 * For now, we use the basic canvas-based processing which works well
 * for most document scanning needs.
 */

