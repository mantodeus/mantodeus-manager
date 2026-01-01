import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "@/components/ui/Icon";
import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

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
  }, [pdfUrl]);

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
            className="flex-1 overflow-auto bg-black flex items-center justify-center"
            style={{ touchAction: "pan-x pan-y" }}
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
