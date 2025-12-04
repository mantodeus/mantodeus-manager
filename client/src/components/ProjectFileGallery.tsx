/**
 * Project File Gallery Component
 * 
 * Displays and manages files for a project:
 * - File upload via server-side upload (bypasses CORS)
 * - Image thumbnails with click-to-view in lightbox
 * - Non-image files with icons and view/download buttons
 * - Delete files
 * - Image lightbox with annotation/drawing tools
 */

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { 
  Upload, 
  Loader2, 
  FileText, 
  Image as ImageIcon, 
  File, 
  Trash2, 
  ExternalLink,
  Plus,
  Eye
} from "lucide-react";
import { toast } from "sonner";
import ProjectFileLightbox from "./ProjectFileLightbox";
import { compressImage } from "@/lib/imageCompression";

interface FileMetadata {
  id: number;
  projectId: number;
  jobId: number | null;
  s3Key: string;
  originalName: string;
  mimeType: string;
  fileSize: number | null;
  uploadedAt: Date;
}

interface ProjectFileGalleryProps {
  projectId: number;
  jobId?: number;
  files: FileMetadata[];
  isLoading: boolean;
}

// Convert file to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:xxx;base64, prefix
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Check if file is an image
function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function ProjectFileGallery({ projectId, jobId, files, isLoading }: ProjectFileGalleryProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [viewingFileId, setViewingFileId] = useState<number | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // Filter image files for the lightbox
  const imageFiles = files.filter(f => isImageFile(f.mimeType));

  // Server-side upload mutation (bypasses CORS - no direct S3 access from browser)
  const uploadFile = trpc.projects.files.upload.useMutation({
    onSuccess: () => {
      toast.success("File uploaded successfully");
      if (jobId) {
        utils.projects.files.listByJob.invalidate({ projectId, jobId });
      } else {
        utils.projects.files.listByProject.invalidate({ projectId });
      }
    },
    onError: (error) => {
      toast.error("Upload failed: " + error.message);
    },
  });

  const deleteFile = trpc.projects.files.delete.useMutation({
    onSuccess: () => {
      toast.success("File deleted successfully");
      if (jobId) {
        utils.projects.files.listByJob.invalidate({ projectId, jobId });
      } else {
        utils.projects.files.listByProject.invalidate({ projectId });
      }
    },
    onError: (error) => {
      toast.error("Failed to delete file: " + error.message);
    },
  });

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadStatus("");

    try {
      const totalFiles = selectedFiles.length;
      let completed = 0;
      let successCount = 0;

      for (const file of Array.from(selectedFiles)) {
        let fileToUpload = file;
        let mimeType = file.type;

        // For images, compress client-side before upload
        if (file.type.startsWith("image/") && file.type !== "image/gif") {
          setUploadStatus(`Compressing ${file.name}...`);
          
          const { file: compressedFile, wasCompressed, compressionRatio } = await compressImage(file, {
            maxSizeMB: 2,
            maxWidthOrHeight: 2560, // 2K resolution
          });

          if (wasCompressed) {
            console.log(`[Upload] Compressed ${file.name}: ${compressionRatio.toFixed(0)}% smaller`);
          }

          fileToUpload = compressedFile;
          mimeType = compressedFile.type || file.type;
        }

        // Validate file size after compression (50MB for non-images, 10MB for images)
        const sizeLimit = file.type.startsWith("image/") ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
        if (fileToUpload.size > sizeLimit) {
          const limitMB = sizeLimit / (1024 * 1024);
          toast.error(`${file.name}: File size must be less than ${limitMB}MB`);
          continue;
        }

        setUploadStatus(`Uploading ${file.name}...`);
        setUploadProgress(Math.round((completed + 0.5) / totalFiles * 100));

        // Convert file to base64
        const base64Data = await fileToBase64(fileToUpload);

        // Upload via server (server uploads to S3, no CORS needed)
        await uploadFile.mutateAsync({
          projectId,
          jobId: jobId || null,
          filename: file.name, // Keep original name
          mimeType,
          base64Data,
        });

        completed++;
        successCount++;
        setUploadProgress(Math.round(completed / totalFiles * 100));
      }

      if (successCount > 0) {
        toast.success(`${successCount} file${successCount > 1 ? 's' : ''} uploaded successfully`);
      }
    } catch (error) {
      console.error("Upload error:", error);
      const message = error instanceof Error ? error.message : "Failed to upload file";
      toast.error(message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadStatus("");
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [projectId, jobId, uploadFile]);

  const handleViewFile = async (file: FileMetadata) => {
    // For images, find the index in the image files array and open lightbox
    if (isImageFile(file.mimeType)) {
      const imageIndex = imageFiles.findIndex(f => f.id === file.id);
      if (imageIndex !== -1) {
        setSelectedImageIndex(imageIndex);
      }
      return;
    }

    // For non-image files, open in new tab
    try {
      setViewingFileId(file.id);
      // Use utils.client to fetch presigned URL on demand
      const result = await utils.client.projects.files.getPresignedUrl.query({ fileId: file.id });
      window.open(result.url, "_blank");
    } catch (error) {
      toast.error("Failed to get file URL");
    } finally {
      setViewingFileId(null);
    }
  };

  const handleDeleteFile = (fileId: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (confirm("Are you sure you want to delete this file?")) {
      deleteFile.mutate({ fileId });
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) {
      return <ImageIcon className="h-8 w-8 text-[#0D0E10]" />;
    } else if (mimeType === "application/pdf") {
      return <FileText className="h-8 w-8 text-red-500" />;
    } else {
      return <File className="h-8 w-8 text-muted-foreground" />;
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Files</h2>
        <div className="flex items-center gap-3">
          {uploading && uploadStatus && (
            <span className="text-sm text-muted-foreground max-w-[200px] truncate">
              {uploadStatus}
            </span>
          )}
          <div className="relative">
            <input
              type="file"
              ref={fileInputRef}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileSelect}
              disabled={uploading}
              accept="image/*,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
              multiple
            />
            <Button disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {uploadProgress}%
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Upload Files
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {files.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No files uploaded yet.</p>
            <div className="relative">
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileSelect}
                disabled={uploading}
                accept="image/*,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
                multiple
              />
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Upload First File
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {files.map((file) => {
            const isImage = isImageFile(file.mimeType);
            
            return (
              <Card 
                key={file.id} 
                className={`group overflow-hidden transition-shadow hover:shadow-md ${isImage ? 'cursor-pointer' : ''}`}
                onClick={() => isImage && handleViewFile(file)}
              >
                <CardContent className="p-0">
                  {isImage ? (
                    // Image thumbnail
                    <div className="relative aspect-square">
                      {/* Use thumbnail version for grid (400px for 2x displays) */}
                      <img
                        src={`/api/image-proxy?key=${encodeURIComponent(file.s3Key)}&w=400&q=80`}
                        alt={file.originalName}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewFile(file);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => handleDeleteFile(file.id, e)}
                          disabled={deleteFile.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {/* File name at bottom */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-2 truncate">
                        {file.originalName}
                      </div>
                    </div>
                  ) : (
                    // Non-image file card
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        {getFileIcon(file.mimeType)}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm" title={file.originalName}>
                            {file.originalName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.fileSize)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(file.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewFile(file)}
                          disabled={viewingFileId === file.id}
                          className="flex-1"
                        >
                          {viewingFileId === file.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <ExternalLink className="h-4 w-4 mr-1" />
                              View
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDeleteFile(file.id, e)}
                          disabled={deleteFile.isPending}
                          className="text-destructive hover:text-destructive"
                        >
                          {deleteFile.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Image Lightbox */}
      {selectedImageIndex !== null && imageFiles.length > 0 && (
        <ProjectFileLightbox
          files={imageFiles}
          initialIndex={selectedImageIndex}
          onClose={() => setSelectedImageIndex(null)}
          projectId={projectId}
          jobId={jobId}
        />
      )}
    </div>
  );
}
