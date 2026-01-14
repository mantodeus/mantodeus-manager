import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, Share2 } from "@/components/ui/Icon";
import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { toast } from "sonner";

// Set up the PDF worker from node_modules
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl?: string;
  fileKey?: string;
  fileName: string;
  fullScreen?: boolean;
}

export function PDFPreviewModal({
  isOpen,
  onClose,
  fileUrl,
  fileKey,
  fileName,
  fullScreen = false,
}: PDFPreviewModalProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const [baseScale, setBaseScale] = useState(1);
  const [userScale, setUserScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build the URL - prefer fileKey with file proxy, fallback to direct URL
  const pdfUrl = fileKey 
    ? `/api/file-proxy?key=${encodeURIComponent(fileKey)}&filename=${encodeURIComponent(fileName)}`
    : fileUrl || "";
  
  const downloadUrl = fileKey 
    ? `/api/file-proxy?key=${encodeURIComponent(fileKey)}&filename=${encodeURIComponent(fileName)}&download=true`
    : fileUrl || "";
  const pdfOptions = {
    disableRange: true,
    disableStream: true,
    disableAutoFetch: true,
  };

  useEffect(() => {
    setNumPages(0);
    setPdfError(null);
    setPageSize(null);
    setBaseScale(1);
    setUserScale(1);
  }, [pdfUrl]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const nextWidth = Math.floor(container.clientWidth);
      const nextHeight = Math.floor(container.clientHeight);
      if (nextWidth > 0 && nextHeight > 0) {
        setContainerSize({ width: nextWidth, height: nextHeight });
      }
    };

    updateSize();

    const resizeObserver = new ResizeObserver(() => updateSize());
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!containerSize || !pageSize) return;

    const padding = 24;
    const widthScale = (containerSize.width - padding) / pageSize.width;
    const heightScale = (containerSize.height - padding) / pageSize.height;
    const fitScale = Math.min(widthScale, heightScale, 1);
    setBaseScale(Math.max(0.1, fitScale));
  }, [containerSize, pageSize]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let initialDistance = 0;
    let initialScale = userScale;
    let isPinching = false;

    const handleTouchStart = (e: TouchEvent) => {
      // Only handle pinch zoom (2 touches), allow single touch for scrolling
      if (e.touches.length === 2) {
        isPinching = true;
        e.preventDefault();
        e.stopPropagation();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        initialDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        initialScale = userScale;
      } else {
        isPinching = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Only prevent default for pinch zoom (2 touches), allow single touch for scrolling
      if (e.touches.length === 2 && isPinching && initialDistance > 0) {
        e.preventDefault();
        e.stopPropagation();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        const scale = currentDistance / initialDistance;
        const nextScale = initialScale * scale;
        setUserScale(Math.max(0.5, Math.min(3, nextScale)));
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        isPinching = false;
        initialDistance = 0;
      }
    };

    const options = { passive: false };
    container.addEventListener("touchstart", handleTouchStart, options);
    container.addEventListener("touchmove", handleTouchMove, options);
    container.addEventListener("touchend", handleTouchEnd, options);
    container.addEventListener("touchcancel", handleTouchEnd, options);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart, options);
      container.removeEventListener("touchmove", handleTouchMove, options);
      container.removeEventListener("touchend", handleTouchEnd, options);
      container.removeEventListener("touchcancel", handleTouchEnd, options);
    };
  }, [userScale]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    setPdfError(null);
  };

  const handlePageLoadSuccess = (page: { getViewport: (options: { scale: number }) => { width: number; height: number } }) => {
    if (pageSize) return;
    const viewport = page.getViewport({ scale: 1 });
    setPageSize({ width: viewport.width, height: viewport.height });
  };

  const handleDownload = async () => {
    if (!downloadUrl) return;
    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error("Failed to download PDF");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Fall back to direct download URL if fetch fails
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleShare = async () => {
    if (!downloadUrl) return;
    
    // Use Web Share API if available (mobile)
    if (navigator.share) {
      try {
        const response = await fetch(downloadUrl);
        if (!response.ok) {
          throw new Error("Failed to fetch PDF");
        }
        const blob = await response.blob();
        const file = new File([blob], fileName, { type: "application/pdf" });
        
        await navigator.share({
          title: fileName,
          files: [file],
        });
      } catch (error) {
        // If share fails or is cancelled, try sharing the URL
        if (error instanceof Error && error.name !== "AbortError") {
          try {
            await navigator.share({
              title: fileName,
              text: fileName,
              url: downloadUrl,
            });
          } catch (shareError) {
            // Fall back to copying URL
            handleCopyUrl();
          }
        }
      }
    } else {
      // Fall back to copying URL to clipboard
      handleCopyUrl();
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(downloadUrl);
      toast.success("Link copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const contentClassName = fullScreen
    ? "flex flex-col p-0 max-h-[calc(100vh-var(--bottom-safe-area,0px)-2rem)] mb-[calc(var(--bottom-safe-area,0px)+1rem)]"
    : "max-w-4xl max-h-[90vh] flex flex-col";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className={contentClassName} 
        showCloseButton={false}
        style={fullScreen ? {
          height: 'calc(100vh - var(--bottom-safe-area, 0px) - 2rem)',
          maxHeight: 'calc(100vh - var(--bottom-safe-area, 0px) - 2rem)',
          marginBottom: 'calc(var(--bottom-safe-area, 0px) + 1rem)',
        } : undefined}
      >
        <DialogHeader className={fullScreen ? "px-4 py-3 border-b border-border" : ""}>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="truncate">{fileName}</DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="icon" size="icon" onClick={handleShare}>
                <Share2 className="w-4 h-4" />
                <span className="sr-only">Share</span>
              </Button>
              <Button variant="icon" size="icon" onClick={handleDownload}>
                <Download className="w-4 h-4" />
                <span className="sr-only">Download</span>
              </Button>
              <Button variant="icon" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* PDF Viewer */}
          <div
            ref={containerRef}
            className="flex-1 overflow-auto bg-black flex items-center justify-center min-h-0"
            style={{ touchAction: fullScreen ? "pan-x pan-y pinch-zoom" : "pan-x pan-y" }}
          >
            {isLoading && (
              <div className="text-gray-400">Loading PDF...</div>
            )}
            {!pdfUrl && !isLoading && (
              <div className="text-gray-400">Preparing preview...</div>
            )}
            {pdfError && !pdfUrl && (
              <div className="text-red-500">{pdfError}</div>
            )}
            {pdfUrl && !pdfError && (
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadStart={() => setIsLoading(true)}
                onLoadError={(error) => {
                  setIsLoading(false);
                  setPdfError("Failed to load PDF");
                  console.error("PDF load error:", error);
                }}
                options={pdfOptions}
                loading={<div className="text-gray-400">Loading...</div>}
                error={<div className="text-red-500">Failed to load PDF</div>}
              >
                {Array.from({ length: numPages }, (_, index) => (
                  <Page
                    key={`page-${index + 1}`}
                    pageNumber={index + 1}
                    renderTextLayer
                    renderAnnotationLayer
                    scale={baseScale * userScale}
                    onLoadSuccess={index === 0 ? handlePageLoadSuccess : undefined}
                  />
                ))}
              </Document>
            )}
            {pdfError && pdfUrl && (
              <iframe
                src={pdfUrl}
                className="w-full h-full border-0"
                title={fileName}
                style={{ width: "100%", height: "100%" }}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
