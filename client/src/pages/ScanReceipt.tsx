/**
 * Scan Receipt Page
 * 
 * Mobile-first receipt capture for receipts
 * - Uses <input type="file" capture="environment" />
 * - Client-side grayscale + contrast enhancement
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
import { scanDocument, type ScanResult } from "@/lib/documentScanner/scanPipeline";
import { CornerAdjuster } from "@/components/expenses/CornerAdjuster";

type ScanState = "idle" | "capturing" | "processing" | "preview" | "uploading";

export default function ScanReceipt() {
  const [location, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [scannedResult, setScannedResult] = useState<ScanResult | null>(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null);
  const [showAdjuster, setShowAdjuster] = useState(false);

  const searchParams = new URLSearchParams(location.split("?")[1] || "");
  const expenseId = searchParams.get("expenseId")
    ? Number(searchParams.get("expenseId"))
    : null;

  const utils = trpc.useUtils();

  const uploadReceiptMutation = trpc.expenses.uploadExpenseReceipt.useMutation();
  const registerReceiptMutation = trpc.expenses.registerReceipt.useMutation();

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
      if (originalPreviewUrl) {
        URL.revokeObjectURL(originalPreviewUrl);
      }
    };
  }, [scannedResult?.previewUrl, originalPreviewUrl]);

  // Timeout helper for scan pipeline
  const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Scan timeout")), timeoutMs)
      ),
    ]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const maxSize = 15 * 1024 * 1024; // 15MB
    if (file.size > maxSize) {
      setError(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
      setScanState("idle");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      setScanState("idle");
      return;
    }

    setOriginalFile(file);
    if (originalPreviewUrl) {
      URL.revokeObjectURL(originalPreviewUrl);
    }
    setOriginalPreviewUrl(URL.createObjectURL(file));
    setScanState("processing");
    setError(null);

    let processedResult: ScanResult | null = null;

    try {
      console.log("[ScanReceipt] Processing document:", file.name, file.type, file.size);
      
      // Best-effort scan with 8s timeout - NEVER block upload
      try {
        processedResult = await withTimeout(scanDocument(file), 8000);
        console.log("[ScanReceipt] Processing complete:", processedResult.blob.size, processedResult.previewUrl);
      } catch (scanError) {
        console.error("[ScanReceipt] Scan failed, will use original:", scanError);
        // Continue with original file - scan is best-effort only
        processedResult = null;
      }
      
      // Always proceed to preview, even if scan failed
      if (processedResult) {
        if (scannedResult?.previewUrl) {
          URL.revokeObjectURL(scannedResult.previewUrl);
        }
        setScannedResult(processedResult);
        setShowAdjuster(processedResult.confidence < 0.5);
      } else {
        // Use original file if scan failed
        setScannedResult(null);
        setShowAdjuster(false);
      }
      setScanState("preview");
    } catch (err) {
      console.error("[ScanReceipt] Unexpected error:", err);
      // Even on unexpected error, proceed with original file
      setScannedResult(null);
      setShowAdjuster(false);
      setScanState("preview");
    } finally {
      // Ensure loading state is always cleared
      if (scanState === "processing") {
        // State will be set above, but ensure we're not stuck
      }
    }

    // Reset input
    e.target.value = "";
  };

  const handleUseScan = async () => {
    if (!originalFile) return;
    if (!expenseId || Number.isNaN(expenseId)) {
      setError("Open this scanner from an expense to attach the scan.");
      setScanState("preview");
      return;
    }

    setScanState("uploading");
    setError(null);

    try {
      // Use scanned result if available, otherwise use original file
      const fileToUpload = scannedResult
        ? new File([scannedResult.blob], "scan.jpg", { type: "image/jpeg" })
        : originalFile;

      const { uploadUrl, s3Key } = await uploadReceiptMutation.mutateAsync({
        expenseId,
        filename: fileToUpload.name,
        mimeType: fileToUpload.type,
        fileSize: fileToUpload.size,
      });

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": fileToUpload.type,
        },
        body: fileToUpload,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Storage upload failed (${uploadResponse.status})`);
      }

      await registerReceiptMutation.mutateAsync({
        expenseId,
        s3Key,
        mimeType: fileToUpload.type,
        originalFilename: originalFile.name,
        fileSize: fileToUpload.size,
      });

      toast.success(scannedResult ? "Receipt scanned and uploaded successfully" : "Receipt uploaded successfully");
      if (scannedResult?.previewUrl) {
        URL.revokeObjectURL(scannedResult.previewUrl);
      }
      if (originalPreviewUrl) {
        URL.revokeObjectURL(originalPreviewUrl);
      }
      await utils.expenses.getExpense.invalidate({ id: expenseId });
      await utils.expenses.list.invalidate();
      navigate(`/expenses/${expenseId}`);
    } catch (err) {
      console.error("[ScanReceipt] Upload error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to upload receipt";
      setError(errorMessage);
      setScanState("preview");
      toast.error(errorMessage);
    } finally {
      // Ensure loading state is always cleared
      if (scanState === "uploading") {
        // State will be set above, but ensure we're not stuck
      }
    }
  };

  const handleRetake = () => {
    // Cleanup preview URL
    if (scannedResult?.previewUrl) {
      URL.revokeObjectURL(scannedResult.previewUrl);
    }
    setScannedResult(null);
    setOriginalFile(null);
    if (originalPreviewUrl) {
      URL.revokeObjectURL(originalPreviewUrl);
    }
    setOriginalPreviewUrl(null);
    setError(null);
    setShowAdjuster(false);
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
            Capture and process a receipt for review
          </p>
        </div>
      </div>

      {/* Camera Input (Hidden) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          console.log("[ScanReceipt] File input changed:", e.target.files?.length);
          handleFileChange(e);
        }}
        className="hidden"
      />

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Document Scanner</CardTitle>
          <CardDescription>
            {scanState === "idle" && "Capture a receipt using your camera"}
            {scanState === "processing" && "Processing document..."}
            {scanState === "preview" && "Review scan before saving"}
            {scanState === "uploading" && "Uploading receipt..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!expenseId && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Open this scanner from an expense to attach the scan.
              </AlertDescription>
            </Alert>
          )}
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
                Detecting document edges and correcting perspective
              </p>
            </div>
          )}

          {scanState === "preview" && (
            <div className="space-y-4">
              {scannedResult ? (
                <>
                  {showAdjuster && originalFile && originalPreviewUrl ? (
                    <CornerAdjuster
                      file={originalFile}
                      imageUrl={originalPreviewUrl}
                      initialCorners={scannedResult.corners}
                      onApply={(result) => {
                        if (scannedResult.previewUrl) {
                          URL.revokeObjectURL(scannedResult.previewUrl);
                        }
                        setScannedResult(result);
                        setShowAdjuster(false);
                      }}
                      onCancel={() => setShowAdjuster(false)}
                    />
                  ) : (
                  <div className="relative w-full border rounded-lg overflow-hidden bg-muted">
                    <img
                      src={scannedResult.previewUrl}
                      alt="Scanned receipt"
                      className="w-full h-auto max-h-[600px] object-contain"
                      onError={(e) => {
                        console.error("[ScanReceipt] Preview image failed to load:", scannedResult.previewUrl);
                        setError("Failed to load preview image");
                      }}
                    />
                  </div>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Confidence:{" "}
                      {scannedResult.confidence >= 0.7
                        ? "High"
                        : scannedResult.confidence >= 0.5
                        ? "Medium"
                        : "Low"}
                    </span>
                    <span>{Math.round(scannedResult.confidence * 100)}%</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleUseScan}
                      className="flex-1"
                      size="lg"
                      disabled={showAdjuster || !expenseId}
                    >
                      <Check className="h-5 w-5 mr-2" />
                      {scannedResult ? "Use scan" : "Upload original"}
                    </Button>
                    <Button
                      onClick={() => setShowAdjuster(true)}
                      variant="outline"
                      className="flex-1"
                      size="lg"
                      disabled={!originalPreviewUrl}
                    >
                      Adjust corners
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
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <AlertCircle className="h-12 w-12 text-destructive" />
                  <p className="text-sm text-muted-foreground">
                    No scanned result available. Please try again.
                  </p>
                  <Button onClick={handleRetake} variant="outline">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retake
                  </Button>
                </div>
              )}
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
