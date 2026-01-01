import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "@/components/ui/Icon";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState } from "react";

interface PDFExportButtonProps {
  jobId: number;
  jobTitle: string;
}

export function PDFExportButton({ jobId, jobTitle }: PDFExportButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const { data: pdfData, isLoading: isLoadingPDF } = trpc.export.jobPDF.useQuery(
    { jobId },
    { enabled: !!jobId }
  );

  const handleExport = async () => {
    if (!pdfData?.html) {
      toast.error("PDF data not available");
      return;
    }

    try {
      setIsPending(true);

      // Create a blob from the HTML
      const blob = new Blob([pdfData.html], { type: "text/html" });
      const url = URL.createObjectURL(blob);

      // Create an iframe to render the HTML
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = url;
      document.body.appendChild(iframe);

      // Wait for iframe to load, then print
      iframe.onload = async () => {
        try {
          // Use iframe's print function
          iframe.contentWindow?.print();

          // Clean up after a delay
          setTimeout(() => {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(url);
          }, 1000);

          toast.success("PDF opened in print dialog");
        } catch (error) {
          console.error("Print error:", error);
          toast.error("Failed to open print dialog");
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
        }
      };

      iframe.onerror = () => {
        toast.error("Failed to load PDF");
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      };
    } catch (error: any) {
      console.error("PDF export error:", error);
      toast.error("Failed to generate PDF: " + (error?.message || "Unknown error"));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={isPending || isLoadingPDF || !pdfData}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {isPending || isLoadingPDF ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileDown className="h-4 w-4" />
      )}
      {isPending ? "Generating..." : isLoadingPDF ? "Loading..." : "Export PDF"}
    </Button>
  );
}
