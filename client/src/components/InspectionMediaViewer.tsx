/**
 * Media Viewer Component
 * 
 * Fullscreen viewer for inspection media with original/annotated toggle.
 * Basic zoom and pan support.
 */

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, ZoomIn, ZoomOut, RotateCcw, Pencil } from "@/components/ui/Icon";
import { getImageUrl } from "@/lib/imageStorage";

interface InspectionMediaViewerProps {
  originalPath?: string | null;
  annotatedPath?: string | null;
  onClose: () => void;
  onAnnotate?: () => void;
}

export function InspectionMediaViewer({
  originalPath,
  annotatedPath,
  onClose,
  onAnnotate,
}: InspectionMediaViewerProps) {
  const [viewMode, setViewMode] = useState<"original" | "annotated">(
    annotatedPath ? "annotated" : "original"
  );
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const currentPath = viewMode === "annotated" ? annotatedPath : originalPath;

  useEffect(() => {
    if (!currentPath) {
      setImageUrl(null);
      return;
    }

    // Load image
    const loadImage = async () => {
      const url = await getImageUrl(currentPath);
      setImageUrl(url);
    };

    loadImage();

    return () => {
      if (imageUrl && imageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [currentPath]);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev * 1.5, 5));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev / 1.5, 0.5));
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const hasAnnotated = !!annotatedPath;
  const hasOriginal = !!originalPath;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/80">
        <div className="flex items-center gap-2">
          {hasOriginal && hasAnnotated && (
            <>
              <Button
                variant={viewMode === "original" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("original")}
                className="text-white"
              >
                Original
              </Button>
              <Button
                variant={viewMode === "annotated" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("annotated")}
                className="text-white"
              >
                Annotated
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onAnnotate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAnnotate}
              className="text-white"
            >
              <Pencil className="h-4 w-4 mr-2" />
              {annotatedPath ? "Re-annotate" : "Annotate"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            className="text-white"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            disabled={zoom >= 5}
            className="text-white"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-white"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Image Container */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden relative"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: zoom > 1 && isDragging ? "grabbing" : zoom > 1 ? "grab" : "default" }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={viewMode === "annotated" ? "Annotated" : "Original"}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transition: isDragging ? "none" : "transform 0.2s",
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
            draggable={false}
          />
        ) : (
          <div className="text-white">Loading image...</div>
        )}
      </div>
    </div>
  );
}

