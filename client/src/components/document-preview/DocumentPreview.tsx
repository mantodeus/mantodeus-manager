import { useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

type DocumentPreviewProps = {
  fileUrl: string;
  fileName?: string;
  mimeType: string;
  onClose?: () => void;
};

export function DocumentPreview({
  fileUrl,
  fileName,
  mimeType,
}: DocumentPreviewProps) {
  const isPdf = mimeType === "application/pdf";
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [scale, setScale] = useState(1);
  const lastTapRef = useRef(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const scaleRef = useRef(1);

  useEffect(() => {
    setScale(1);
    scaleRef.current = 1;
    setLoadError(null);
  }, [fileUrl]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const nextWidth = Math.floor(container.clientWidth);
      if (nextWidth > 0) {
        setContainerWidth(nextWidth);
      }
    };

    updateSize();
    const resizeObserver = new ResizeObserver(() => updateSize());
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let initialDistance = 0;
    let initialScale = 1;
    let isPinching = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        isPinching = true;
        e.preventDefault();
        e.stopPropagation();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        initialDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY,
        );
        initialScale = scaleRef.current;
      } else {
        isPinching = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && isPinching && initialDistance > 0) {
        e.preventDefault();
        e.stopPropagation();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY,
        );
        const nextScale = initialScale * (currentDistance / initialDistance);
        const clampedScale = Math.max(1, Math.min(4, nextScale));
        scaleRef.current = clampedScale;
        setScale(clampedScale);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        isPinching = false;
        initialDistance = 0;
      }
    };

    const handleGesture = (e: Event) => {
      e.preventDefault();
    };

    const options = { passive: false };
    container.addEventListener("touchstart", handleTouchStart, options);
    container.addEventListener("touchmove", handleTouchMove, options);
    container.addEventListener("touchend", handleTouchEnd, options);
    container.addEventListener("touchcancel", handleTouchEnd, options);
    container.addEventListener("gesturestart", handleGesture, options);
    container.addEventListener("gesturechange", handleGesture, options);
    container.addEventListener("gestureend", handleGesture, options);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart, options);
      container.removeEventListener("touchmove", handleTouchMove, options);
      container.removeEventListener("touchend", handleTouchEnd, options);
      container.removeEventListener("touchcancel", handleTouchEnd, options);
      container.removeEventListener("gesturestart", handleGesture, options);
      container.removeEventListener("gesturechange", handleGesture, options);
      container.removeEventListener("gestureend", handleGesture, options);
    };
  }, []);

  const handleTap = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) return;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      const nextScale = scaleRef.current < 2 ? 2 : 1;
      scaleRef.current = nextScale;
      setScale(nextScale);
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
  };

  return (
    <div
      ref={containerRef}
      className="w-full overflow-auto"
      style={{
        height: "min(100dvh, 100%)",
        touchAction: "pan-x pan-y",
      }}
      onTouchEnd={handleTap}
    >
      <div
        className="w-full"
        style={{
          aspectRatio: "210 / 297",
          maxHeight: "100dvh",
        }}
      >
        {isPdf ? (
          <Document
            file={
              fileUrl.startsWith("blob:")
                ? fileUrl
                : { url: fileUrl, withCredentials: true }
            }
            loading={<div className="p-4 text-muted-foreground">Loading preview...</div>}
            error={<div className="p-4 text-destructive">{loadError || "Failed to load preview."}</div>}
            onLoadError={(error) => {
              console.error("DocumentPreview PDF load error:", error);
              setLoadError(error?.message || "Failed to load preview.");
            }}
          >
            <Page
              pageNumber={1}
              width={containerWidth || undefined}
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>
        ) : (
          <img
            src={fileUrl}
            alt={fileName || "Document preview"}
            className="h-auto block max-w-none"
            style={{ width: `${scale * 100}%` }}
            draggable={false}
            onError={(event) => {
              console.error("DocumentPreview image load error:", event);
              setLoadError("Failed to load preview.");
            }}
          />
        )}
        {loadError && !isPdf && (
          <div className="p-4 text-destructive">{loadError}</div>
        )}
      </div>
    </div>
  );
}
