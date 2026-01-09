/**
 * Document Upload Zone Component
 * 
 * Upload zone for documents (PDFs/images) with OCR processing.
 * STRICTLY SEPARATE from AI Helper system.
 */

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Loader2, FileText, Image } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

interface DocumentUploadZoneProps {
  onUpload: (files: File[]) => void;
  isUploading?: boolean;
  accept?: string;
  maxFiles?: number;
  className?: string;
}

export function DocumentUploadZone({
  onUpload,
  isUploading = false,
  accept = ".pdf,application/pdf,image/jpeg,image/png,image/webp",
  maxFiles = 1,
  className,
}: DocumentUploadZoneProps) {
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
      (file) => {
        const isPdf = file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf");
        const isImage = file.type.startsWith("image/");
        return isPdf || isImage;
      }
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
              <p className="text-sm text-muted-foreground">Processing document...</p>
            </>
          ) : (
            <>
              <div className="rounded-full bg-muted p-3">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Drop document here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF or images (max {maxFiles} file{maxFiles > 1 ? "s" : ""})
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
                  input.multiple = maxFiles > 1;
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
                <Upload className="h-4 w-4 mr-2" />
                Select Document
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
