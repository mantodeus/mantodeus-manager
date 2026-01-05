/**
 * Invoice Upload Review Dialog
 * 
 * Dialog for reviewing and confirming uploaded PDF invoice data.
 * Per spec Section 19: Review state has Mark as Sent/Paid buttons, Save, and Delete (no Cancel).
 * Buttons ONLY appear in review state for uploaded invoices.
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
import { Loader2, FileText, Eye, Send, CheckCircle2, DocumentCurrencyEuro, X } from "@/components/ui/Icon";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";
import { getInvoiceState, getDerivedValues } from "@/lib/invoiceState";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "@/components/ui/Icon";
import { ShareInvoiceDialog } from "./invoices/ShareInvoiceDialog";
import { RevertInvoiceStatusDialog } from "@/components/RevertInvoiceStatusDialog";

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
  const [dueDate, setDueDate] = useState<string>("");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [revertTarget, setRevertTarget] = useState<"draft" | "sent" | null>(null);

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
  const revertToDraftMutation = trpc.invoices.revertToDraft.useMutation({
    onSuccess: () => {
      toast.success("Invoice reverted to draft");
      utils.invoices.get.invalidate({ id: invoiceId! });
      utils.invoices.list.invalidate();
      setRevertDialogOpen(false);
      setRevertTarget(null);
    },
    onError: (error) => {
      toast.error("Failed to revert invoice: " + error.message);
    },
  });
  const revertToSentMutation = trpc.invoices.revertToSent.useMutation({
    onSuccess: () => {
      toast.success("Invoice reverted to sent");
      utils.invoices.get.invalidate({ id: invoiceId! });
      utils.invoices.list.invalidate();
      setRevertDialogOpen(false);
      setRevertTarget(null);
    },
    onError: (error) => {
      toast.error("Failed to revert invoice: " + error.message);
    },
  });
  const markAsSentMutation = trpc.invoices.markAsSent.useMutation({
    onSuccess: () => {
      toast.success("Invoice marked as sent");
      utils.invoices.get.invalidate({ id: invoiceId! });
      utils.invoices.list.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to mark as sent: " + error.message);
    },
  });
  const markAsPaidMutation = trpc.invoices.markAsPaid.useMutation({
    onSuccess: () => {
      toast.success("Invoice marked as paid");
      utils.invoices.get.invalidate({ id: invoiceId! });
      utils.invoices.list.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to mark as paid: " + error.message);
    },
  });
  const moveToTrashMutation = trpc.invoices.moveToTrash.useMutation({
    onSuccess: () => {
      toast.success("Invoice moved to trash");
      onOpenChange(false);
      utils.invoices.list.invalidate();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error("Failed to delete invoice: " + error.message);
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
      setDueDate(
        invoice.dueDate
          ? new Date(invoice.dueDate).toISOString().split("T")[0]
          : ""
      );
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
  const isDraft = invoiceState === 'DRAFT';
  const isSent = invoiceState === 'SENT' || invoiceState === 'PARTIAL';
  const isPaid = invoiceState === 'PAID';
  const isReadOnly = isSent || isPaid; // Only disable when sent/paid, not when draft
  
  const handleSend = () => {
    if (!invoice) return;
    // Validate before sending
    if (!dueDate && !invoice.dueDate) {
      toast.error("Invoice must have a due date before it can be sent");
      return;
    }
    const total = Number(invoice.total || 0);
    if (total <= 0) {
      toast.error("Invoice total must be greater than 0");
      return;
    }
    setShareDialogOpen(true);
  };

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
        dueDate: dueDate ? new Date(dueDate) : invoice.dueDate,
        totalAmount: String(totalAmount),
      });
    }
  };


  const isLoading = 
    confirmMutation.isPending || 
    updateMutation.isPending || 
    cancelMutation.isPending || 
    revertToDraftMutation.isPending || 
    revertToSentMutation.isPending ||
    markAsSentMutation.isPending ||
    markAsPaidMutation.isPending ||
    moveToTrashMutation.isPending;
  
  // Get derived values for revert logic
  const derivedValues = invoice ? getDerivedValues(invoice) : { outstanding: 0, isPaid: false, isPartial: false, isOverdue: false };
  
  // Revert handlers
  const handleRevertToDraft = () => {
    if (!invoice || derivedValues.outstanding > 0) {
      toast.error("Cannot revert to draft: invoice has payments");
      return;
    }
    setRevertTarget("draft");
    setRevertDialogOpen(true);
  };
  
  const handleRevertToSent = () => {
    setRevertTarget("sent");
    setRevertDialogOpen(true);
  };
  
  const handleRevertConfirm = async () => {
    if (!invoiceId) return;
    if (revertTarget === "draft") {
      await revertToDraftMutation.mutateAsync({ id: invoiceId, confirmed: true });
    } else if (revertTarget === "sent") {
      await revertToSentMutation.mutateAsync({ id: invoiceId, confirmed: true });
    }
  };

  const handleMarkAsSent = async () => {
    if (!invoiceId) return;
    await markAsSentMutation.mutateAsync({ id: invoiceId });
  };

  const handleMarkAsPaid = async () => {
    if (!invoiceId) return;
    await markAsPaidMutation.mutateAsync({ id: invoiceId });
  };

  const handleDelete = async () => {
    if (!invoiceId || !invoice) return;
    
    if (isReview) {
      // In review state: Cancel upload (hard delete) - Section 19, line 556
      await cancelMutation.mutateAsync({ id: invoiceId });
    } else {
      // After review: Move to trash (soft delete) - Section 19, lines 558-562
      await moveToTrashMutation.mutateAsync({ id: invoiceId });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "sm:max-w-[500px] flex flex-col p-0",
          isMobile && "max-h-[calc(100vh-var(--bottom-safe-area,0px)-2rem)] mb-[calc(var(--bottom-safe-area,0px)+1rem)]"
        )}
        showCloseButton={false}
      >
        {/* PageHeader-like structure */}
        <div className="flex-shrink-0 p-6 pb-2 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <div className="flex-1 min-w-0 flex flex-col">
                <h1 className="text-3xl font-regular flex items-center gap-2">
                  {isReview ? (
                    <FileText className="h-6 w-6 text-primary" />
                  ) : (
                    <DocumentCurrencyEuro className="h-6 w-6 text-primary" />
                  )}
                  {isReview ? "Review Invoice" : "Edit Invoice"}
                </h1>
                <p className="text-muted-foreground text-sm mt-3">
                  {isReview 
                    ? "Review and confirm uploaded invoice metadata" 
                    : "Edit invoice metadata and details"}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-3 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-10 w-10"
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
          </div>
          
          {/* Action buttons below header */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handlePreviewPDF}
              disabled={isLoading}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              Preview
            </Button>
            {/* Send button - only shown when draft and not in review */}
            {!isReview && isDraft && (
              <Button
                size="sm"
                onClick={handleSend}
                disabled={isLoading || (!dueDate && !invoice?.dueDate) || Number(totalAmount || 0) <= 0}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                Send
              </Button>
            )}
            {/* Sent/Paid button - shown when sent/paid */}
            {invoiceState === 'SENT' && (
              <Button
                variant="outline"
                size="sm"
                disabled
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Sent
              </Button>
            )}
            {invoiceState === 'PAID' && (
              <Button
                variant="outline"
                size="sm"
                disabled
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Paid
              </Button>
            )}
          </div>
        </div>

        {/* Fade-out separator */}
        <div className="separator-fade" />

        <div className={cn(
          "space-y-4 px-6 pt-4 overflow-y-auto flex-1",
          isMobile ? "pb-[calc(var(--bottom-safe-area,0px)+1rem)]" : "pb-6"
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

          {/* Read-only overlay message for sent/paid invoices */}
          {isReadOnly && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This invoice is locked because it has been {isPaid ? 'paid' : 'sent'}.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="client">Client</Label>
            <Select value={clientId} onValueChange={setClientId} disabled={isReadOnly}>
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
              disabled={isReadOnly}
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
              disabled={isReadOnly}
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
              disabled={isReadOnly}
            />
          </div>

          {/* Due Date - shown for non-review state, required for sending */}
          {!isReview && (
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date *</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required={!isReview}
                disabled={isReadOnly}
              />
              <p className="text-xs text-muted-foreground">
                Due date is required before sending the invoice
              </p>
            </div>
          )}

          {/* Action buttons: Section 19 layout - REVIEW state for uploaded invoices */}
          {isReview && invoice?.source === "uploaded" && (
            <div className={cn(
              "pt-4 border-t",
              isMobile ? "flex flex-col gap-2 w-full" : "flex flex-col gap-2"
            )}>
              {/* Mark as Sent (only if not already sent) - Section 19, line 482 */}
              {!invoice.sentAt && (
                <Button 
                  onClick={handleMarkAsSent} 
                  disabled={isLoading || markAsSentMutation.isPending}
                  className={isMobile ? "w-full" : ""}
                >
                  {markAsSentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Mark as Sent
                </Button>
              )}

              {/* Mark as Paid (only if not already paid) - Section 19, line 489 */}
              {!invoice.paidAt && (
                <Button 
                  onClick={handleMarkAsPaid} 
                  disabled={isLoading || markAsPaidMutation.isPending}
                  className={isMobile ? "w-full" : ""}
                >
                  {markAsPaidMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Mark as Paid
                </Button>
              )}

              {/* Save - Section 19, line 496 */}
              <Button 
                onClick={handleSave} 
                disabled={isLoading || !isFormValid}
                className={isMobile ? "w-full" : ""}
              >
                {(confirmMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>

              {/* Delete (NO Cancel button) - Section 19, line 501 */}
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isLoading || cancelMutation.isPending}
                className={isMobile ? "w-full" : ""}
              >
                {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </Button>
            </div>
          )}

          {/* After review state (needsReview: false) - standard layout */}
          {!isReview && (
            <div className={cn(
              "pt-4 border-t",
              isMobile ? "flex flex-col gap-2 w-full" : "flex gap-2"
            )}>
              {!isReadOnly && (
                <Button 
                  onClick={handleSave} 
                  disabled={isLoading || !isFormValid}
                  className={isMobile ? "w-full" : ""}
                >
                  {(confirmMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update
                </Button>
              )}
              {/* Revert buttons - only shown when sent/paid */}
              {isSent && !isPaid && derivedValues.outstanding === 0 && (
                <Button
                  variant="outline"
                  onClick={handleRevertToDraft}
                  disabled={isLoading}
                  className={isMobile ? "w-full" : ""}
                >
                  Revert to Draft
                </Button>
              )}
              {isPaid && (
                <Button
                  variant="outline"
                  onClick={handleRevertToSent}
                  disabled={isLoading}
                  className={isMobile ? "w-full" : ""}
                >
                  Revert to Sent
                </Button>
              )}
              {/* Delete (replaces Cancel) */}
              <Button 
                variant="destructive" 
                onClick={handleDelete} 
                disabled={isLoading || moveToTrashMutation.isPending}
                className={isMobile ? "w-full" : ""}
              >
                {moveToTrashMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </Button>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Share Invoice Dialog */}
      {invoiceId && (
        <ShareInvoiceDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          invoiceId={invoiceId}
          onSuccess={() => {
            utils.invoices.get.invalidate({ id: invoiceId });
            onSuccess?.();
          }}
        />
      )}
      
      {/* Revert Status Dialog */}
      {invoice && (
        <RevertInvoiceStatusDialog
          open={revertDialogOpen}
          onOpenChange={setRevertDialogOpen}
          currentStatus={isPaid ? "paid" : "open"}
          targetStatus={revertTarget === "draft" ? "draft" : "open"}
          invoiceNumber={invoice.invoiceNumber}
          invoiceAmount={invoice.total}
          onConfirm={handleRevertConfirm}
          isReverting={revertToDraftMutation.isPending || revertToSentMutation.isPending}
        />
      )}
    </Dialog>
  );
}
