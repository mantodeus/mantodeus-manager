/**
 * Project File Gallery Component
 * 
 * Displays and manages files for a project:
 * - File upload via server-side upload (bypasses CORS)
 * - File list with previews
 * - View files with presigned URLs
 * - Delete files
 */

import { useState, useCallback } from "react";
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
  Plus
} from "lucide-react";
import { toast } from "sonner";

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

export function ProjectFileGallery({ projectId, jobId, files, isLoading }: ProjectFileGalleryProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [viewingFileId, setViewingFileId] = useState<number | null>(null);
  const utils = trpc.useUtils();

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

    const file = selectedFiles[0];
    
    // Validate file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File size must be less than 50MB");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Convert file to base64
      setUploadProgress(10);
      const base64Data = await fileToBase64(file);
      setUploadProgress(50);

      // Upload via server (server uploads to S3, no CORS needed)
      await uploadFile.mutateAsync({
        projectId,
        jobId: jobId || null,
        filename: file.name,
        mimeType: file.type,
        base64Data,
      });

      setUploadProgress(100);
    } catch (error) {
      console.error("Upload error:", error);
      const message = error instanceof Error ? error.message : "Failed to upload file";
      toast.error(message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      // Reset input
      e.target.value = "";
    }
  }, [projectId, jobId, uploadFile]);

  const handleViewFile = async (file: FileMetadata) => {
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

  const handleDeleteFile = (fileId: number) => {
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
        <div className="relative">
          <input
            type="file"
            id="file-upload"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileSelect}
            disabled={uploading}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
          />
          <Button disabled={uploading}>
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading {uploadProgress}%
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Upload File
              </>
            )}
          </Button>
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
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
              />
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Upload First File
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {files.map((file) => (
            <Card key={file.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {getFileIcon(file.mimeType)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" title={file.originalName}>
                      {file.originalName}
                    </p>
                    <p className="text-sm text-muted-foreground">
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
                    onClick={() => handleDeleteFile(file.id)}
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
