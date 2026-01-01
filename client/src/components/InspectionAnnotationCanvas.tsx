/**
 * Annotation Canvas Component
 * 
 * Minimal annotation tools: circle, arrow, free-draw, undo
 * Single-layer annotations, touch-friendly
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Circle, ArrowRight, Pencil, Undo2, X, Check } from "@/components/ui/Icon";

type AnnotationTool = "circle" | "arrow" | "draw" | null;

interface Annotation {
  type: "circle" | "arrow" | "draw";
  points: number[];
  color: string;
  lineWidth: number;
}

interface InspectionAnnotationCanvasProps {
  imageUrl: string;
  onSave: (annotatedImageUrl: string, annotatedBlob: Blob) => void;
  onCancel: () => void;
  existingAnnotations?: Annotation[];
}

export function InspectionAnnotationCanvas({
  imageUrl,
  onSave,
  onCancel,
  existingAnnotations = [],
}: InspectionAnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [tool, setTool] = useState<AnnotationTool>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>(existingAnnotations);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentPath, setCurrentPath] = useState<number[]>([]);
  const [color] = useState("#FF0000"); // Red for visibility
  const [lineWidth] = useState(3);

  // Load image and draw
  useEffect(() => {
    const loadImage = async () => {
      // If imageUrl is a storage key, get the blob URL
      let url = imageUrl;
      if (imageUrl.startsWith("img_")) {
        const { getImageUrl } = await import("@/lib/imageStorage");
        const blobUrl = await getImageUrl(imageUrl);
        if (!blobUrl) return;
        url = blobUrl;
      }

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Set canvas size to match image
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Draw image
        ctx.drawImage(img, 0, 0);

        // Draw existing annotations
        redrawAnnotations(ctx);
      };
      img.onerror = () => {
        console.error("Failed to load image for annotation");
      };
      img.src = url;
      imageRef.current = img;
    };

    loadImage();
  }, [imageUrl]);

  // Redraw annotations when they change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear and redraw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageRef.current, 0, 0);

    // Redraw annotations
    redrawAnnotations(ctx);
  }, [annotations, imageUrl]);

  const redrawAnnotations = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    annotations.forEach((annotation) => {
      ctx.strokeStyle = annotation.color || color;
      ctx.lineWidth = annotation.lineWidth || lineWidth;

      if (annotation.type === "circle") {
        const [x, y, radius] = annotation.points;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (annotation.type === "arrow") {
        const [x1, y1, x2, y2] = annotation.points;
        // Draw line
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const arrowLength = 15;
        const arrowAngle = Math.PI / 6;

        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(
          x2 - arrowLength * Math.cos(angle - arrowAngle),
          y2 - arrowLength * Math.sin(angle - arrowAngle)
        );
        ctx.moveTo(x2, y2);
        ctx.lineTo(
          x2 - arrowLength * Math.cos(angle + arrowAngle),
          y2 - arrowLength * Math.sin(angle + arrowAngle)
        );
        ctx.stroke();
      } else if (annotation.type === "draw") {
        ctx.beginPath();
        for (let i = 0; i < annotation.points.length; i += 2) {
          const x = annotation.points[i];
          const y = annotation.points[i + 1];
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }
    });
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX: number, clientY: number;

    if ("touches" in e) {
      // Touch event
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!tool) return;

    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    setIsDrawing(true);
    setStartPoint(coords);

    if (tool === "draw") {
      setCurrentPath([coords.x, coords.y]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !tool || !canvasRef.current || !startPoint) return;

    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    // Redraw base image and annotations
    if (imageRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.drawImage(imageRef.current, 0, 0);
      redrawAnnotations(ctx);
    }

    // Draw preview
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (tool === "circle") {
      const radius = Math.sqrt(
        Math.pow(coords.x - startPoint.x, 2) + Math.pow(coords.y - startPoint.y, 2)
      );
      ctx.beginPath();
      ctx.arc(startPoint.x, startPoint.y, radius, 0, 2 * Math.PI);
      ctx.stroke();
      // Update current path for final calculation
      setCurrentPath([coords.x, coords.y]);
    } else if (tool === "arrow") {
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();

      // Arrowhead
      const angle = Math.atan2(coords.y - startPoint.y, coords.x - startPoint.x);
      const arrowLength = 15;
      const arrowAngle = Math.PI / 6;

      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      ctx.lineTo(
        coords.x - arrowLength * Math.cos(angle - arrowAngle),
        coords.y - arrowLength * Math.sin(angle - arrowAngle)
      );
      ctx.moveTo(coords.x, coords.y);
      ctx.lineTo(
        coords.x - arrowLength * Math.cos(angle + arrowAngle),
        coords.y - arrowLength * Math.sin(angle + arrowAngle)
      );
      ctx.stroke();
      // Update current path for final calculation
      setCurrentPath([coords.x, coords.y]);
    } else if (tool === "draw") {
      setCurrentPath((prev) => [...prev, coords.x, coords.y]);
      ctx.beginPath();
      for (let i = 0; i < currentPath.length; i += 2) {
        const x = currentPath[i];
        const y = currentPath[i + 1];
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || !tool || !startPoint) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Get final coordinates from current path or start point
    let finalAnnotation: Annotation;

    if (tool === "circle") {
      // For circle, calculate radius from start to current position
      // Use last point in path or default radius
      const radius = currentPath.length >= 2
        ? Math.sqrt(
            Math.pow(currentPath[currentPath.length - 2] - startPoint.x, 2) + 
            Math.pow(currentPath[currentPath.length - 1] - startPoint.y, 2)
          )
        : 20; // Default radius
      finalAnnotation = {
        type: "circle",
        points: [startPoint.x, startPoint.y, radius],
        color,
        lineWidth,
      };
    } else if (tool === "arrow") {
      // For arrow, use last point in path or start point
      let endX = startPoint.x;
      let endY = startPoint.y;
      if (currentPath.length >= 2) {
        endX = currentPath[currentPath.length - 2];
        endY = currentPath[currentPath.length - 1];
      }
      finalAnnotation = {
        type: "arrow",
        points: [startPoint.x, startPoint.y, endX, endY],
        color,
        lineWidth,
      };
    } else {
      // Draw
      finalAnnotation = {
        type: "draw",
        points: currentPath.length > 0 ? currentPath : [startPoint.x, startPoint.y],
        color,
        lineWidth,
      };
    }

    setAnnotations((prev) => [...prev, finalAnnotation]);
    setIsDrawing(false);
    setStartPoint(null);
    setCurrentPath([]);
  };

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    handleMouseDown(e as any);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    handleMouseMove(e as any);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    handleMouseUp();
  };

  const handleUndo = () => {
    setAnnotations((prev) => prev.slice(0, -1));
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("Failed to save annotated image");
          return;
        }

        const annotatedUrl = URL.createObjectURL(blob);
        onSave(annotatedUrl, blob);
      },
      "image/jpeg",
      0.9
    );
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/80">
        <div className="flex items-center gap-2">
          <Button
            variant={tool === "circle" ? "default" : "ghost"}
            size="sm"
            onClick={() => setTool(tool === "circle" ? null : "circle")}
            className="text-white"
          >
            <Circle className="h-4 w-4" />
          </Button>
          <Button
            variant={tool === "arrow" ? "default" : "ghost"}
            size="sm"
            onClick={() => setTool(tool === "arrow" ? null : "arrow")}
            className="text-white"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant={tool === "draw" ? "default" : "ghost"}
            size="sm"
            onClick={() => setTool(tool === "draw" ? null : "draw")}
            className="text-white"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            disabled={annotations.length === 0}
            className="text-white"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            className="text-white"
          >
            <Check className="h-4 w-4 mr-2" />
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="max-w-full max-h-full touch-none"
          style={{ cursor: tool ? "crosshair" : "default" }}
        />
      </div>
    </div>
  );
}

