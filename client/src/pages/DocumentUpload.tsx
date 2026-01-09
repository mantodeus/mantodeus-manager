/**
 * Document Upload Page
 * 
 * Upload documents (PDFs/images) for OCR processing.
 * Creates staging invoices with needsReview=true.
 */

import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { DocumentUploadZone } from "@/components/documents/DocumentUploadZone";
import { PageHeader } from "@/components/PageHeader";
import DashboardLayout from "@/components/DashboardLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "@/components/ui/Icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DocumentUpload() {
  const [, navigate] = useLocation();
  const [uploading, setUploading] = useState(false);

  const processDocumentMutation = trpc.documents.process.useMutation({
    onSuccess: (data) => {
      toast.success("Document processed successfully");
      setUploading(false);
      // Navigate to invoice review
      navigate(`/invoices/${data.invoiceId}`);
    },
    onError: (error) => {
      console.error("[DocumentUpload] Processing failed:", error);
      toast.error(error.message || "Failed to process document. Please try again.");
      setUploading(false);
    },
  });

  const handleFileUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    // Process first file only (for v1)
    const file = files[0];
    setUploading(true);

    try {
      // Convert file to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Process document with OCR
      await processDocumentMutation.mutateAsync({
        filename: file.name,
        mimeType: file.type || "application/pdf",
        fileSize: file.size,
        base64Data,
      });
    } catch (error) {
      console.error("[DocumentUpload] Upload failed:", error);
      setUploading(false);
    }
  }, [processDocumentMutation]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader />
        
        <Card>
          <CardHeader>
            <CardTitle>Upload Document for Processing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Upload a PDF or image to extract invoice data automatically.
                The document will be processed and you'll be able to review the extracted information.
              </AlertDescription>
            </Alert>

            <DocumentUploadZone
              onUpload={handleFileUpload}
              isUploading={uploading}
              maxFiles={1}
            />

            {uploading && (
              <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing document with OCR...</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
