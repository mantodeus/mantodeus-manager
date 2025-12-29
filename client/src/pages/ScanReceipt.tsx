/**
 * Scan Receipt Page
 * 
 * Mobile-first document scanner for receipts
 * - Uses <input type="file" capture="environment" />
 * - Client-side document processing
 * - Preview with confirmation before upload
 * - Redirect to /expenses/:id
 */

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Camera, Loader2, AlertCircle, Check, RotateCcw } from "lucide-react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { processDocumentImage } from "@/lib/documentScan";

type ScanState = "idle" | "capturing" | "processing" | "preview" | "uploading";

export default function ScanReceipt() {
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [scannedResult, setScannedResult] = useState<{
    blob: Blob;
    previewUrl: string;
  } | null>(null);

  const utils = trpc.useUtils();

  const uploadMutation = trpc.expenses.scanReceipt.useMutation({
    onSuccess: async (data) => {
      toast.success("Receipt scanned and uploaded successfully");
      // Cleanup preview URL
      if (scannedResult?.previewUrl) {
        URL.revokeObjectURL(scannedResult.previewUrl);
      }
      // Force refetch to ensure UI updates immediately
      await utils.expenses.getById.invalidate({ id: data.id });
      await utils.expenses.list.invalidate();
      navigate(`/expenses/${data.id}`);
    },
    onError: (err) => {
      setError(err.message || "Failed to upload receipt");
      setScanState("preview");
      toast.error(err.message || "Failed to upload receipt");
    },
  });

  useEffect(() => {
    // Auto-trigger camera on mobile when page loads
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && fileInputRef.current && scanState === "idle") {
      // Small delay to ensure page is ready
      const timer = setTimeout(() => {
        fileInputRef.current?.click();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [scanState]);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (scannedResult?.previewUrl) {
        URL.revokeObjectURL(scannedResult.previewUrl);
      }
    };
  }, [scannedResult?.previewUrl]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const maxSize = 15 * 1024 * 1024; // 15MB
    if (file.size > maxSize) {
      setError(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
      return;
    }

    setOriginalFile(file);
    setScanState("processing");
    setError(null);

    try {
      // Process document
      const result = await processDocumentImage(file);
      setScannedResult(result);
      setScanState("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process document");
      setScanState("idle");
      toast.error("Failed to process document");
    }

    // Reset input
    e.target.value = "";
  };

  const handleUseScan = async () => {
    if (!scannedResult || !originalFile) return;

    setScanState("uploading");

    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(",")[1]; // Remove data:image/...;base64, prefix

        uploadMutation.mutate({
          filename: originalFile.name,
          mimeType: "image/jpeg", // Processed images are JPEG
          fileSize: scannedResult.blob.size,
          base64Data,
        });
      };
      reader.onerror = () => {
        setError("Failed to read processed image");
        setScanState("preview");
      };
      reader.readAsDataURL(scannedResult.blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to prepare upload");
      setScanState("preview");
    }
  };

  const handleRetake = () => {
    // Cleanup preview URL
    if (scannedResult?.previewUrl) {
      URL.revokeObjectURL(scannedResult.previewUrl);
    }
    setScannedResult(null);
    setOriginalFile(null);
    setError(null);
    setScanState("idle");
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleManualTrigger = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/expenses">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-regular">Scan Receipt</h1>
          <p className="text-muted-foreground text-sm">
            Capture and process a receipt document
          </p>
        </div>
      </div>

      {/* Camera Input (Hidden) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Document Scanner</CardTitle>
          <CardDescription>
            {scanState === "idle" && "Capture a receipt using your camera"}
            {scanState === "processing" && "Processing document..."}
            {scanState === "preview" && "Review the scanned document"}
            {scanState === "uploading" && "Uploading receipt..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {scanState === "idle" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="rounded-full bg-muted p-6">
                <Camera className="h-12 w-12 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                On mobile devices, the camera will open automatically.
                <br />
                On desktop, click the button below to select a file.
              </p>
              <Button
                size="lg"
                onClick={handleManualTrigger}
                className="h-12 px-8"
              >
                <Camera className="h-5 w-5 mr-2" />
                {/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
                  ? "Open Camera"
                  : "Select File"}
              </Button>
            </div>
          )}

          {scanState === "processing" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Processing document...
              </p>
              <p className="text-xs text-muted-foreground text-center">
                Detecting edges, correcting perspective, and enhancing contrast
              </p>
            </div>
          )}

          {scanState === "preview" && scannedResult && (
            <div className="space-y-4">
              <div className="relative w-full border rounded-lg overflow-hidden bg-muted">
                <img
                  src={scannedResult.previewUrl}
                  alt="Scanned receipt"
                  className="w-full h-auto max-h-[600px] object-contain"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleUseScan}
                  className="flex-1"
                  size="lg"
                >
                  <Check className="h-5 w-5 mr-2" />
                  Use scan
                </Button>
                <Button
                  onClick={handleRetake}
                  variant="outline"
                  className="flex-1"
                  size="lg"
                >
                  <RotateCcw className="h-5 w-5 mr-2" />
                  Retake
                </Button>
              </div>
            </div>
          )}

          {scanState === "uploading" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Uploading receipt...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
