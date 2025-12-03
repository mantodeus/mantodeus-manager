/**
 * Project File Gallery Component
 * 
 * Displays and manages files for a project:
 * - File upload with progress
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

export function ProjectFileGallery({ projectId, jobId, files, isLoading }: ProjectFileGalleryProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const utils = trpc.useUtils();

  // Mutations
  const presignUpload = trpc.projects.files.presignUpload.useMutation();
  const registerFile = trpc.projects.files.register.useMutation();
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

  // Get presigned URL for viewing
  const getPresignedUrl = trpc.projects.files.getPresignedUrl.useMutation();

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
      // 1. Get presigned URL
      const { uploadUrl, s3Key } = await presignUpload.mutateAsync({
        projectId,
        jobId: jobId || null,
        filename: file.name,
        contentType: file.type,
        fileSize: file.size,
      });

      setUploadProgress(20);

      // 2. Upload file directly to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file to storage");
      }

      setUploadProgress(80);

      // 3. Register file in database
      await registerFile.mutateAsync({
        projectId,
        jobId: jobId || null,
        s3Key,
        originalName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      });

      setUploadProgress(100);
      toast.success("File uploaded successfully");

      // Refresh file list
      if (jobId) {
        utils.projects.files.listByJob.invalidate({ projectId, jobId });
      } else {
        utils.projects.files.listByProject.invalidate({ projectId });
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload file");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      // Reset input
      e.target.value = "";
    }
  }, [projectId, jobId, presignUpload, registerFile, utils]);

  const handleViewFile = async (file: FileMetadata) => {
    try {
      const { url } = await getPresignedUrl.mutateAsync({ fileId: file.id });
      window.open(url, "_blank");
    } catch (error) {
      toast.error("Failed to get file URL");
    }
  };

  const handleDeleteFile = (fileId: number) => {
    if (confirm("Are you sure you want to delete this file?")) {
      deleteFile.mutate({ fileId });
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) {
      return <ImageIcon className="h-8 w-8 text-[#131416]" />;
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
                    disabled={getPresignedUrl.isPending}
                    className="flex-1"
                  >
                    {getPresignedUrl.isPending ? (
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
