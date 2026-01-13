/**
 * BulkInvoiceUploadDialog Component
 * 
 * Dialog for bulk uploading multiple invoice PDF files
 * - Drag & drop or file picker
 * - Client-side validation (max 10 files, 50MB per file)
 * - Upload via uploadInvoicesBulk
 */

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Upload, X, FileText, Loader2, DocumentCurrencyEuro } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useMobile";
import { InvoiceUploadZone } from "./InvoiceUploadZone";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const MAX_FILES = 10;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = ["application/pdf"];

interface BulkInvoiceUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (files: File[]) => Promise<void>;
  isUploading?: boolean;
}

export function BulkInvoiceUploadDialog({
  open,
  onOpenChange,
  onUpload,
  isUploading = false,
}: BulkInvoiceUploadDialogProps) {
  const isMobile = useIsMobile();
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

      // Check MIME type
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        validationErrors.push(
          `${file.name} is not a PDF file (${file.type || "unknown type"})`
        );
      }
    });

    return validationErrors;
  };

  const handleFilesSelected = useCallback((files: File[]) => {
    // Preserve selection order: files come in the order they were selected
    // Use functional update to access current selectedFiles state
    setSelectedFiles((currentFiles) => {
      // Filter out duplicates by filename to prevent adding the same file twice
      const existingFileNames = new Set(currentFiles.map(f => f.name));
      const newFiles = files.filter(file => !existingFileNames.has(file.name));
      
      // Append new files to existing list (preserving order)
      const combinedFiles = [...currentFiles, ...newFiles];
      
      // Validate all files (existing + new)
      const validationErrors = validateFiles(combinedFiles);
      setErrors(validationErrors);

      if (validationErrors.length === 0) {
        // Keep all files, including existing ones
        return combinedFiles;
      } else {
        // Only keep valid new files, preserve all existing files
        const validNewFiles = newFiles.filter(file => {
          const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
          const isValidSize = file.size <= MAX_FILE_SIZE;
          return isPdf && isValidSize;
        });
        return [...currentFiles, ...validNewFiles];
      }
    });
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
      <DialogContent 
        className={cn(
          "flex flex-col p-0",
          // Mobile: fullscreen with safe areas - override all default positioning
          isMobile && [
            "invoice-dialog-fullscreen",
            "!left-0",
            "!translate-x-0",
            "!translate-y-0",
            "!top-0",
            "!bottom-[var(--bottom-safe-area,calc(56px+env(safe-area-inset-bottom,0px)))]",
            "!w-full",
            "!h-[calc(100vh-var(--bottom-safe-area,calc(56px+env(safe-area-inset-bottom,0px))))]",
            "!max-h-[calc(100vh-var(--bottom-safe-area,calc(56px+env(safe-area-inset-bottom,0px))))]",
            "!rounded-none",
            "!m-0",
            "!max-w-none"
          ]
        )}
        style={isMobile ? {
          transform: 'none',
        } : undefined}
        showCloseButton={false}
      >
        {/* PageHeader-like structure matching Invoices page */}
        <div className="flex-shrink-0" style={{ marginBottom: 'var(--space-page-gap, 24px)' }}>
          {/* TitleRow */}
          <div className="flex items-start justify-between gap-4 px-4" style={{ paddingTop: isMobile ? 'calc(1rem + env(safe-area-inset-top, 0px))' : '1rem' }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <h1 className="text-2xl md:text-3xl font-light flex items-center gap-2">
                  <DocumentCurrencyEuro className="h-6 w-6 text-primary" />
                  Upload Invoices
                </h1>
              </div>
            </div>
            
            {/* Icon Cluster - X button where settings would be */}
            <div className="flex items-center shrink-0 gap-3 sm:gap-2">
              <Button
                variant="icon"
                size="icon"
                onClick={handleClose}
                className="size-9 [&_svg]:size-8 hover:bg-muted/50"
                aria-label="Close"
                disabled={isUploading}
              >
                <X />
              </Button>
            </div>
          </div>
        </div>

        {/* Fade-out separator */}
        <div className="separator-fade" />

        <div className={cn(
          "px-6 pt-4 overflow-y-auto flex-1 min-h-0",
          "pb-4"
        )}>
          <div className="space-y-4">
          <InvoiceUploadZone
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
                {/* Display in reverse order: newest (last selected) at top, first selected at bottom */}
                {[...selectedFiles].reverse().map((file, originalIndex) => {
                  // Calculate the reverse index for removal
                  const reverseIndex = selectedFiles.length - 1 - originalIndex;
                  return (
                    <div
                      key={`${file.name}-${file.size}-${file.lastModified}`}
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
                        onClick={() => handleRemoveFile(reverseIndex)}
                        disabled={isUploading}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Fade-out separator */}
        <div className="separator-fade" />

        <div className="flex flex-col gap-2 pt-4 px-6 pb-6">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
              className="flex-1"
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
              className="flex-1"
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

