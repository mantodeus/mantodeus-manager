/**
 * ReceiptPreviewList Component
 * 
 * Displays a list of uploaded receipt files with preview and delete options
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, X, Eye, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ReceiptFile {
  id: number;
  filename: string;
  fileKey: string;
  mimeType: string;
  fileSize?: number | null;
  uploadedAt: Date;
  previewUrl?: string | null;
}

interface ReceiptPreviewListProps {
  files: ReceiptFile[];
  onDelete?: (id: number) => void;
  onView?: (id: number) => void;
  isDeleting?: boolean;
  deletingId?: number | null;
  viewingId?: number | null;
}

export function ReceiptPreviewList({
  files,
  onDelete,
  onView,
  isDeleting = false,
  deletingId = null,
  viewingId = null,
}: ReceiptPreviewListProps) {
  // Safety: Handle empty array gracefully
  if (!files || files.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No receipts uploaded
      </div>
    );
  }

  // Track failed image loads
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

  const formatFileSize = (bytes: number | null | undefined): string => {
    if (!bytes) return "Unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImage = (mimeType: string): boolean => {
    return mimeType.startsWith("image/");
  };

  const handleImageError = (receiptId: number, previewUrl: string | null | undefined, filename: string) => {
    // Log error if URL fails to load
    console.error("Failed to load receipt preview:", {
      receiptId,
      previewUrl,
      filename,
    });
    // Mark as failed to show fallback
    setFailedImages((prev) => new Set(prev).add(receiptId));
  };

  return (
    <div className="space-y-2">
      {files.map((receipt) => {
        const isDeletingThis = deletingId === receipt.id;
        const isViewingThis = viewingId === receipt.id;
        const canDelete = onDelete && !isDeleting;
        const canView = onView && !isViewingThis;
        const imageFailed = failedImages.has(receipt.id);
        const showImage = isImage(receipt.mimeType) && receipt.previewUrl && !imageFailed;

        return (
          <Card key={receipt.id} className="relative">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                {showImage ? (
                  <img
                    src={receipt.previewUrl!}
                    alt={receipt.filename}
                    className="h-12 w-12 object-cover rounded border"
                    onError={() => handleImageError(receipt.id, receipt.previewUrl, receipt.filename)}
                  />
                ) : (
                  <div className="h-12 w-12 flex items-center justify-center bg-muted rounded border">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{receipt.filename}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {formatFileSize(receipt.fileSize)}
                    </Badge>
                    {isImage(receipt.mimeType) && (
                      <Badge variant="outline" className="text-xs">
                        Image
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {canView && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onView(receipt.id)}
                      disabled={isViewingThis}
                    >
                      {isViewingThis ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => onDelete(receipt.id)}
                      disabled={isDeletingThis}
                    >
                      {isDeletingThis ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

