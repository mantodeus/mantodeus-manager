/**
 * InvoiceUploadZone Component
 * 
 * Drag-and-drop zone for uploading invoice PDF files
 */

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Loader2, FileText } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

interface InvoiceUploadZoneProps {
  onUpload: (files: File[]) => void;
  isUploading?: boolean;
  accept?: string;
  maxFiles?: number;
  className?: string;
}

export function InvoiceUploadZone({
  onUpload,
  isUploading = false,
  accept = ".pdf,application/pdf",
  maxFiles = 10,
  className,
}: InvoiceUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) {
      setIsDragging(true);
    }
  }, [isUploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isUploading) return;

    const files = Array.from(e.dataTransfer.files).filter(
      (file) => file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf")
    );
    if (files.length > 0) {
      onUpload(files.slice(0, maxFiles));
    }
  }, [isUploading, onUpload, maxFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onUpload(files.slice(0, maxFiles));
      // Reset input
      e.target.value = "";
    }
  }, [onUpload, maxFiles]);

  return (
    <Card
      className={cn(
        "border-2 border-dashed transition-colors",
        isDragging && "border-primary bg-primary/5",
        isUploading && "opacity-50 cursor-not-allowed",
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardContent className="p-6">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          {isUploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Uploading...</p>
            </>
          ) : (
            <>
              <div className="rounded-full bg-muted p-3">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Drop invoice PDFs here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF files only (max {maxFiles} files)
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = accept;
                  input.multiple = true;
                  input.onchange = (e) => {
                    const target = e.target as HTMLInputElement;
                    if (target.files) {
                      handleFileSelect({ target } as React.ChangeEvent<HTMLInputElement>);
                    }
                  };
                  input.click();
                }}
                disabled={isUploading}
              >
                <FileText className="h-4 w-4 mr-2" />
                Select PDFs
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

