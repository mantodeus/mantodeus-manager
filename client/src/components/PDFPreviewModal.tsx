import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, Share2 } from "@/components/ui/Icon";
import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { toast } from "sonner";

// Set up the PDF worker from node_modules
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

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
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [userScale, setUserScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build the URL - prefer fileKey with file proxy, fallback to direct URL
  const pdfUrl = fileKey 
    ? `/api/file-proxy?key=${encodeURIComponent(fileKey)}&filename=${encodeURIComponent(fileName)}`
    : fileUrl || "";
  
  const downloadUrl = fileKey 
    ? `/api/file-proxy?key=${encodeURIComponent(fileKey)}&filename=${encodeURIComponent(fileName)}&download=true`
    : fileUrl || "";

  useEffect(() => {
    setNumPages(0);
    setPdfError(null);
    setUserScale(1);
  }, [pdfUrl]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      const nextWidth = Math.floor(container.clientWidth);
      setContainerWidth(nextWidth > 0 ? nextWidth : null);
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(() => updateWidth());
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let initialDistance = 0;
    let initialScale = userScale;
    let isPinching = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        isPinching = true;
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        initialDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        initialScale = userScale;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && isPinching && initialDistance > 0) {
        e.preventDefault();
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
    ? "w-[100vw] h-[100vh] max-w-none max-h-none rounded-none p-0 flex flex-col"
    : "max-w-4xl max-h-[90vh] flex flex-col";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={contentClassName} showCloseButton={false}>
        <DialogHeader className={fullScreen ? "px-4 py-3 border-b border-border" : ""}>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="truncate">{fileName}</DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handleShare}>
                <Share2 className="w-4 h-4" />
                <span className="sr-only">Share</span>
              </Button>
              <Button variant="ghost" size="icon" onClick={handleDownload}>
                <Download className="w-4 h-4" />
                <span className="sr-only">Download</span>
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* PDF Viewer */}
          <div
            ref={containerRef}
            className="flex-1 overflow-auto bg-black flex items-center justify-center"
            style={{ touchAction: "pan-x pan-y pinch-zoom" }}
          >
            {isLoading && (
              <div className="text-gray-400">Loading PDF...</div>
            )}
            {!pdfUrl && !isLoading && (
              <div className="text-gray-400">Preparing preview...</div>
            )}
            {pdfError && (
              <div className="text-red-500">{pdfError}</div>
            )}
            {pdfUrl && (
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadStart={() => setIsLoading(true)}
                onLoadError={() => {
                  setIsLoading(false);
                  setPdfError("Failed to load PDF");
                }}
                loading={<div className="text-gray-400">Loading...</div>}
                error={<div className="text-red-500">Failed to load PDF</div>}
              >
                {Array.from({ length: numPages }, (_, index) => (
                  <Page
                    key={`page-${index + 1}`}
                    pageNumber={index + 1}
                    renderTextLayer
                    renderAnnotationLayer
                    width={containerWidth ? Math.max(1, containerWidth - 24) : undefined}
                    scale={userScale}
                  />
                ))}
              </Document>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
