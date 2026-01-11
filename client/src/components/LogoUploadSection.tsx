/**
 * LogoUploadSection Component
 *
 * Handles company logo upload with:
 * - Image preview (current logo or placeholder)
 * - Drag-and-drop zone
 * - File validation (PNG/JPG/SVG, max 5MB)
 * - Client-side compression
 * - Upload progress indicator
 * - Delete functionality
 */

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Upload, Loader2, Trash2, Image as ImageIcon } from "@/components/ui/Icon";
import { compressImage } from "@/lib/imageCompression";

// Convert file to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result); // Keep the full data URL for display
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function LogoUploadSection() {
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  // Get company settings to check for existing logo
  const { data: settings } = trpc.settings.get.useQuery();

  // Upload mutation
  const uploadMutation = trpc.settings.uploadLogo.useMutation({
    onSuccess: (data) => {
      toast.success("Logo uploaded successfully");
      setPreviewUrl(data.logoUrl);
      utils.settings.get.invalidate();
      setUploading(false);
      setUploadStatus("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onError: (error) => {
      toast.error("Upload failed: " + error.message);
      setUploading(false);
      setUploadStatus("");
    },
  });

  // Delete mutation
  const deleteMutation = trpc.settings.deleteLogo.useMutation({
    onSuccess: () => {
      toast.success("Logo deleted successfully");
      setPreviewUrl(null);
      utils.settings.get.invalidate();
    },
    onError: (error) => {
      toast.error("Delete failed: " + error.message);
    },
  });

  const handleFileSelect = async (file: File) => {
    // Validate file type
    const ext = file.name.split(".").pop()?.toLowerCase();
    const allowedTypes = ["png", "jpg", "jpeg", "svg"];
    if (!ext || !allowedTypes.includes(ext)) {
      toast.error("Invalid file type. Only PNG, JPG, and SVG are allowed.");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setUploading(true);
    setUploadStatus("Compressing...");

    try {
      // Compress image client-side before upload
      const { file: compressedFile, wasCompressed } = await compressImage(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 800, // Server will resize to max 800x800 anyway
      });

      if (wasCompressed) {
        console.log("[Logo Upload] Image compressed");
      }

      setUploadStatus("Uploading...");

      // Convert file to base64
      const base64Data = await fileToBase64(compressedFile);

      // Upload via server
      await uploadMutation.mutateAsync({
        base64Image: base64Data,
        filename: file.name,
      });
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to upload logo";
      toast.error(message);
      setUploading(false);
      setUploadStatus("");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    await handleFileSelect(file);
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete the logo?")) {
      return;
    }
    await deleteMutation.mutateAsync();
  };

  const currentLogoUrl = previewUrl || settings?.logoUrl;
  
  // Check if logo is PNG or SVG (transparent-capable formats)
  // Server always outputs PNG, so we show checkered pattern for all logos
  // (PNGs can have transparency, and if they don't, the pattern will be hidden by the opaque image)
  const isTransparentFormat = !!currentLogoUrl;

  return (
    <div className="space-y-4">
      {/* Preview */}
      <div className="flex items-center justify-center w-full">
        <div
          className={`relative w-full max-w-md h-48 border-2 border-dashed rounded-lg flex items-center justify-center ${
            isTransparentFormat 
              ? 'bg-transparent'
              : 'bg-muted/20'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {currentLogoUrl ? (
            <img
              src={currentLogoUrl}
              alt="Company Logo"
              className="max-w-full max-h-full object-contain p-4"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImageIcon className="h-12 w-12" />
              <p className="text-sm">No logo uploaded</p>
            </div>
          )}
          {isDragging && (
            <div className="absolute inset-0 bg-primary/10 border-2 border-primary rounded-lg flex items-center justify-center">
              <p className="text-primary font-medium">Drop image here</p>
            </div>
          )}
        </div>
      </div>

      {/* Upload Controls */}
      <div className="flex gap-2">
        <Input
          id="logo"
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/svg+xml"
          ref={fileInputRef}
          onChange={handleFileChange}
          disabled={uploading || deleteMutation.isPending}
          className="hidden"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || deleteMutation.isPending}
          variant="outline"
          className="flex-1"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {uploadStatus || "Uploading..."}
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              {currentLogoUrl ? "Replace Logo" : "Upload Logo"}
            </>
          )}
        </Button>
        {currentLogoUrl && (
          <Button
            onClick={handleDelete}
            disabled={uploading || deleteMutation.isPending}
            variant="destructive-outline"
          >
            {deleteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Help Text */}
      <p className="text-xs text-muted-foreground">
        Square logos (1:1) work best. PNG or SVG recommended. Max 5MB. Processed to 512×512px.
      </p>
    </div>
  );
}
