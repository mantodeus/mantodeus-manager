/**
 * BulkInvoiceUploadDialog Component
 * 
 * Dialog for bulk uploading multiple invoice PDF files
 * - Drag & drop or file picker
 * - Client-side validation (max 10 files, 50MB per file)
 * - Upload via uploadInvoicesBulk
 */

import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Upload, FileText, Loader2, X } from "@/components/ui/Icon";
import { useIsMobile } from "@/hooks/useMobile";
import { usePortalRoot } from "@/hooks/usePortalRoot";
import { InvoiceUploadZone } from "./InvoiceUploadZone";
import {
  InvoiceWorkspaceBody,
  InvoiceWorkspaceFooter,
  InvoiceWorkspaceHeader,
  InvoiceWorkspaceSeparator,
} from "./InvoiceWorkspaceLayout";

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
  const portalRoot = usePortalRoot();
  const portalTarget =
    portalRoot ?? (typeof document !== "undefined" ? document.body : null);
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

  const content = (
    <>
      <InvoiceWorkspaceHeader
        title="Upload Invoices"
        onClose={handleClose}
        closeDisabled={isUploading}
      />

      <InvoiceWorkspaceBody>
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
                    <Card
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      className="flex flex-row items-center gap-3 p-3"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">Ready to scan · {formatFileSize(file.size)}</p>
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
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </InvoiceWorkspaceBody>

      <InvoiceWorkspaceSeparator />

      <InvoiceWorkspaceFooter>
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
      </InvoiceWorkspaceFooter>
    </>
  );

  // Mobile: Full-screen layout (only render when open)
  if (isMobile) {
    if (!open || !portalTarget) return null;
    return createPortal(
      <div
        className="fixed inset-0 z-[120] bg-background flex flex-col"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
          paddingBottom: 'calc(var(--bottom-safe-area, 0px) + 1rem)',
          paddingLeft: '1rem',
          paddingRight: '1rem',
        }}
      >
        <div className="flex min-h-full w-full flex-col">
          {content}
        </div>
      </div>,
      portalTarget
    );
  }

  // Desktop: Always render Dialog (Radix handles open/close state)
  // This ensures React can properly manage the component lifecycle
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="flex flex-col p-0 max-w-2xl"
        showCloseButton={false}
      >
        {content}
      </DialogContent>
    </Dialog>
  );
}
