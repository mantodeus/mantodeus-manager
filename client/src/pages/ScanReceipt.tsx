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
import { ArrowLeft, Camera, Loader2, AlertCircle, Check, RotateCcw } from "@/components/ui/Icon";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/PageHeader";

type ScanState = "idle" | "preview" | "uploading";

export default function ScanReceipt() {
  const [location, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadControllerRef = useRef<AbortController | null>(null);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null);

  const searchParams = new URLSearchParams(location.split("?")[1] || "");
  const expenseId = searchParams.get("expenseId")
    ? Number(searchParams.get("expenseId"))
    : null;

  const utils = trpc.useUtils();

  const createExpenseMutation = trpc.expenses.createManualExpense.useMutation();
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
      if (originalPreviewUrl) {
        URL.revokeObjectURL(originalPreviewUrl);
      }
      if (uploadControllerRef.current) {
        uploadControllerRef.current.abort();
      }
    };
  }, [originalPreviewUrl]);

  const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(message)), timeoutMs)
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
    setScanState("preview");
    setError(null);

    // Reset input
    e.target.value = "";
  };

  const handleUseScan = async () => {
    if (!originalFile) return;

    setScanState("uploading");
    setError(null);

    try {
      const fileToUpload = originalFile;
      let targetExpenseId = expenseId;

      // Create a new expense if one doesn't exist
      if (!targetExpenseId || Number.isNaN(targetExpenseId)) {
        try {
          const newExpense = await createExpenseMutation.mutateAsync({
            supplierName: "Receipt Scan",
            description: null,
            expenseDate: new Date(),
            // grossAmountCents is optional - will default to 1 cent on backend
            currency: "EUR",
            vatMode: "none",
            vatRate: null,
            vatAmountCents: null,
            businessUsePct: 100,
            category: "other",
            paymentStatus: "unpaid",
            paymentDate: null,
            paymentMethod: null,
          });
          targetExpenseId = newExpense.id;
        } catch (createErr) {
          // Re-throw with a clearer error message
          const createErrorMessage = createErr instanceof Error 
            ? createErr.message 
            : "Failed to create expense. Please check that all required fields are valid.";
          throw new Error(`Failed to create expense: ${createErrorMessage}`);
        }
      }

      const { uploadUrl, s3Key } = await uploadReceiptMutation.mutateAsync({
        expenseId: targetExpenseId,
        filename: fileToUpload.name,
        mimeType: fileToUpload.type,
        fileSize: fileToUpload.size,
      });

      const controller = new AbortController();
      uploadControllerRef.current = controller;
      const uploadTimeoutId = window.setTimeout(() => controller.abort(), 25000);

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": fileToUpload.type,
        },
        body: fileToUpload,
        signal: controller.signal,
      }).finally(() => window.clearTimeout(uploadTimeoutId));

      if (!uploadResponse.ok) {
        throw new Error(`Storage upload failed (${uploadResponse.status})`);
      }

      await withTimeout(
        registerReceiptMutation.mutateAsync({
          expenseId: targetExpenseId,
          s3Key,
          mimeType: fileToUpload.type,
          originalFilename: originalFile.name,
          fileSize: fileToUpload.size,
        }),
        20000,
        "Registering receipt timed out. Please try again."
      );

      toast.success("Receipt uploaded successfully");
      if (originalPreviewUrl) {
        URL.revokeObjectURL(originalPreviewUrl);
      }
      await utils.expenses.getExpense.invalidate({ id: targetExpenseId });
      await utils.expenses.list.invalidate();
      navigate(`/expenses/${targetExpenseId}`);
    } catch (err) {
      console.error("[ScanReceipt] Upload error:", err);
      let errorMessage = "Failed to upload receipt";
      
      if (err instanceof DOMException && err.name === "AbortError") {
        errorMessage = "Upload timed out. Please try again.";
      } else if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "object" && err !== null && "message" in err) {
        errorMessage = String(err.message);
      }
      
      setError(errorMessage);
      setScanState("preview");
      toast.error(errorMessage);
    } finally {
      uploadControllerRef.current = null;
    }
  };

  const handleRetake = () => {
    // Cleanup preview URL
    setOriginalFile(null);
    if (originalPreviewUrl) {
      URL.revokeObjectURL(originalPreviewUrl);
    }
    setOriginalPreviewUrl(null);
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
      <PageHeader />
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
            {scanState === "preview" && "Review receipt before saving"}
            {scanState === "uploading" && "Uploading receipt..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!expenseId && scanState === "idle" && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                A new expense will be created automatically when you upload the receipt.
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

          {scanState === "preview" && (
            <div className="space-y-4">
              {originalPreviewUrl ? (
                <>
                  <div className="relative w-full border rounded-lg overflow-hidden bg-muted">
                    <img
                      src={originalPreviewUrl}
                      alt="Scanned receipt"
                      className="w-full h-auto max-h-[600px] object-contain"
                      onError={(e) => {
                        console.error("[ScanReceipt] Preview image failed to load:", originalPreviewUrl);
                        setError("Failed to load preview image");
                      }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleUseScan}
                      className="flex-1"
                      size="lg"
                      disabled={uploadReceiptMutation.isPending || registerReceiptMutation.isPending || createExpenseMutation.isPending}
                    >
                      {(uploadReceiptMutation.isPending || registerReceiptMutation.isPending || createExpenseMutation.isPending) ? (
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      ) : (
                        <Check className="h-5 w-5 mr-2" />
                      )}
                      Use photo
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
                    No preview available. Please try again.
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
              <Button
                variant="outline"
                onClick={() => {
                  uploadControllerRef.current?.abort();
                  setError("Upload canceled. Please try again.");
                  setScanState("preview");
                }}
              >
                Cancel upload
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
