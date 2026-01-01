import { useState } from "react";
import { Button } from "./ui/button";
import { Loader2 } from "@/components/ui/Icon";
import { toast } from "sonner";

interface PDFViewerProps {
  projectId?: number;
  invoiceId?: number;
  type: "project" | "invoice";
  label?: string;
}

/**
 * PDF Viewer Component
 * 
 * Usage:
 * <PDFViewer projectId={123} type="project" />
 * <PDFViewer invoiceId={456} type="invoice" />
 */
export function PDFViewer({ projectId, invoiceId, type, label = "View PDF" }: PDFViewerProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleViewPDF = () => {
    if (type === "project" && projectId) {
      window.open(`/api/projects/${projectId}/pdf`, "_blank");
    } else if (type === "invoice" && invoiceId) {
      // For invoices, use tRPC or create endpoint
      toast.info("Invoice PDF generation via tRPC");
    }
  };

  const handleDownloadPDF = async () => {
    if (type === "project" && projectId) {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/projects/${projectId}/pdf`);
        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: "Failed to generate PDF" }));
          throw new Error(error.message || error.error || "Failed to generate PDF");
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `project-${projectId}-report.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast.success("PDF downloaded successfully");
      } catch (error) {
        console.error("PDF download error:", error);
        toast.error(error instanceof Error ? error.message : "Failed to download PDF");
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (type === "project" && !projectId) return null;
  if (type === "invoice" && !invoiceId) return null;

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        onClick={handleViewPDF}
        disabled={isLoading}
      >
        {label}
      </Button>
      <Button
        variant="outline"
        onClick={handleDownloadPDF}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          "Download"
        )}
      </Button>
    </div>
  );
}

