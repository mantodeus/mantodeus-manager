/**
 * BulkUploadDialog Component
 * 
 * Dialog for bulk uploading multiple receipt files
 * - Drag & drop or file picker
 * - Client-side validation (max 10 files, 15MB per file)
 * - Upload via uploadReceiptsBulk
 */

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Upload, X, FileText, Loader2 } from "@/components/ui/Icon";
import { ReceiptUploadZone } from "./ReceiptUploadZone";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const MAX_FILES = 10;
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (files: File[]) => Promise<void>;
  isUploading?: boolean;
}

export function BulkUploadDialog({
  open,
  onOpenChange,
  onUpload,
  isUploading = false,
}: BulkUploadDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const validateFiles = (files: File[]): string[] => {
    const validationErrors: string[] = [];

    if (files.length === 0) {
      validationErrors.push("Please select at least one file");
      return validationErrors;
    }

    if (files.length > MAX_FILES) {
      validationErrors.push(`Maximum ${MAX_FILES} files allowed`);
    }

    files.forEach((file, index) => {
      if (file.size > MAX_FILE_SIZE) {
        validationErrors.push(
          `${file.name} exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`
        );
      }

      // Check MIME type (more lenient check for image/*)
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";
      const isValidMime =
        ALLOWED_MIME_TYPES.includes(file.type) || isImage || isPdf;

      if (!isValidMime) {
        validationErrors.push(
          `${file.name} has unsupported file type (${file.type || "unknown"})`
        );
      }
    });

    return validationErrors;
  };

  const handleFilesSelected = useCallback((files: File[]) => {
    const validationErrors = validateFiles(files);
    setErrors(validationErrors);

    if (validationErrors.length === 0) {
      setSelectedFiles(files);
    } else {
      setSelectedFiles([]);
    }
  }, []);

  const handleRemoveFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    const validationErrors = validateFiles(newFiles);
    setErrors(validationErrors);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    const validationErrors = validateFiles(selectedFiles);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      await onUpload(selectedFiles);
      // Reset state on success
      setSelectedFiles([]);
      setErrors([]);
      onOpenChange(false);
    } catch (error) {
      // Error handling is done by parent
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setSelectedFiles([]);
      setErrors([]);
      onOpenChange(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Receipts</DialogTitle>
          <DialogDescription>
            Upload multiple receipt files at once. Maximum {MAX_FILES} files, {MAX_FILE_SIZE / 1024 / 1024}MB per file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <ReceiptUploadZone
            onUpload={handleFilesSelected}
            isUploading={isUploading}
            maxFiles={MAX_FILES}
          />

          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {errors.map((error, index) => (
                    <li key={index} className="text-sm">
                      {error}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Selected Files ({selectedFiles.length}/{MAX_FILES})
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedFiles([]);
                    setErrors([]);
                  }}
                  disabled={isUploading}
                >
                  Clear all
                </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-muted rounded-md"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => handleRemoveFile(index)}
                      disabled={isUploading}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={
              isUploading ||
              selectedFiles.length === 0 ||
              errors.length > 0
            }
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

