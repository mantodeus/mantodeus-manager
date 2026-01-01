import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "@/components/ui/Icon";
import { toast } from "sonner";
import ImageLightbox from "./ImageLightbox";
import { compressImage } from "@/lib/imageCompression";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";

interface ImageGalleryProps {
  jobId: number;
  projectId?: number;
}

// Convert file to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ImageGallery({ jobId, projectId }: ImageGalleryProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; status: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: images = [], isLoading } = trpc.images.listByJob.useQuery({ jobId });
  
  // Server-side upload (bypasses CORS)
  const uploadImage = trpc.images.upload.useMutation({
    onSuccess: () => {
      utils.images.listByJob.invalidate({ jobId });
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });

  const deleteMutation = trpc.images.delete.useMutation({
    onSuccess: () => {
      utils.images.listByJob.invalidate({ jobId });
      toast.success("Image deleted successfully");
    },
    onError: (error) => {
      toast.error(`Delete failed: ${error.message}`);
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const fileList = Array.from(files);
    const total = fileList.length;
    let successCount = 0;

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        setUploadProgress({ current: i + 1, total, status: `Compressing ${file.name}...` });

        // Compress image client-side before upload (dramatically reduces size/time)
        const { file: compressedFile, wasCompressed, compressionRatio } = await compressImage(file, {
          maxSizeMB: 2,
          maxWidthOrHeight: 2560, // 2K resolution
        });

        if (wasCompressed) {
          console.log(`[Upload] Compressed ${file.name}: ${compressionRatio.toFixed(0)}% smaller`);
        }

        // Check file size after compression (10MB limit)
        if (compressedFile.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is too large even after compression (max 10MB)`);
          continue;
        }

        setUploadProgress({ current: i + 1, total, status: `Uploading ${file.name}...` });

        // Convert to base64 and upload via server
        const base64Data = await fileToBase64(compressedFile);
      await uploadImage.mutateAsync({
          jobId,
          taskId: undefined,
        projectId: projectId ?? null,
          filename: file.name,
          mimeType: compressedFile.type || file.type,
          fileSize: compressedFile.size,
          base64Data,
          caption: undefined,
        });
        successCount++;
      }
      
      if (successCount > 0) {
        toast.success(`${successCount} image${successCount > 1 ? 's' : ''} uploaded successfully`);
      }
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to upload images";
      toast.error(message);
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleItemAction = async (action: ItemAction, imageId: number) => {
    if (action === "duplicate") {
      toast.info("Duplicate is coming soon.");
    }
    if (action === "delete") {
      setImageToDelete(imageId);
      setDeleteDialogOpen(true);
    }
  };

  const confirmDeleteImage = async () => {
    if (imageToDelete !== null) {
      await deleteMutation.mutateAsync({ id: imageToDelete });
      setImageToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Images ({images.length})</h3>
        <div className="flex items-center gap-3">
          {uploadProgress && (
            <span className="text-sm text-muted-foreground">
              {uploadProgress.current}/{uploadProgress.total}: {uploadProgress.status}
            </span>
          )}
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="image/*,.heic,.heif"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            size="sm"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {uploadProgress ? `${uploadProgress.current}/${uploadProgress.total}` : 'Uploading...'}
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Images
              </>
            )}
          </Button>
        </div>
      </div>

      {images.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">No images yet. Upload some to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image, index) => (
            <div
              key={image.id}
              className="relative group aspect-square rounded-lg overflow-hidden border bg-muted cursor-pointer"
              onClick={() => setSelectedImageIndex(index)}
            >
              {/* Use thumbnail version for grid (400px, good for 2x displays) */}
              {image.imageUrls?.thumb ? (
                <img
                  src={image.imageUrls.thumb}
                  alt={image.caption || image.filename || "Job image"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                  Preview unavailable
                </div>
              )}
              <div
                className="absolute inset-0 opacity-0 transition-opacity pointer-events-none group-hover:opacity-100"
                style={{ background: 'var(--overlay-light)' }}
                aria-hidden="true"
              />
              <div className="absolute top-2 right-2 z-10">
                <ItemActionsMenu
                  onAction={(action) => handleItemAction(action, image.id)}
                  actions={["duplicate", "delete"]}
                  triggerClassName="bg-background/90 hover:bg-background shadow-sm"
                />
              </div>
              {image.caption && (
                <div className="absolute bottom-0 left-0 right-0 text-white text-xs p-2 truncate" style={{ background: 'var(--overlay-medium)' }}>
                  {image.caption}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedImageIndex !== null && (
        <ImageLightbox
          images={images}
          initialIndex={selectedImageIndex}
          onClose={() => setSelectedImageIndex(null)}
          jobId={jobId}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {imageToDelete !== null && (
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) {
              setImageToDelete(null);
            }
          }}
          onConfirm={confirmDeleteImage}
          title="Delete Image"
          description="This action cannot be undone. This image will be permanently deleted from storage."
          confirmLabel="Delete Image"
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
