import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Download, Undo, Pencil, Circle, Eraser, Move } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface Image {
  id: number;
  url: string;
  fileKey: string;
  filename: string | null;
  caption: string | null;
  imageUrls?: {
    thumb: string;
    preview: string;
    full: string;
  } | null;
}

interface ImageLightboxProps {
  images: Image[];
  initialIndex: number;
  onClose: () => void;
  jobId: number;
}

type Tool = "draw" | "circle" | "erase";
type Mode = "annotate" | "pan";

// Annotation types for tracking drawings
interface CircleAnnotation {
  type: "circle";
  centerX: number;
  centerY: number;
  radius: number;
  color: string;
  lineWidth: number;
}

interface PathAnnotation {
  type: "path";
  points: { x: number; y: number }[];
  color: string;
  lineWidth: number;
  isEraser: boolean;
}

type Annotation = CircleAnnotation | PathAnnotation;

export default function ImageLightbox({ images, initialIndex, onClose, jobId }: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [mode, setMode] = useState<Mode>("annotate");
  const [tool, setTool] = useState<Tool>("draw");
  const [color, setColor] = useState("#00ff88"); // Neon green default
  const [lineWidth, setLineWidth] = useState(15); // 5x thicker default (was 3)
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [circleStart, setCircleStart] = useState<{ x: number; y: number } | null>(null);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  
  // Track all annotations for proper redrawing
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const currentPathRef = useRef<{ x: number; y: number }[]>([]);
  const currentCircleRef = useRef<{ centerX: number; centerY: number; radius: number } | null>(null);
  
  // Touch gesture state
  const [touchStart, setTouchStart] = useState<{ dist: number; center: { x: number; y: number }; zoom: number; offset: { x: number; y: number } } | null>(null);

  const utils = trpc.useUtils();
  
  // Server-side upload (bypasses CORS)
  const uploadImage = trpc.images.upload.useMutation({
    onSuccess: () => {
      utils.images.listByJob.invalidate({ jobId });
      toast.success("Annotated image saved");
      setHasChanges(false);
    },
    onError: (error) => {
      toast.error(`Save failed: ${error.message}`);
    },
  });

  const currentImage = images[currentIndex];

  useEffect(() => {
    void loadImage();
    setZoom(1); // Reset zoom when changing images
    setPanOffset({ x: 0, y: 0 }); // Reset pan when changing images
  }, [currentIndex]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  // Prevent background scrolling when touching canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventScroll = (e: TouchEvent) => {
      e.preventDefault();
    };

    canvas.addEventListener('touchstart', preventScroll, { passive: false });
    canvas.addEventListener('touchmove', preventScroll, { passive: false });
    canvas.addEventListener('touchend', preventScroll, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', preventScroll);
      canvas.removeEventListener('touchmove', preventScroll);
      canvas.removeEventListener('touchend', preventScroll);
    };
  }, []);

  // Mouse wheel zoom (only in pan mode)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (mode !== "pan") return;
      
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => Math.max(0.5, Math.min(5, prev + delta)));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [mode]);

  // Redraw all annotations on top of the base image
  const redrawAnnotations = useCallback((ctx: CanvasRenderingContext2D, annotationList: Annotation[]) => {
    for (const annotation of annotationList) {
      if (annotation.type === "circle") {
        ctx.strokeStyle = annotation.color;
        ctx.lineWidth = annotation.lineWidth;
        ctx.globalCompositeOperation = "source-over";
        ctx.beginPath();
        ctx.arc(annotation.centerX, annotation.centerY, annotation.radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (annotation.type === "path") {
        if (annotation.points.length < 2) continue;
        
        ctx.strokeStyle = annotation.isEraser ? "#ffffff" : annotation.color;
        ctx.lineWidth = annotation.lineWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalCompositeOperation = annotation.isEraser ? "destination-out" : "source-over";
        
        ctx.beginPath();
        ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
        for (let i = 1; i < annotation.points.length; i++) {
          ctx.lineTo(annotation.points[i].x, annotation.points[i].y);
        }
        ctx.stroke();
      }
    }
    // Reset composite operation
    ctx.globalCompositeOperation = "source-over";
  }, []);

  // Redraw the entire canvas (image + all annotations)
  const redrawCanvas = useCallback((previewCircle?: { centerX: number; centerY: number; radius: number }) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !img || !ctx) return;

    // Clear and draw base image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // Draw all saved annotations
    redrawAnnotations(ctx, annotations);

    // Draw preview circle if provided
    if (previewCircle && previewCircle.radius > 0) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.globalCompositeOperation = "source-over";
      ctx.beginPath();
      ctx.arc(previewCircle.centerX, previewCircle.centerY, previewCircle.radius, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }, [annotations, color, lineWidth, redrawAnnotations]);

  const loadImage = async () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    // Helper to convert base64 to Blob
    const base64ToBlob = (base64: string, contentType: string): Blob => {
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: contentType });
    };

    // Try direct fetch first (works if CORS is configured), fall back to server proxy
    const downloadImageBlob = async (url: string) => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to download image preview (status ${response.status})`);
      }
      return await response.blob();
    };

    const getPreviewBlob = async () => {
      // First, try direct fetch from cached URLs (works if CORS is configured)
      const cachedUrls = [currentImage.imageUrls?.preview, currentImage.imageUrls?.full].filter(
        Boolean
      ) as string[];

      for (const url of cachedUrls) {
        try {
          return await downloadImageBlob(url);
        } catch (error) {
          console.warn("[ImageLightbox] Direct fetch failed (likely CORS), trying server proxy", error);
        }
      }

      // Fall back to server-side proxy (bypasses CORS)
      // Use preview variant key if available, otherwise use the main fileKey
      const previewKey = currentImage.imageUrls?.preview 
        ? currentImage.fileKey.replace(/\/[^/]+$/, '/preview_1200.jpg')
        : currentImage.fileKey;
      
      console.log("[ImageLightbox] Using server proxy to fetch image");
      const proxyResult = await utils.client.images.getImageBlob.query({ fileKey: previewKey });
      
      return base64ToBlob(proxyResult.base64, proxyResult.contentType);
    };

    setIsLoading(true);
    try {
      const blob = await getPreviewBlob();
      const objectUrl = URL.createObjectURL(blob);

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      objectUrlRef.current = objectUrl;

      img.onload = () => {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        setIsLoading(false);
      };

      img.onerror = () => {
        setIsLoading(false);
        toast.error("Failed to load image");
      };

      img.src = objectUrl;
      setHasChanges(false);
      setAnnotations([]); // Reset annotations when loading new image
      currentPathRef.current = [];
    } catch (error) {
      console.error(error);
      setIsLoading(false);
      toast.error(error instanceof Error ? error.message : "Failed to load image");
    }
  };

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0]?.clientX || 0;
      clientY = e.touches[0]?.clientY || 0;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0]!.clientX - touches[1]!.clientX;
    const dy = touches[0]!.clientY - touches[1]!.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touches: React.TouchList) => {
    if (touches.length < 2) return { x: 0, y: 0 };
    return {
      x: (touches[0]!.clientX + touches[1]!.clientX) / 2,
      y: (touches[0]!.clientY + touches[1]!.clientY) / 2,
    };
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      // Two-finger gesture: pinch zoom and pan
      const dist = getTouchDistance(e.touches);
      const center = getTouchCenter(e.touches);
      setTouchStart({
        dist,
        center,
        zoom,
        offset: panOffset,
      });
      setIsDrawing(false); // Cancel any drawing
      setIsPanning(false);
    } else if (e.touches.length === 1) {
      // Single-finger: depends on mode
      startDrawing(e);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2 && touchStart) {
      // Two-finger gesture: pinch zoom and pan
      const dist = getTouchDistance(e.touches);
      const center = getTouchCenter(e.touches);
      
      // Calculate zoom based on pinch distance
      const scale = dist / touchStart.dist;
      const newZoom = Math.max(0.5, Math.min(5, touchStart.zoom * scale));
      setZoom(newZoom);
      
      // Calculate pan based on center movement
      const dx = center.x - touchStart.center.x;
      const dy = center.y - touchStart.center.y;
      setPanOffset({
        x: touchStart.offset.x + dx,
        y: touchStart.offset.y + dy,
      });
    } else if (e.touches.length === 1 && !touchStart) {
      // Single-finger: depends on mode
      draw(e);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length < 2) {
      setTouchStart(null);
    }
    if (e.touches.length === 0) {
      stopDrawing();
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    // Ignore if two-finger gesture is active
    if ('touches' in e && e.touches.length > 1) return;
    
    if (mode === "pan") {
      // Start panning
      setIsPanning(true);
      const pos = getMousePos(e);
      setPanStart({ x: pos.x - panOffset.x, y: pos.y - panOffset.y });
      return;
    }

    // Annotation mode
    const pos = getMousePos(e);
    setIsDrawing(true);

    if (tool === "circle") {
      setCircleStart(pos);
    } else {
      // Start a new path
      currentPathRef.current = [pos];
      
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;

      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    // Ignore if two-finger gesture is active
    if ('touches' in e && e.touches.length > 1) return;
    
    if (mode === "pan" && isPanning) {
      // Update pan offset
      const pos = getMousePos(e);
      if (panStart) {
        setPanOffset({
          x: pos.x - panStart.x,
          y: pos.y - panStart.y
        });
      }
      return;
    }

    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const pos = getMousePos(e);

    if (tool === "circle") {
      // Preview circle while dragging - redraw canvas with all annotations plus preview
      if (circleStart) {
        const radius = Math.sqrt(
          Math.pow(pos.x - circleStart.x, 2) + Math.pow(pos.y - circleStart.y, 2)
        );

        // Store current circle for finalization
        currentCircleRef.current = {
          centerX: circleStart.x,
          centerY: circleStart.y,
          radius,
        };

        redrawCanvas({
          centerX: circleStart.x,
          centerY: circleStart.y,
          radius,
        });
      }
    } else {
      // Track path points
      currentPathRef.current.push(pos);
      
      ctx.strokeStyle = tool === "erase" ? "#ffffff" : color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (tool === "erase") {
        ctx.globalCompositeOperation = "destination-out";
      } else {
        ctx.globalCompositeOperation = "source-over";
      }

      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }

    setHasChanges(true);
  };

  const stopDrawing = () => {
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      return;
    }

    if (!isDrawing) return;

    if (tool === "circle" && circleStart && currentCircleRef.current) {
      // Save the circle annotation
      const circleAnnotation: CircleAnnotation = {
        type: "circle",
        centerX: currentCircleRef.current.centerX,
        centerY: currentCircleRef.current.centerY,
        radius: currentCircleRef.current.radius,
        color: color,
        lineWidth: lineWidth,
      };
      setAnnotations(prev => [...prev, circleAnnotation]);
      currentCircleRef.current = null;
      setCircleStart(null);
    } else if (tool !== "circle" && currentPathRef.current.length > 1) {
      // Save the path annotation
      const pathAnnotation: PathAnnotation = {
        type: "path",
        points: [...currentPathRef.current],
        color: color,
        lineWidth: lineWidth,
        isEraser: tool === "erase",
      };
      setAnnotations(prev => [...prev, pathAnnotation]);
      currentPathRef.current = [];
    }

    setIsDrawing(false);
  };

  const handleReset = () => {
    setAnnotations([]);
    currentPathRef.current = [];
    currentCircleRef.current = null;
    loadImage();
    setHasChanges(false);
    toast.info("Annotations reset");
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error("Failed to create blob"));
          },
          "image/jpeg",
          0.95
        );
      });

      const filename = `annotated-${currentImage.filename || "image.jpg"}`;

      // Convert blob to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Upload via server (bypasses CORS)
      await uploadImage.mutateAsync({
        jobId,
        taskId: undefined,
        filename,
        mimeType: "image/jpeg",
        fileSize: blob.size,
        base64Data,
        caption: currentImage.caption || undefined,
      });
    } catch (error) {
      console.error("Save error:", error);
      toast.error(`Failed to save: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Use JPEG format with 92% quality for good compression
    // Without this, canvas.toBlob defaults to PNG which can be 6x larger!
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `annotated-${currentImage.filename?.replace(/\.[^.]+$/, '') || "image"}.jpg`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Image downloaded");
      },
      "image/jpeg",
      0.92
    );
  };

  const handleDownloadOriginal = async () => {
    try {
      // Helper to convert base64 to Blob
      const base64ToBlob = (base64: string, contentType: string): Blob => {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: contentType });
      };

      // Use server proxy to download full image
      // Use full variant key if available, otherwise use the main fileKey
      const fullKey = currentImage.imageUrls?.full 
        ? currentImage.fileKey.replace(/\/[^/]+$/, '/full.jpg')
        : currentImage.fileKey;
      
      const proxyResult = await utils.client.images.getImageBlob.query({ fileKey: fullKey });
      
      const blob = base64ToBlob(proxyResult.base64, proxyResult.contentType);
      const url = URL.createObjectURL(blob);

      const anchor = document.createElement("a");
      anchor.href = url;
      const safeName = currentImage.filename?.replace(/\.[^.]+$/, "") || `project-image-${currentImage.id}`;
      anchor.download = `${safeName}.jpg`;
      anchor.click();
      
      URL.revokeObjectURL(url);
      toast.success("Original download started");
    } catch (error) {
      console.error(error);
      toast.error("Failed to download original image");
    }
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Hidden image for loading */}
      <img ref={imgRef} className="hidden" crossOrigin="anonymous" alt="" />

      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
          <span className="text-sm">
            {currentIndex + 1} / {images.length}
          </span>
        </div>
      </div>

      {/* Toolbar - Horizontal scrollable on mobile */}
      <div className="overflow-x-auto px-4 pb-4 bg-black/50">
        <div className="flex items-center justify-center gap-2 min-w-max">
          {/* Mode Toggle */}
          <Button
            variant={mode === "pan" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode(mode === "pan" ? "annotate" : "pan")}
            title={mode === "pan" ? "Switch to Draw mode" : "Pan & Zoom mode"}
          >
            <Move className="h-4 w-4 mr-2" />
            {mode === "pan" ? "Pan & Zoom" : "Pan & Zoom"}
          </Button>

          {/* Annotation Tools (only visible in annotate mode) */}
          {mode === "annotate" && (
            <>
              <div className="w-px h-6 bg-border" />
              <Button
                variant={tool === "draw" ? "default" : "outline"}
                size="sm"
                onClick={() => setTool("draw")}
                title="Draw"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant={tool === "circle" ? "default" : "outline"}
                size="sm"
                onClick={() => setTool("circle")}
                title="Circle"
              >
                <Circle className="h-4 w-4" />
              </Button>
              <Button
                variant={tool === "erase" ? "default" : "outline"}
                size="sm"
                onClick={() => setTool("erase")}
                title="Eraser"
              >
                <Eraser className="h-4 w-4" />
              </Button>

              <div className="w-px h-6 bg-border" />

              {/* Brush Thickness */}
              <select
                value={lineWidth}
                onChange={(e) => setLineWidth(Number(e.target.value))}
                className="h-9 px-3 rounded-md border bg-background text-sm"
                title="Brush thickness"
              >
                <option value="5">Thin</option>
                <option value="15">Medium</option>
                <option value="30">Thick</option>
                <option value="50">Very Thick</option>
              </select>

              {/* Color Picker */}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 rounded-md border cursor-pointer"
                title="Color picker"
              />
            </>
          )}

          {/* Zoom Display (only visible in pan mode) */}
          {mode === "pan" && (
            <>
              <div className="w-px h-6 bg-border" />
              <span className="text-sm text-white px-3">{Math.round(zoom * 100)}%</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setZoom(1);
                  setPanOffset({ x: 0, y: 0 });
                }}
                title="Reset zoom"
              >
                Reset
              </Button>
            </>
          )}

          <div className="w-px h-6 bg-border" />

          {/* Actions */}
          <Button variant="outline" size="sm" onClick={handleReset} title="Reset">
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={
              !hasChanges ||
              uploadImage.isPending
            }
          >
            {uploadImage.isPending
              ? "Saving..."
              : "Save"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} title="Download annotated">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDownloadOriginal} title="Download original full-res">
            <Download className="h-4 w-4" />
            <span className="sr-only">Download original</span>
          </Button>
        </div>
      </div>

      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center p-4"
        style={{
          cursor: mode === "pan" ? (isPanning ? "grabbing" : "grab") : "crosshair"
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="max-w-full max-h-full touch-none"
          style={{
            transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
            transformOrigin: "center center",
            transition: isPanning || touchStart ? "none" : "transform 0.1s ease-out"
          }}
        />
      </div>

      {/* Navigation Arrows */}
      {images.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
            onClick={goToPrevious}
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
            onClick={goToNext}
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        </>
      )}
    </div>
  );
}
