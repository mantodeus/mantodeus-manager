/**
 * Scan Receipt Page
 * 
 * Mobile-first camera capture for receipts
 * - Uses <input type="file" capture="environment" />
 * - Auto-upload after capture
 * - Redirect to /expenses/:id
 * - Autofocus first editable field
 */

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Camera, Loader2, AlertCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ScanReceipt() {
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadMutation = trpc.expenses.scanReceipt.useMutation({
    onSuccess: (data) => {
      toast.success("Receipt captured successfully");
      navigate(`/expenses/${data.id}`);
    },
    onError: (err) => {
      setError(err.message || "Failed to capture receipt");
      setIsUploading(false);
      toast.error(err.message || "Failed to capture receipt");
    },
  });

  useEffect(() => {
    // Auto-trigger camera on mobile when page loads
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && fileInputRef.current) {
      // Small delay to ensure page is ready
      const timer = setTimeout(() => {
        fileInputRef.current?.click();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const maxSize = 15 * 1024 * 1024; // 15MB
    if (file.size > maxSize) {
      setError(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(",")[1]; // Remove data:image/...;base64, prefix

        uploadMutation.mutate({
          filename: file.name,
          mimeType: file.type,
          fileSize: file.size,
          base64Data,
        });
      };
      reader.onerror = () => {
        setError("Failed to read file");
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError("Failed to process file");
      setIsUploading(false);
    }

    // Reset input
    e.target.value = "";
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
            Capture a receipt using your camera
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
          <CardTitle>Camera Capture</CardTitle>
          <CardDescription>
            Tap the button below to open your camera and capture a receipt
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isUploading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Uploading receipt...
              </p>
            </div>
          ) : (
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
        </CardContent>
      </Card>
    </div>
  );
}

