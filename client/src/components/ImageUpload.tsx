import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Upload, Loader2 } from "@/components/ui/Icon";
import { compressImage } from "@/lib/imageCompression";

interface ImageUploadProps {
  jobId?: number;
  taskId?: number;
  projectId?: number;
}

// Convert file to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:image/xxx;base64, prefix
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ImageUpload({ jobId, taskId, projectId }: ImageUploadProps) {
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  
  // Server-side upload (bypasses CORS - no direct S3 access from browser)
  const uploadImage = trpc.images.upload.useMutation({
    onSuccess: () => {
      toast.success("Image uploaded successfully");
      if (jobId) {
        utils.images.listByJob.invalidate({ jobId });
      }
      if (taskId) {
        utils.images.listByTask.invalidate({ taskId });
      }
      setCaption("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setUploading(false);
      setUploadStatus("");
    },
    onError: (error) => {
      toast.error("Upload failed: " + error.message);
      setUploading(false);
      setUploadStatus("");
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setUploading(true);
    setUploadStatus("Compressing...");

    try {
      // Compress image client-side before upload (dramatically reduces size/time)
      const { file: compressedFile, wasCompressed, compressionRatio } = await compressImage(file, {
        maxSizeMB: 2,
        maxWidthOrHeight: 2560, // 2K resolution
      });

      if (wasCompressed) {
        console.log(`[Upload] Compressed: ${compressionRatio.toFixed(0)}% smaller`);
      }

      // Validate file size after compression (max 10MB)
      if (compressedFile.size > 10 * 1024 * 1024) {
        toast.error("Image size must be less than 10MB (even after compression)");
        setUploading(false);
        setUploadStatus("");
        return;
      }

      setUploadStatus("Uploading...");

      // Convert file to base64
      const base64Data = await fileToBase64(compressedFile);

      // Upload via server (server uploads to S3, no CORS needed)
      await uploadImage.mutateAsync({
        jobId,
        taskId,
        projectId,
        filename: file.name, // Keep original name
        mimeType: compressedFile.type || file.type,
        fileSize: compressedFile.size,
        base64Data,
        caption: caption.trim() || undefined,
      });
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to upload image";
      toast.error(message);
      setUploading(false);
      setUploadStatus("");
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="caption">Caption</Label>
            <Input
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a description for this image"
              disabled={uploading}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="image">Select Image</Label>
            <div className="flex gap-2">
            <Input
              id="image"
              type="file"
              accept="image/*,.heic,.heif"
              ref={fileInputRef}
              onChange={handleFileChange}
              disabled={uploading}
              className="flex-1"
            />
              <Button disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {uploadStatus || "Uploading..."}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Max file size: 10MB. Supported formats: JPG, PNG, GIF, WebP, HEIC/HEIF (auto-converted)</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
