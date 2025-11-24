import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ImageLightbox from "./ImageLightbox";

interface ImageGalleryProps {
  jobId: number;
}

export default function ImageGallery({ jobId }: ImageGalleryProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const utils = trpc.useUtils();
  const { data: images = [], isLoading } = trpc.images.listByJob.useQuery({ jobId });
  const uploadMutation = trpc.images.upload.useMutation({
    onSuccess: () => {
      utils.images.listByJob.invalidate({ jobId });
      toast.success("Image uploaded successfully");
      setIsUploading(false);
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
      setIsUploading(false);
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

    for (const file of Array.from(files)) {
      // Check file size (16MB limit)
      if (file.size > 16 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 16MB)`);
        continue;
      }

      // Read file as base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(",")[1];
        
        await uploadMutation.mutateAsync({
          jobId,
          filename: file.name,
          mimeType: file.type,
          fileSize: file.size,
          base64Data,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDelete = async (imageId: number) => {
    if (!confirm("Are you sure you want to delete this image?")) return;
    await deleteMutation.mutateAsync({ id: imageId });
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
        <div>
          <input
            type="file"
            id="image-upload"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          <Button
            onClick={() => document.getElementById("image-upload")?.click()}
            disabled={isUploading}
            size="sm"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
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
              <img
                src={`/api/image-proxy?url=${encodeURIComponent(image.url)}`}
                alt={image.caption || image.filename || "Job image"}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(image.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {image.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-2 truncate">
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
    </div>
  );
}
