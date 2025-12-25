/**
 * Camera Capture Component for Inspections
 * 
 * Offline-first camera capture that saves to local storage.
 * Works on web and mobile devices.
 */

import { useState, useRef, useEffect, useCallback } from "react";
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
  const [isStarting, setIsStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Cleanup stream when dialog closes
  useEffect(() => {
    if (!open) {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      return;
    }
  }, [open, stream]);

  // Start camera (user-initiated via button or auto-start when dialog opens)
  const startCamera = useCallback(async () => {
    if (stream || isStarting) return;

    setIsStarting(true);
    setError(null);

    try {
      // iOS Safari fix: Wait for DOM commit - ensure video element is mounted
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      // Double-check video element exists after DOM commit
      const video = videoRef.current;
      if (!video) {
        // Wait one more frame if still not available
        await new Promise(resolve => requestAnimationFrame(resolve));
        const videoRetry = videoRef.current;
        if (!videoRetry) {
          throw new Error("Video element not mounted");
        }
      }

      // Now get the video element (guaranteed to exist)
      const videoElement = videoRef.current!;

      // Request camera stream
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Prefer back camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false, // Disable audio
      });

      // iOS Safari fix: Set attributes before srcObject
      videoElement.muted = true;
      videoElement.setAttribute("playsinline", "true");
      videoElement.setAttribute("autoplay", "true");

      // Set stream
      videoElement.srcObject = mediaStream;

      // iOS Safari fix: Must call play() after setting srcObject
      try {
        await videoElement.play();
      } catch (playError) {
        console.warn("Video play() failed, trying again:", playError);
        // Sometimes need to wait a bit
        await new Promise(resolve => setTimeout(resolve, 100));
        await videoElement.play();
      }

      setStream(mediaStream);
    } catch (err) {
      console.error("Camera access error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to access camera";
      setError(errorMessage);
      toast.error("Camera access denied or unavailable");
    } finally {
      setIsStarting(false);
    }
  }, [stream, isStarting]);

  // Auto-start camera when dialog opens
  // iOS Safari fix: Use zero-delay timeout to ensure state change is committed
  useEffect(() => {
    if (open && !stream && !isStarting && !error) {
      // Zero-delay timeout ensures this runs after DOM commit
      const timer = setTimeout(() => {
        startCamera();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [open, stream, isStarting, error, startCamera]);

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

      {/* Video Preview - iOS Safari fix: explicit height required */}
      {/* iOS Safari fix: Video element must ALWAYS be rendered when dialog is open */}
      <div className="flex-1 flex items-center justify-center relative bg-black" style={{ minHeight: "50vh" }}>
        {/* iOS Safari fix: Always render video element (not conditionally) */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          style={{ 
            height: "100%",
            width: "100%",
            minHeight: "400px",
            opacity: stream ? 1 : 0, // Hide visually if no stream, but keep mounted
            pointerEvents: stream ? "auto" : "none",
          }}
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Overlay UI based on state */}
        {error ? (
          <div className="text-center p-8 relative z-10">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-white mb-2">Camera Error</p>
            <p className="text-gray-400 text-sm">{error}</p>
            <div className="flex gap-2 justify-center mt-4">
              <Button
                variant="outline"
                onClick={startCamera}
                className="text-white border-white"
              >
                Retry
              </Button>
              <Button
                variant="outline"
                onClick={onClose}
                className="text-white border-white"
              >
                Close
              </Button>
            </div>
          </div>
        ) : !stream && (
          <div className="text-center relative z-10">
            <Loader2 className="h-8 w-8 animate-spin text-white mx-auto mb-4" />
            <p className="text-white mb-4">Starting camera...</p>
            {!isStarting && (
              <Button
                variant="outline"
                onClick={startCamera}
                className="text-white border-white"
              >
                Start Camera
              </Button>
            )}
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

