/**
 * Camera Capture Component for Inspections
 * 
 * Offline-first camera capture that saves to local storage.
 * Works on web and mobile devices.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { Camera, X, Loader2, AlertCircle } from "@/components/ui/Icon";
import { toast } from "sonner";

interface InspectionCameraCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (imageBlob: Blob, imageUrl: string) => void;
}

type CameraState = "idle" | "initialising" | "streaming" | "fallback" | "error";

export function InspectionCameraCapture({
  open,
  onClose,
  onCapture,
}: InspectionCameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [diagnostics, setDiagnostics] = useState<Array<Record<string, unknown>>>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isIOSSafari = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return (
      /iP(hone|ad|od)/.test(navigator.platform) &&
      /Safari/.test(navigator.userAgent) &&
      !/Chrome/.test(navigator.userAgent)
    );
  }, []);

  const logCamera = useCallback((message: string, data: Record<string, unknown> = {}) => {
    const payload = {
      message,
      timestamp: new Date().toISOString(),
      ...data,
    };
    console.info("[Camera]", payload);
    setDiagnostics((prev) => [...prev, payload].slice(-12));
    return payload;
  }, []);

  const getEnvironmentDiagnostics = useCallback(() => {
    if (typeof navigator === "undefined") {
      return { navigatorAvailable: false, isIOSSafari };
    }
    return {
      navigatorAvailable: true,
      hasMediaDevices: !!navigator.mediaDevices,
      hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      isIOSSafari,
    };
  }, [isIOSSafari]);

  const buildErrorDetails = useCallback(
    (message: string, logEntry?: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
      const logs = logEntry ? [...diagnostics, logEntry] : diagnostics;
      return JSON.stringify(
        {
          error: message,
          ...getEnvironmentDiagnostics(),
          ...extra,
          logs,
        },
        null,
        2
      );
    },
    [diagnostics, getEnvironmentDiagnostics]
  );

  const stopStream = useCallback((streamToStop?: MediaStream | null) => {
    const target = streamToStop || stream;
    if (target) {
      target.getTracks().forEach((track) => track.stop());
    }
    setStream(null);
  }, [stream]);

  const waitForVideoReady = useCallback((video: HTMLVideoElement, timeoutMs: number) => {
    if (video.readyState >= 2 && video.videoWidth > 0) {
      return Promise.resolve(true);
    }
    return new Promise<boolean>((resolve) => {
      let resolved = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onReady = () => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(true);
      };
      const onError = () => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(false);
      };
      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
        }
        video.removeEventListener("loadedmetadata", onReady);
        video.removeEventListener("canplay", onReady);
        video.removeEventListener("error", onError);
      };
      timer = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(false);
      }, timeoutMs);
      video.addEventListener("loadedmetadata", onReady);
      video.addEventListener("canplay", onReady);
      video.addEventListener("error", onError);
    });
  }, []);

  // Cleanup stream when dialog closes
  useEffect(() => {
    if (!open) {
      stopStream();
      setError(null);
      setErrorDetails(null);
      setDiagnostics([]);
      setCameraState("idle");
      return;
    }
  }, [open, stopStream]);

  // Start camera (user-initiated via button or auto-start when dialog opens)
  const startCamera = useCallback(async () => {
    if (stream || cameraState === "initialising") return;

    setCameraState("initialising");
    setError(null);
    setErrorDetails(null);

    logCamera("start-requested", getEnvironmentDiagnostics());

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const logEntry = logCamera("getUserMedia-unavailable", getEnvironmentDiagnostics());
        setError("Camera unavailable");
        setErrorDetails(buildErrorDetails("Camera unavailable", logEntry));
        setCameraState("fallback");
        return;
      }

      const videoElement = videoRef.current;
      if (!videoElement) {
        const logEntry = logCamera("video-element-missing", getEnvironmentDiagnostics());
        setError("Video element not available");
        setErrorDetails(buildErrorDetails("Video element not available", logEntry));
        setCameraState("fallback");
        return;
      }

      // Request camera stream
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Prefer back camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false, // Disable audio
      });

      logCamera("stream-acquired", {
        trackCount: mediaStream.getTracks().length,
        tracks: mediaStream.getTracks().map((track) => track.kind),
      });

      // iOS Safari fix: Set attributes before srcObject
      videoElement.muted = true;
      videoElement.setAttribute("playsinline", "true");
      videoElement.setAttribute("autoplay", "true");

      // Set stream
      videoElement.srcObject = mediaStream;

      const isReady = await waitForVideoReady(videoElement, 1500);
      if (!isReady) {
        const logEntry = logCamera("video-not-ready", {
          readyState: videoElement.readyState,
          videoWidth: videoElement.videoWidth,
          videoHeight: videoElement.videoHeight,
        });
        stopStream(mediaStream);
        setError("Video preview unavailable");
        setErrorDetails(buildErrorDetails("Video preview unavailable", logEntry));
        setCameraState("fallback");
        return;
      }

      // iOS Safari fix: Must call play() after setting srcObject
      try {
        await videoElement.play();
      } catch (playError) {
        const logEntry = logCamera("video-play-failed", {
          error: playError instanceof Error ? playError.message : String(playError),
        });
        stopStream(mediaStream);
        setError("Video playback failed");
        setErrorDetails(buildErrorDetails("Video playback failed", logEntry));
        setCameraState("fallback");
        return;
      }

      setStream(mediaStream);
      setCameraState("streaming");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to access camera";
      const logEntry = logCamera("getUserMedia-error", {
        error: err instanceof Error ? err.message : String(err),
      });
      setError(errorMessage);
      setErrorDetails(buildErrorDetails(errorMessage, logEntry));
      setCameraState("fallback");
      toast.error("Camera access denied or unavailable");
    }
  }, [
    stream,
    cameraState,
    buildErrorDetails,
    getEnvironmentDiagnostics,
    logCamera,
    stopStream,
    waitForVideoReady,
  ]);

  // Auto-start camera when dialog opens
  useEffect(() => {
    if (!open) return;
    logCamera("dialog-opened", getEnvironmentDiagnostics());
    if (isIOSSafari) {
      setCameraState("fallback");
      setError(null);
      setErrorDetails(null);
      return;
    }
    if (!stream && cameraState === "idle") {
      startCamera();
    }
  }, [open, stream, cameraState, startCamera, isIOSSafari, logCamera, getEnvironmentDiagnostics]);

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
      const errorMessage = err instanceof Error ? err.message : "Capture failed";
      const logEntry = logCamera("capture-error", { error: errorMessage });
      setError(errorMessage);
      setErrorDetails(buildErrorDetails(errorMessage, logEntry));
      setCameraState("error");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleFileCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsCapturing(true);
    try {
      const imageUrl = URL.createObjectURL(file);
      onCapture(file, imageUrl);
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to capture file";
      const logEntry = logCamera("file-capture-error", { error: errorMessage });
      setError(errorMessage);
      setErrorDetails(buildErrorDetails(errorMessage, logEntry));
      setCameraState("error");
      toast.error("Failed to capture photo");
    } finally {
      setIsCapturing(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black z-50 flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
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
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileCapture}
          className="hidden"
        />
        
        {/* Overlay UI based on state */}
        {error ? (
          <div className="text-center p-8 relative z-10">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-white mb-2">Camera Error</p>
            <p className="text-gray-400 text-sm">{error}</p>
            {errorDetails && (
              <pre className="text-gray-500 text-xs whitespace-pre-wrap mt-3 max-w-[90vw]">
                {errorDetails}
              </pre>
            )}
            <div className="flex gap-2 justify-center mt-4">
              <Button
                variant="outline"
                onClick={triggerFileInput}
                className="text-white border-white"
              >
                Use Camera
              </Button>
              {!isIOSSafari && (
                <Button
                  variant="outline"
                  onClick={startCamera}
                  className="text-white border-white"
                >
                  Retry Live Camera
                </Button>
              )}
              <Button
                variant="outline"
                onClick={onClose}
                className="text-white border-white"
              >
                Close
              </Button>
            </div>
          </div>
        ) : cameraState !== "streaming" && (
          <div className="text-center relative z-10">
            {cameraState === "initialising" ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-white mx-auto mb-4" />
                <p className="text-white mb-4">Starting camera...</p>
              </>
            ) : (
              <>
                <p className="text-white mb-4">
                  {isIOSSafari ? "Use iOS camera capture" : "Camera ready"}
                </p>
              </>
            )}
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                onClick={triggerFileInput}
                className="text-white border-white"
              >
                Use Camera
              </Button>
              {!isIOSSafari && cameraState !== "initialising" && (
                <Button
                  variant="outline"
                  onClick={startCamera}
                  className="text-white border-white"
                >
                  Start Live Camera
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-6 bg-black/80 flex justify-center">
        {cameraState === "streaming" ? (
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
        ) : (
          <Button
            size="lg"
            onClick={triggerFileInput}
            disabled={isCapturing}
            className="h-16 px-6 rounded-full bg-white text-black hover:bg-gray-200"
          >
            {isCapturing ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              "Use Camera"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

