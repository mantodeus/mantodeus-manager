/**
 * Receipt Image Processing
 * 
 * Client-side image enhancement pipeline:
 * - Convert to grayscale
 * - Increase contrast
 */

export interface ScanResult {
  blob: Blob;
  previewUrl: string;
}

/**
 * Process receipt image using canvas API
 * This is a simplified version - for real document detection, use opencv.js
 */
export async function processDocumentImage(file: File): Promise<ScanResult> {
  return new Promise((resolve, reject) => {
    console.log("[documentScan] Starting processing for file:", file.name, file.type, file.size);
    
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    if (!ctx) {
      const error = new Error("Canvas context not available");
      console.error("[documentScan] Canvas error:", error);
      reject(error);
      return;
    }

    img.onload = () => {
      try {
        console.log("[documentScan] Image loaded, dimensions:", img.width, "x", img.height);
        
        // Set canvas size
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        console.log("[documentScan] Processing", data.length / 4, "pixels");

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

        console.log("[documentScan] Image processing complete, converting to blob");

        // Put processed image data back
        ctx.putImageData(imageData, 0, 0);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              const error = new Error("Failed to create blob");
              console.error("[documentScan] Blob creation failed:", error);
              reject(error);
              return;
            }

            // Create preview URL
            const previewUrl = URL.createObjectURL(blob);
            console.log("[documentScan] Processing complete, blob size:", blob.size, "preview URL created");

            resolve({
              blob,
              previewUrl,
            });
          },
          "image/jpeg",
          0.92 // High quality
        );
      } catch (error) {
        console.error("[documentScan] Processing error:", error);
        reject(error);
      }
    };

    img.onerror = (e) => {
      const error = new Error("Failed to load image");
      console.error("[documentScan] Image load error:", error, e);
      reject(error);
    };

    // Load image from file
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        console.log("[documentScan] File read complete, loading image");
        img.src = e.target.result as string;
      } else {
        const error = new Error("FileReader result is null");
        console.error("[documentScan] FileReader error:", error);
        reject(error);
      }
    };
    reader.onerror = (e) => {
      const error = new Error("Failed to read file");
      console.error("[documentScan] FileReader error:", error, e);
      reject(error);
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
 * For now, we use basic grayscale + contrast enhancement.
 */

