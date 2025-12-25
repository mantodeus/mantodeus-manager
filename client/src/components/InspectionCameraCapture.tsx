/**
 * Camera Capture Component for Inspections
 * 
 * Offline-first camera capture that saves to local storage.
 * Works on web and mobile devices.
 */

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, X, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface InspectionCameraCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (imageBlob: Blob, imageUrl: string) => void;
}

export function InspectionCameraCapture({
  open,
  onClose,
  onCapture,
}: InspectionCameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open) {
      // Stop stream when dialog closes
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      return;
    }

    // Request camera access
    const startCamera = async () => {
      try {
        setError(null);
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment", // Prefer back camera on mobile
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });

        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Camera access error:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to access camera";
        setError(errorMessage);
        toast.error("Camera access denied or unavailable");
      }
    };

    startCamera();

    return () => {
      // Cleanup on unmount
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [open]);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current || !stream) return;

    setIsCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw video frame to canvas
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Failed to get canvas context");
      }

      ctx.drawImage(video, 0, 0);

      // Convert canvas to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            throw new Error("Failed to create image blob");
          }

          // Create object URL for preview
          const imageUrl = URL.createObjectURL(blob);

          // Stop camera stream
          stream.getTracks().forEach(track => track.stop());
          setStream(null);

          // Call callback with captured image
          onCapture(blob, imageUrl);
          onClose();
        },
        "image/jpeg",
        0.9 // Quality
      );
    } catch (err) {
      console.error("Capture error:", err);
      toast.error("Failed to capture photo");
      setError(err instanceof Error ? err.message : "Capture failed");
    } finally {
      setIsCapturing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/80">
        <CardTitle className="text-white">Take Photo</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Video Preview */}
      <div className="flex-1 flex items-center justify-center relative bg-black">
        {error ? (
          <div className="text-center p-8">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-white mb-2">Camera Error</p>
            <p className="text-gray-400 text-sm">{error}</p>
            <Button
              variant="outline"
              onClick={onClose}
              className="mt-4"
            >
              Close
            </Button>
          </div>
        ) : stream ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="max-w-full max-h-full object-contain"
            />
            <canvas ref={canvasRef} className="hidden" />
          </>
        ) : (
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-white mx-auto mb-4" />
            <p className="text-white">Starting camera...</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-6 bg-black/80 flex justify-center">
        <Button
          size="lg"
          onClick={handleCapture}
          disabled={!stream || isCapturing}
          className="h-16 w-16 rounded-full bg-white text-black hover:bg-gray-200"
        >
          {isCapturing ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : (
            <Camera className="h-8 w-8" />
          )}
        </Button>
      </div>
    </div>
  );
}

