import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";

interface ImageUploadProps {
  jobId?: number;
  taskId?: number;
}

export function ImageUpload({ jobId, taskId }: ImageUploadProps) {
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const getUploadUrl = trpc.images.getUploadUrl.useMutation();
  const confirmUpload = trpc.images.confirmUpload.useMutation({
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
    },
    onError: (error) => {
      toast.error("Failed to save image metadata: " + error.message);
      setUploading(false);
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

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image size must be less than 10MB");
      return;
    }

    setUploading(true);

    try {
      // Step 1: ask the server for a presigned upload URL
      const { uploadUrl, fileKey, publicUrl } = await getUploadUrl.mutateAsync({
        jobId,
        taskId,
        filename: file.name,
        mimeType: file.type,
      });

      // Step 2: upload directly to S3 using the presigned URL
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        const message = await uploadResponse.text().catch(() => uploadResponse.statusText);
        throw new Error(`Upload failed: ${uploadResponse.status} ${message}`);
      }

      // Step 3: confirm upload and save metadata in our database
      await confirmUpload.mutateAsync({
        jobId,
        taskId,
        fileKey,
        url: publicUrl,
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
        caption: caption.trim() || undefined,
      });
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to upload image";
      toast.error(message);
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="caption">Caption (optional)</Label>
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
                accept="image/*"
                ref={fileInputRef}
                onChange={handleFileChange}
                disabled={uploading}
                className="flex-1"
              />
              <Button disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Max file size: 10MB. Supported formats: JPG, PNG, GIF, WebP</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
