/**
 * Invoice Upload Review Dialog
 * 
 * Dialog for reviewing and confirming uploaded PDF invoice data.
 * User must confirm extracted data before invoice appears in list.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Loader2, FileText, Eye } from "@/components/ui/Icon";
import { toast } from "sonner";
import { PDFPreviewModal } from "@/components/PDFPreviewModal";
import { useIsMobile } from "@/hooks/useMobile";

interface InvoiceUploadReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: number | null;
  parsedData: {
    clientName: string | null;
    invoiceDate: Date | null;
    totalAmount: string | null;
    invoiceNumber: string | null;
  } | null;
  onSuccess?: () => void;
}

export function InvoiceUploadReviewDialog({
  open,
  onOpenChange,
  invoiceId,
  parsedData,
  onSuccess,
}: InvoiceUploadReviewDialogProps) {
  const isMobile = useIsMobile();
  const [clientId, setClientId] = useState<string>("none");
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [issueDate, setIssueDate] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState("invoice.pdf");

  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: invoice } = trpc.invoices.get.useQuery(
    { id: invoiceId! },
    { enabled: !!invoiceId }
  );

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handlePreviewPDF = async () => {
    if (!invoiceId || !invoice) return;
    
    // For uploaded invoices, use the original PDF from S3
    if (invoice.source === "uploaded" && invoice.originalPdfS3Key) {
      const fileName = invoice.invoiceName || invoice.originalFileName || invoice.invoiceNumber || "invoice.pdf";
      setPreviewFileName(fileName);
      setPreviewModalOpen(true);
      // PDFPreviewModal will use fileKey to fetch via file-proxy
      return;
    }
    
    // For created invoices, generate PDF
    try {
      const { data: { session } } = await import("@/lib/supabase").then(m => m.supabase.auth.getSession());
      if (!session?.access_token) {
        toast.error("Please log in to preview invoices");
        return;
      }
      const response = await fetch(`/api/invoices/${invoiceId}/pdf?preview=true`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(errorData.error || 'Failed to generate preview');
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(url);
      setPreviewFileName(invoice?.invoiceName || invoice?.invoiceNumber || "invoice.pdf");
      setPreviewModalOpen(true);
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('Failed to open preview');
    }
  };

  const utils = trpc.useUtils();
  const confirmMutation = trpc.invoices.confirmUploadedInvoice.useMutation({
    onSuccess: () => {
      toast.success("Invoice saved");
      onOpenChange(false);
      // Invalidate and refetch invoice list
      utils.invoices.list.invalidate();
      utils.invoices.listNeedsReview.invalidate();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error("Failed to save invoice: " + error.message);
    },
  });
  const updateMutation = trpc.invoices.update.useMutation({
    onSuccess: () => {
      toast.success("Invoice updated");
      onOpenChange(false);
      // Invalidate and refetch invoice list
      utils.invoices.list.invalidate();
      utils.invoices.listNeedsReview.invalidate();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error("Failed to update invoice: " + error.message);
    },
  });
  const cancelMutation = trpc.invoices.cancelUploadedInvoice.useMutation({
    onSuccess: () => {
      toast.success("Upload cancelled");
      onOpenChange(false);
      utils.invoices.list.invalidate();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error("Failed to cancel upload: " + error.message);
    },
  });

  // Initialize form when parsed data or invoice changes
  useEffect(() => {
    if (parsedData) {
      setInvoiceNumber(parsedData.invoiceNumber || "");
      setIssueDate(
        parsedData.invoiceDate
          ? new Date(parsedData.invoiceDate).toISOString().split("T")[0]
          : ""
      );
      setTotalAmount(parsedData.totalAmount || "");
      setClientId("none");
    } else if (invoice) {
      setInvoiceNumber(invoice.invoiceNumber || "");
      setIssueDate(
        invoice.issueDate
          ? new Date(invoice.issueDate).toISOString().split("T")[0]
          : ""
      );
      // Ensure totalAmount is always a string
      setTotalAmount(invoice.total ? String(invoice.total) : "");
      setClientId(invoice.clientId?.toString() || "none");
    }
  }, [parsedData, invoice]);

  // Try to match client by name if parsed
  useEffect(() => {
    if (parsedData?.clientName && clientId === "none" && contacts.length > 0) {
      const matched = contacts.find(
        (c) => c.name.toLowerCase() === parsedData.clientName?.toLowerCase()
      );
      if (matched) {
        setClientId(matched.id.toString());
      }
    }
  }, [parsedData?.clientName, contacts, clientId]);

  // Validation: check if form is valid for saving
  const isFormValid = Boolean(
    issueDate &&
    totalAmount &&
    parseFloat(totalAmount) > 0 &&
    new Date(issueDate).toString() !== "Invalid Date"
  );

  const handleSave = async () => {
    if (!invoiceId || !invoice) return;

    // Validate required fields
    if (!issueDate) {
      toast.error("Invoice date is required");
      return;
    }

    if (!totalAmount || parseFloat(totalAmount) <= 0) {
      toast.error("Total amount must be greater than 0");
      return;
    }

    // If invoice needs review, use confirm mutation
    // Otherwise, use regular update mutation for already-confirmed uploaded invoices
    if (invoice.needsReview) {
      await confirmMutation.mutateAsync({
        id: invoiceId,
        clientId: clientId !== "none" ? parseInt(clientId, 10) : null,
        invoiceNumber: invoiceNumber || undefined,
        issueDate: new Date(issueDate),
        totalAmount: String(totalAmount), // Ensure it's always a string
      });
    } else {
      // For already-confirmed uploaded invoices, use update mutation
      // Note: update mutation doesn't accept totalAmount directly, so we calculate from existing items or use subtotal
      await updateMutation.mutateAsync({
        id: invoiceId,
        invoiceNumber: invoiceNumber || invoice.invoiceNumber,
        clientId: clientId !== "none" ? parseInt(clientId, 10) : undefined,
        issueDate: new Date(issueDate),
        // Update mutation will preserve existing items and totals for uploaded invoices
      });
    }
  };

  const handleCancel = async () => {
    if (!invoiceId) {
      onOpenChange(false);
      return;
    }

    // For already-confirmed invoices, just close the dialog
    // Only delete if the invoice still needs review (unconfirmed upload)
    if (invoice && !invoice.needsReview) {
      onOpenChange(false);
      return;
    }

    // Delete the invoice and S3 file (only for unconfirmed uploads)
    await cancelMutation.mutateAsync({ id: invoiceId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {invoice?.needsReview ? "Review Invoice" : "Edit Invoice"}
            </DialogTitle>
            {!isMobile && (
              <Button variant="outline" size="icon" onClick={handlePreviewPDF}>
                <Eye className="h-4 w-4" />
              </Button>
            )}
          </div>
          <DialogDescription>
            {invoice?.needsReview 
              ? "We've extracted these details from the PDF. Please review and confirm before saving."
              : "Edit invoice metadata. The PDF document cannot be modified."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="client">Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger id="client">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No client</SelectItem>
                {contacts.map((contact) => (
                  <SelectItem key={contact.id} value={contact.id.toString()}>
                    {contact.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoiceNumber">Invoice Number</Label>
            <Input
              id="invoiceNumber"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Auto-generated if empty"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="issueDate">Invoice Date *</Label>
            <Input
              id="issueDate"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="totalAmount">Total Amount (€) *</Label>
            <Input
              id="totalAmount"
              type="number"
              step="0.01"
              min="0"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="0.00"
              required
              disabled={!invoice?.needsReview}
            />
            {!invoice?.needsReview && (
              <p className="text-xs text-muted-foreground">
                Total amount cannot be changed for confirmed uploaded invoices. The amount is preserved from the original PDF.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className={isMobile ? "flex-col gap-2" : ""}>
          <div className={isMobile ? "flex flex-col gap-2 w-full" : "flex gap-2"}>
            <Button 
              onClick={handleSave} 
              disabled={(confirmMutation.isPending || updateMutation.isPending || cancelMutation.isPending) || !isFormValid}
              className={isMobile ? "w-full" : ""}
            >
              {(confirmMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {invoice?.needsReview ? "Save" : "Update"}
            </Button>
            {isMobile && (
              <Button
                variant="outline"
                onClick={handlePreviewPDF}
                disabled={confirmMutation.isPending || updateMutation.isPending || cancelMutation.isPending}
                className="w-full"
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={handleCancel} 
              disabled={confirmMutation.isPending || updateMutation.isPending || cancelMutation.isPending}
              className={isMobile ? "w-full" : ""}
            >
              {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {invoice?.needsReview ? "Cancel" : "Close"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <PDFPreviewModal
        isOpen={previewModalOpen}
        onClose={() => {
          setPreviewModalOpen(false);
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
          }
          setPreviewUrl(null);
        }}
        fileUrl={previewUrl ?? undefined}
        fileKey={invoice?.originalPdfS3Key ?? undefined}
        fileName={previewFileName}
        fullScreen={isMobile}
      />
    </Dialog>
  );
}

