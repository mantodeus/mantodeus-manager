import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download } from "lucide-react";
import { useState } from "react";
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
}

export function PDFPreviewModal({
  isOpen,
  onClose,
  fileUrl,
  fileKey,
  fileName,
}: PDFPreviewModalProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(100);
  const [isLoading, setIsLoading] = useState(false);

  // Build the URL - prefer fileKey with file proxy, fallback to direct URL
  const pdfUrl = fileKey 
    ? `/api/file-proxy?key=${encodeURIComponent(fileKey)}&filename=${encodeURIComponent(fileName)}`
    : fileUrl || "";
  
  const downloadUrl = fileKey 
    ? `/api/file-proxy?key=${encodeURIComponent(fileKey)}&filename=${encodeURIComponent(fileName)}&download=true`
    : fileUrl || "";

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setCurrentPage(1);
    setIsLoading(false);
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 300));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 25, 50));
  };

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, numPages));
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1a1a1a] border-subtle max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white truncate">{fileName}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Controls */}
          <div className="flex items-center justify-between gap-4 p-4 bg-surface border-b border-subtle">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage <= 1}
                className="bg-surface border-subtle hover:bg-surface"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <span className="text-sm text-gray-300 min-w-[100px] text-center">
                {currentPage} / {numPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage >= numPages}
                className="bg-surface border-subtle hover:bg-surface"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= 50}
                className="bg-surface border-subtle hover:bg-surface"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>

              <span className="text-sm text-gray-300 min-w-[50px] text-center">
                {zoom}%
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= 300}
                className="bg-surface border-subtle hover:bg-surface"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="bg-surface border-subtle hover:bg-surface"
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* PDF Viewer */}
          <div className="flex-1 overflow-auto bg-surface flex items-center justify-center">
            {isLoading && (
              <div className="text-gray-400">Loading PDF...</div>
            )}
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadStart={() => setIsLoading(true)}
              loading={<div className="text-gray-400">Loading...</div>}
              error={<div className="text-red-500">Failed to load PDF</div>}
            >
              <Page
                pageNumber={currentPage}
                scale={zoom / 100}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </Document>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
