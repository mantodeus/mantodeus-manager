/**
 * Invoice Upload Review Dialog
 * 
 * Dialog for reviewing and confirming uploaded PDF invoice data.
 * Per spec: Review state has only Preview button in header, Save/Cancel in footer.
 * No lifecycle actions allowed in review state.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";
import { getInvoiceState, getDerivedValues } from "@/lib/invoiceState";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "@/components/ui/Icon";

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

  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: invoice } = trpc.invoices.get.useQuery(
    { id: invoiceId! },
    { enabled: !!invoiceId }
  );

  const handlePreviewPDF = async () => {
    if (!invoiceId || !invoice) return;
    
    // For uploaded invoices, open file directly via file-proxy in new tab (native browser preview)
    if (invoice.source === "uploaded" && invoice.originalPdfS3Key) {
      const fileName = invoice.invoiceName || invoice.originalFileName || invoice.invoiceNumber || "invoice.pdf";
      const fileUrl = `/api/file-proxy?key=${encodeURIComponent(invoice.originalPdfS3Key)}&filename=${encodeURIComponent(fileName)}`;
      window.open(fileUrl, '_blank');
      return;
    }
    
    // For created invoices, generate PDF and open in new tab
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
      window.open(url, '_blank');
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

  // Get invoice state
  const invoiceState = invoice ? getInvoiceState(invoice) : null;
  const isReview = invoiceState === 'REVIEW';

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
        totalAmount: String(totalAmount),
      });
    } else {
      await updateMutation.mutateAsync({
        id: invoiceId,
        invoiceNumber: invoiceNumber || invoice.invoiceNumber,
        clientId: clientId !== "none" ? parseInt(clientId, 10) : undefined,
        issueDate: new Date(issueDate),
        totalAmount: String(totalAmount),
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

  const isLoading = confirmMutation.isPending || updateMutation.isPending || cancelMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "sm:max-w-[500px] flex flex-col",
        isMobile && "max-h-[calc(100vh-var(--bottom-safe-area,0px)-2rem)] mb-[calc(var(--bottom-safe-area,0px)+1rem)]"
      )}>
        <DialogHeader className={cn("flex-shrink-0", isMobile && "px-0")}>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {isReview ? "Review Invoice" : "Edit Invoice"}
            </DialogTitle>
            {/* Header: Preview button (only lifecycle action in review) */}
            <Button 
              variant="outline" 
              size={isMobile ? "sm" : "icon"}
              onClick={handlePreviewPDF}
              disabled={isLoading}
              className={cn(isMobile && "gap-2")}
            >
              <Eye className="h-4 w-4" />
              {isMobile && "Preview"}
            </Button>
          </div>
        </DialogHeader>

        <div className={cn(
          "space-y-4 py-4",
          isMobile && "overflow-y-auto min-h-0 pb-[calc(var(--bottom-safe-area,0px)+1rem)]"
        )}>
          {/* Warning banners */}
          {invoice && !isReview && (
            <>
              {!invoice.sentAt && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This invoice has not been sent yet.
                  </AlertDescription>
                </Alert>
              )}
              {invoice.sentAt && !invoice.paidAt && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This invoice has been sent but not paid yet.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="client">Client</Label>
            <Select value={clientId} onValueChange={setClientId} disabled={!isReview}>
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
              disabled={!isReview}
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
              disabled={!isReview}
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
              disabled={!isReview}
            />
          </div>
        </div>

        {/* Footer: Save and Cancel only (per spec) */}
        <DialogFooter className={cn(
          isMobile ? "flex-col gap-2 flex-shrink-0" : ""
        )}>
          <div className={isMobile ? "flex flex-col gap-2 w-full" : "flex gap-2"}>
            <Button 
              onClick={handleSave} 
              disabled={isLoading || !isFormValid}
              className={isMobile ? "w-full" : ""}
            >
              {(confirmMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isReview ? "Save" : "Update"}
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleCancel} 
              disabled={isLoading}
              className={isMobile ? "w-full" : ""}
            >
              {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancel
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
