/**
 * Invoice Upload Review Dialog
 * 
 * Dialog for reviewing and confirming uploaded PDF invoice data.
 * Per spec Section 19: Review state has Mark as Sent/Paid buttons, Save, and Delete (no Cancel).
 * Buttons ONLY appear in review state for uploaded invoices.
 */

import { useState, useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { Loader2, FileText, Eye, Send, CheckCircle2, DocumentCurrencyEuro, CurrencyEuro, ArrowLeft, RotateCcw, Info as HelpCircle, Sparkles, MoreVertical, Edit, Copy, Trash2, Archive, XCircle, X } from "@/components/ui/Icon";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/useMobile";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { getInvoiceState, getDerivedValues } from "@/lib/invoiceState";
import { getInvoiceActions, type InvoiceAction } from "@/lib/invoiceActions";
import { ShareInvoiceDialog } from "./invoices/ShareInvoiceDialog";
import { RevertInvoiceStatusDialog } from "@/components/RevertInvoiceStatusDialog";
import { MarkAsSentAndPaidDialog } from "./invoices/MarkAsSentAndPaidDialog";
import { MarkAsPaidDialog } from "./invoices/MarkAsPaidDialog";
import { MarkAsNotPaidDialog } from "./invoices/MarkAsNotPaidDialog";
import { useLongPress } from "@/hooks/useLongPress";
import { DocumentPreview } from "@/components/document-preview/DocumentPreview";

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
  
  const { theme } = useTheme();
  const isDarkMode = theme === 'green-mantis';
  const [clientId, setClientId] = useState<string>("none");
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [issueDate, setIssueDate] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>("");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [revertTarget, setRevertTarget] = useState<"draft" | "sent" | null>(null);
  const [markAsSentAndPaidDialogOpen, setMarkAsSentAndPaidDialogOpen] = useState(false);
  const [markAsPaidDialogOpen, setMarkAsPaidDialogOpen] = useState(false);
  const [markAsNotPaidDialogOpen, setMarkAsNotPaidDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showInlinePreview, setShowInlinePreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState("invoice.pdf");
  const [previewZoom, setPreviewZoom] = useState(1);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const inlinePreviewRef = useRef<HTMLDivElement>(null);
  const autoFitDoneRef = useRef(false);

  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: invoice } = trpc.invoices.get.useQuery(
    { id: invoiceId! },
    { enabled: !!invoiceId }
  );
  const previewMimeType = getPreviewMimeType(previewFileName, invoice?.originalFileName);

  const handlePreviewPDF = async () => {
    if (!invoiceId || !invoice) return;
    
    // Generate preview URL for either mobile or desktop.
    try {
      let url: string;
      let fileName: string;
      
      // For uploaded invoices, use file-proxy
      if (invoice.source === "uploaded" && invoice.originalPdfS3Key) {
        fileName = invoice.invoiceName || invoice.originalFileName || invoice.invoiceNumber || "invoice.pdf";
        url = `/api/file-proxy?key=${encodeURIComponent(invoice.originalPdfS3Key)}&filename=${encodeURIComponent(fileName)}`;
      } else {
        // For created invoices, generate PDF
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
        url = URL.createObjectURL(blob);
        fileName = invoice.invoiceName || invoice.invoiceNumber || "invoice.pdf";
      }
      
      setPreviewUrl(url);
      setPreviewFileName(fileName);
      if (isMobile) {
        setShowInlinePreview(true);
        requestAnimationFrame(() => {
          inlinePreviewRef.current?.scrollIntoView({ behavior: 'smooth' });
        });
      } else {
        setPreviewOpen(true);
      }
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('Failed to open preview');
    }
  };

  function getPreviewMimeType(...fileNames: Array<string | null | undefined>) {
    const extension = fileNames
      .map((name) => name?.split(".").pop()?.toLowerCase())
      .find((value) => value && value.length > 0);
    if (!extension) return "application/pdf";
    if (extension === "pdf") return "application/pdf";
    if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
    if (extension === "png") return "image/png";
    if (extension === "gif") return "image/gif";
    if (extension === "webp") return "image/webp";
    if (extension === "bmp") return "image/bmp";
    if (extension === "heic") return "image/heic";
    if (extension === "heif") return "image/heif";
    return "application/pdf";
  }

  const handlePreviewClose = () => {
    setPreviewOpen(false);
  };

  const handleClose = () => {
    if (isMobile && previewOpen) {
      handlePreviewClose();
      return;
    }
    onOpenChange(false);
  };

  const utils = trpc.useUtils();
  const confirmMutation = trpc.invoices.confirmUploadedInvoice.useMutation({
    onSuccess: () => {
      toast.success("Invoice saved");
      onOpenChange(false);
      utils.invoices.list.invalidate();
      utils.invoices.listNeedsReview.invalidate();
      if (invoiceId) {
        utils.invoices.get.invalidate({ id: invoiceId });
      }
      onSuccess?.();
    },
    onError: (error) => {
      toast.error("Failed to save invoice: " + error.message);
    },
  });
  const updateMutation = trpc.invoices.update.useMutation({
    onSuccess: () => {
      toast.success("Invoice saved");
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
      toast.success("Invoice marked as not paid");
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
  const markAsCancelledMutation = trpc.invoices.markAsCancelled.useMutation({
    onSuccess: () => {
      toast.success("Invoice marked as cancelled");
      utils.invoices.get.invalidate({ id: invoiceId! });
      utils.invoices.list.invalidate();
      utils.invoices.listNeedsReview.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const markAsNotCancelledMutation = trpc.invoices.markAsNotCancelled.useMutation({
    onSuccess: () => {
      toast.success("Invoice marked as not cancelled");
      utils.invoices.get.invalidate({ id: invoiceId! });
      utils.invoices.list.invalidate();
      utils.invoices.listNeedsReview.invalidate();
    },
    onError: (err) => toast.error(err.message),
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
  const duplicateInvoiceMutation = trpc.invoices.duplicate.useMutation({
    onSuccess: () => {
      toast.success("Invoice duplicated");
      utils.invoices.list.invalidate();
      utils.invoices.listNeedsReview.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to duplicate invoice: " + error.message);
    },
  });
  const archiveMutation = trpc.invoices.archive.useMutation({
    onSuccess: () => {
      toast.success("Invoice archived");
      utils.invoices.get.invalidate({ id: invoiceId! });
      utils.invoices.list.invalidate();
      utils.invoices.listArchived.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to archive invoice: " + error.message);
    },
  });

  // Track if we've hydrated from parsedData for this invoiceId to prevent overwriting saved values
  const hydratedFromParsedDataRef = useRef<Set<number>>(new Set());
  
  // Track which fields were autofilled from parsedData
  const [autofilledFields, setAutofilledFields] = useState<Set<string>>(new Set());
  // Track which fields were manually edited (removes autofill indicator)
  const [fieldEdited, setFieldEdited] = useState<Set<string>>(new Set());
  
  // Check if field is autofilled and not manually edited
  const isAutofilled = (fieldName: string): boolean => {
    return autofilledFields.has(fieldName) && !fieldEdited.has(fieldName);
  };
  
  // Track when a field is manually edited
  const handleFieldEdit = (fieldName: string) => {
    setFieldEdited((prev) => new Set(prev).add(fieldName));
  };

  // Initialize form when parsed data or invoice changes
  // CRITICAL: Prefer invoice (saved DB values) over parsedData to prevent overwriting edits
  useEffect(() => {
    if (!invoiceId) return;

    // If invoice exists (has been saved), use invoice values
    if (invoice) {
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
      setPaymentDate(
        invoice.paidAt
          ? new Date(invoice.paidAt).toISOString().split("T")[0]
          : ""
      );
      
      // If invoice is in review state (needsReview=true) and parsedData is null,
      // reconstruct parsedData from invoice to show autofill indicators
      // This happens when viewing an uploaded invoice from the detail page
      if (invoice.needsReview && invoice.source === "uploaded" && !parsedData && !hydratedFromParsedDataRef.current.has(invoiceId)) {
        const newAutofilledFields = new Set<string>();
        
        // Mark fields as autofilled if they have values (they were extracted from OCR)
        if (invoice.invoiceNumber) {
          newAutofilledFields.add("invoiceNumber");
        }
        
        if (invoice.issueDate) {
          newAutofilledFields.add("issueDate");
        }
        
        if (invoice.total && Number(invoice.total) > 0) {
          newAutofilledFields.add("totalAmount");
        }
        
        // Only mark clientId as autofilled if it exists (it was matched during OCR)
        // Note: We don't have the original clientName from OCR, but if clientId exists
        // and invoice is in review, it was likely matched during extraction
        if (invoice.clientId) {
          newAutofilledFields.add("clientId");
        }
        
        // Due date is typically not extracted, but if it exists and invoice is in review,
        // it might have been extracted or calculated
        if (invoice.dueDate) {
          newAutofilledFields.add("dueDate");
        }
        
        setAutofilledFields(newAutofilledFields);
        setFieldEdited(new Set());
        hydratedFromParsedDataRef.current.add(invoiceId);
      } else {
        // Invoice has been confirmed (needsReview=false) or is not from upload
        // These are saved values, not autofilled
        setAutofilledFields(new Set());
        setFieldEdited(new Set());
      }
    } 
    // Only use parsedData ONCE per invoiceId (first time, before any save)
    else if (parsedData && !hydratedFromParsedDataRef.current.has(invoiceId)) {
      const newAutofilledFields = new Set<string>();
      
      if (parsedData.invoiceNumber) {
        setInvoiceNumber(parsedData.invoiceNumber);
        newAutofilledFields.add("invoiceNumber");
      }
      
      if (parsedData.invoiceDate) {
        setIssueDate(new Date(parsedData.invoiceDate).toISOString().split("T")[0]);
        newAutofilledFields.add("issueDate");
      }
      
      if (parsedData.totalAmount) {
        setTotalAmount(parsedData.totalAmount);
        newAutofilledFields.add("totalAmount");
      }
      
      setClientId("none");
      setDueDate(""); // parsedData doesn't have dueDate, start empty
      
      setAutofilledFields(newAutofilledFields);
      setFieldEdited(new Set()); // Reset edited fields when initializing
      hydratedFromParsedDataRef.current.add(invoiceId);
    }
  }, [invoice, parsedData, invoiceId]);

  // Try to match client by name if parsed
  useEffect(() => {
    if (parsedData?.clientName && clientId === "none" && contacts.length > 0) {
      const matched = contacts.find(
        (c) => c.name.toLowerCase() === parsedData.clientName?.toLowerCase()
      );
      if (matched) {
        setClientId(matched.id.toString());
        // Mark clientId as autofilled if it was matched from parsedData
        setAutofilledFields((prev) => new Set(prev).add("clientId"));
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
  // For uploaded invoices, draft state is when needsReview is false and sentAt is null
  const isDraft = invoiceState === 'DRAFT' || (invoice?.source === "uploaded" && !invoice.needsReview && !invoice.sentAt);
  const isSent = invoiceState === 'SENT' || invoiceState === 'PARTIAL';
  const isPaid = invoiceState === 'PAID';
  const isCancelled = invoice?.cancelledAt !== null && invoice?.cancelledAt !== undefined;
  const isReadOnly = isSent || isPaid || isCancelled; // Disable when sent/paid or cancelled
  const headerSubtitle = invoice?.invoiceNumber || invoice?.invoiceName || "";

  const handleSend = () => {
    if (!invoice) return;
    // Check if invoice is cancelled - must be marked as not cancelled before sending
    if (isCancelled) {
      toast.error("Cancelled invoices cannot be sent. Please mark the invoice as not cancelled first.");
      return;
    }
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
        dueDate: dueDate ? new Date(dueDate) : null,
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
    if (!invoiceId || !invoice) return;
    
    // If invoice hasn't been sent yet, show confirmation dialog with date picker
    if (!invoice.sentAt && invoice.source === "uploaded") {
      setMarkAsSentAndPaidDialogOpen(true);
      return;
    }
    
    // Otherwise, show date picker dialog
    setMarkAsPaidDialogOpen(true);
  };

  const handleConfirmMarkAsPaid = async (paidAt: Date) => {
    if (!invoiceId) return;
    await markAsPaidMutation.mutateAsync({ id: invoiceId, paidAt });
  };

  const handleConfirmMarkAsSentAndPaid = async (paidAt: Date) => {
    if (!invoiceId) return;
    await markAsPaidMutation.mutateAsync({ id: invoiceId, paidAt, alsoMarkAsSent: true });
  };

  const handleMarkAsNotPaid = () => {
    if (!invoice) return;
    setMarkAsNotPaidDialogOpen(true);
  };

  const handleConfirmMarkAsNotPaid = async (target: "sent" | "draft") => {
    if (!invoiceId) return;
    setMarkAsNotPaidDialogOpen(false);
    
    if (target === "sent") {
      await revertToSentMutation.mutateAsync({ id: invoiceId, confirmed: true });
    } else if (target === "draft") {
      await revertToDraftMutation.mutateAsync({ id: invoiceId, confirmed: true });
    }
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

  function renderStatusButton(invoice: any) {
    if (!invoice) return null;
    
    const invoiceState = getInvoiceState(invoice);
    const derivedValues = getDerivedValues(invoice);
    
    // Cancelled button (dark color) - highest priority
    if (invoice.cancelledAt) {
      return (
        <Button
          asChild={false}
          variant="outline"
          size="default"
          className="text-sm font-semibold border-foreground text-foreground dark:border-white dark:text-white cursor-pointer"
        >
          CANCELLED
        </Button>
      );
    }
    
    // Button priority: OVERDUE > PARTIAL > SENT/PAID
    if (derivedValues.isOverdue) {
      return (
        <Button asChild={false} variant="destructive-outline" size="default" className="text-sm font-semibold cursor-pointer">
          OVERDUE
        </Button>
      );
    }
    
    if (invoiceState === 'PARTIAL') {
      return (
        <Button
          asChild={false}
          variant="outline"
          size="default"
          className="text-sm font-semibold border-orange-500 text-orange-600 dark:text-orange-400 dark:border-orange-600 hover:bg-orange-500/10 dark:hover:bg-orange-600/20 cursor-pointer"
        >
          PARTIAL
        </Button>
      );
    }
    
    if (invoiceState === 'PAID') {
      return (
        <Button
          asChild={false}
          variant="default"
          size="default"
          className="text-sm font-semibold cursor-pointer"
          style={{
            backgroundColor: isDarkMode ? '#00FF88' : 'rgb(236, 72, 153)', // green in dark, pink in light
            color: isDarkMode ? '#000000' : 'white',
            borderColor: isDarkMode ? 'rgba(0, 255, 136, 0.5)' : 'rgba(236, 72, 153, 0.5)',
          }}
        >
          PAID
        </Button>
      );
    }
    
    if (invoiceState === 'SENT') {
      return (
        <Button
          asChild={false}
          variant="outline"
          size="default"
          className="text-sm font-semibold text-[var(--state-info)] hover:bg-[var(--state-info)]/10 hover:border-[var(--state-info)]/70 cursor-pointer !border-[var(--state-info)]/50"
        >
          SENT
        </Button>
      );
    }
    
    if (invoiceState === 'DRAFT') {
      return (
        <Button asChild={false} variant="outline" size="default" className="text-sm font-semibold border-yellow-500 text-yellow-600 dark:text-yellow-400 dark:border-yellow-600 cursor-pointer">
          DRAFT
        </Button>
      );
    }
    
    return null;
  }

  // Get available invoice actions for the three-dot menu
  const availableInvoiceActions = invoice ? getInvoiceActions({ invoice, selectionMode: false }) : [];
  
  // Action config mapping (matching CenteredContextMenu)
  const actionConfig: Record<InvoiceAction, { icon: React.ComponentType<{ className?: string }>; label: string; variant: "default" | "destructive" }> = {
    view: { icon: Eye, label: "View", variant: "default" },
    edit: { icon: Edit, label: "Edit", variant: "default" },
    delete: { icon: Trash2, label: "Delete", variant: "destructive" },
    duplicate: { icon: Copy, label: "Duplicate", variant: "default" },
    select: { icon: CheckCircle2, label: "Select", variant: "default" },
    archive: { icon: Archive, label: "Archive", variant: "default" },
    restore: { icon: RotateCcw, label: "Restore", variant: "default" },
    deletePermanently: { icon: Trash2, label: "Delete permanently", variant: "destructive" },
    revertToDraft: { icon: RotateCcw, label: "Revert to draft", variant: "destructive" },
    revertToSent: { icon: RotateCcw, label: "Mark as not paid", variant: "destructive" },
    markAsSent: { icon: Send, label: "Mark as sent", variant: "default" },
    markAsPaid: { icon: CurrencyEuro, label: "Mark as paid", variant: "default" },
    markAsCancelled: { icon: XCircle, label: "Mark as cancelled", variant: "destructive" },
    markAsNotCancelled: { icon: RotateCcw, label: "Mark as not cancelled", variant: "default" },
    markAsInOrder: { icon: CheckCircle2, label: "Mark as In Order", variant: "default" },
    void: { icon: XCircle, label: "Void", variant: "destructive" },
  };
  
  // Handle invoice actions from three-dot menu
  const handleInvoiceAction = (action: InvoiceAction) => {
    if (!invoice) return;
    
    switch (action) {
      case "edit":
        // Already in edit dialog, do nothing
        break;
      case "duplicate":
        duplicateInvoiceMutation.mutate({ id: invoice.id });
        break;
      case "select":
        // Not applicable in dialog context
        break;
      case "archive":
        archiveMutation.mutate({ id: invoice.id });
        break;
      case "delete":
        handleDelete();
        break;
      case "markAsSent":
        handleMarkAsSent();
        break;
      case "markAsPaid":
        handleMarkAsPaid();
        break;
      case "revertToDraft":
        setRevertTarget({ id: invoice.id, targetStatus: "draft", currentStatus: "open" });
        setRevertDialogOpen(true);
        break;
      case "revertToSent":
        setRevertTarget({ id: invoice.id, targetStatus: "open", currentStatus: "paid" });
        setRevertDialogOpen(true);
        break;
      case "markAsCancelled":
        markAsCancelledMutation.mutate({ id: invoice.id });
        break;
      case "markAsNotCancelled":
        markAsNotCancelledMutation.mutate({ id: invoice.id });
        break;
      default:
        console.warn("Unknown action:", action);
    }
  };
  
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);

  // Auto-open preview on desktop when dialog opens
  useEffect(() => {
    if (!isMobile && open && invoiceId && invoice && !previewUrl) {
      // Auto-load preview on desktop
      const loadPreview = async () => {
        try {
          let url: string;
          let fileName: string;
          
          // For uploaded invoices, use file-proxy
          if (invoice.source === "uploaded" && invoice.originalPdfS3Key) {
            fileName = invoice.invoiceName || invoice.originalFileName || invoice.invoiceNumber || "invoice.pdf";
            url = `/api/file-proxy?key=${encodeURIComponent(invoice.originalPdfS3Key)}&filename=${encodeURIComponent(fileName)}`;
          } else {
            // For created invoices, generate PDF
            const { data: { session } } = await import("@/lib/supabase").then(m => m.supabase.auth.getSession());
            if (!session?.access_token) {
              return; // Silently fail - preview just won't show
            }
            const response = await fetch(`/api/invoices/${invoiceId}/pdf?preview=true`, {
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
              },
              credentials: 'include',
            });
            if (!response.ok) {
              return; // Silently fail
            }
            const blob = await response.blob();
            url = URL.createObjectURL(blob);
            fileName = invoice.invoiceName || invoice.invoiceNumber || "invoice.pdf";
          }
          
          setPreviewUrl(url);
          setPreviewFileName(fileName);
          setPreviewOpen(true);
        } catch (error) {
          console.error('Preview error:', error);
          // Silently fail - preview just won't show
        }
      };
      
      loadPreview();
    }
  }, [open, invoiceId, invoice, isMobile, previewUrl]);

  // Clean up preview URL on unmount or when dialog closes
  useEffect(() => {
    if (!open) {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      setPreviewOpen(false);
    }
  }, [open, previewUrl]);

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Reset zoom when preview closes or changes
  useEffect(() => {
    if (!previewOpen || !previewUrl) {
      setPreviewZoom(1);
    }
  }, [previewOpen, previewUrl]);

  // Calculate initial zoom to fit PDF in viewport on desktop preview panel
  useEffect(() => {
    if (isMobile || !previewOpen || !previewUrl) {
      autoFitDoneRef.current = false;
      return;
    }

    autoFitDoneRef.current = false;
    const container = previewContainerRef.current;
    if (!container) return;

    const calculateFitZoom = () => {
      if (autoFitDoneRef.current) return;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      if (!containerWidth || !containerHeight) return;

      // Standard A4 PDF dimensions at 96 DPI
      const pdfWidth = 794;
      const pdfHeight = 1123;

      const widthZoom = (containerWidth - 20) / pdfWidth; // 20px padding
      const heightZoom = (containerHeight - 20) / pdfHeight; // 20px padding
      const fitZoom = Math.min(widthZoom, heightZoom, 1);
      const calculatedZoom = Math.max(0.3, fitZoom);

      setPreviewZoom(calculatedZoom);
      autoFitDoneRef.current = true;
    };

    const rafId = requestAnimationFrame(calculateFitZoom);
    const resizeObserver = new ResizeObserver(() => calculateFitZoom());
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [isMobile, previewOpen, previewUrl]);

  // Add mouse wheel, trackpad, and touch zoom support for preview iframe
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container || !previewOpen || isMobile) return;

    // Track initial touch distance for pinch zoom
    let initialDistance = 0;
    let initialZoom = 1;

    const handleWheel = (e: WheelEvent) => {
      // Trackpad pinch zoom: Ctrl/Cmd + wheel (macOS/Windows trackpad gesture)
      // macOS trackpad pinch sends wheel events with ctrlKey=true
      // Windows trackpad pinch may also send ctrlKey=true
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        
        // Use deltaY for zoom direction (negative = zoom in, positive = zoom out)
        // Trackpad pinch typically has larger deltaY values, so scale accordingly
        // Use a more sensitive multiplier for smoother zoom
        const zoomSensitivity = 0.005; // Fine-tuned for trackpad
        const delta = e.deltaY > 0 ? -zoomSensitivity * Math.abs(e.deltaY) : zoomSensitivity * Math.abs(e.deltaY);
        setPreviewZoom((prev) => {
          const newZoom = prev + delta;
          return Math.max(0.5, Math.min(3, newZoom));
        });
        return;
      }
    };

    // Touch pinch-to-zoom handler
    let isPinching = false;
    const handleTouchStart = (e: TouchEvent) => {
      // Only handle pinch zoom (2 touches), allow single touch for scrolling
      if (e.touches.length === 2) {
        isPinching = true;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        initialDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        initialZoom = previewZoom;
      } else {
        isPinching = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Only prevent default for pinch zoom (2 touches)
      if (e.touches.length === 2 && isPinching && initialDistance > 0) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        
        const scale = currentDistance / initialDistance;
        const newZoom = initialZoom * scale;
        // Allow zoom from 0.3x to 3x
        setPreviewZoom(Math.max(0.3, Math.min(3, newZoom)));
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // Only reset if we're no longer pinching
      if (e.touches.length < 2) {
        initialDistance = 0;
        isPinching = false;
      }
    };

    // Listen on both container and iframe wrapper to catch all events
    const iframeWrapper = container.querySelector('[data-iframe-wrapper]') as HTMLElement;
    
    // Use capture phase to catch events before they reach the iframe
    const options = { passive: false, capture: true };
    
    container.addEventListener('wheel', handleWheel, options);
    container.addEventListener('touchstart', handleTouchStart, options);
    container.addEventListener('touchmove', handleTouchMove, options);
    container.addEventListener('touchend', handleTouchEnd, options);
    container.addEventListener('touchcancel', handleTouchEnd, options);
    
    if (iframeWrapper) {
      iframeWrapper.addEventListener('wheel', handleWheel, options);
      iframeWrapper.addEventListener('touchstart', handleTouchStart, options);
      iframeWrapper.addEventListener('touchmove', handleTouchMove, options);
      iframeWrapper.addEventListener('touchend', handleTouchEnd, options);
      iframeWrapper.addEventListener('touchcancel', handleTouchEnd, options);
    }
    
    // Also listen on document to catch events that might escape
    document.addEventListener('touchmove', handleTouchMove, options);
    
    // Also listen on the iframe itself (though it may not receive events)
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    if (iframe) {
      iframe.addEventListener('wheel', handleWheel, options);
    }
    
    return () => {
      container.removeEventListener('wheel', handleWheel, options);
      container.removeEventListener('touchstart', handleTouchStart, options);
      container.removeEventListener('touchmove', handleTouchMove, options);
      container.removeEventListener('touchend', handleTouchEnd, options);
      container.removeEventListener('touchcancel', handleTouchEnd, options);
      if (iframeWrapper) {
        iframeWrapper.removeEventListener('wheel', handleWheel, options);
        iframeWrapper.removeEventListener('touchstart', handleTouchStart, options);
        iframeWrapper.removeEventListener('touchmove', handleTouchMove, options);
        iframeWrapper.removeEventListener('touchend', handleTouchEnd, options);
        iframeWrapper.removeEventListener('touchcancel', handleTouchEnd, options);
      }
      if (iframe) {
        iframe.removeEventListener('wheel', handleWheel, options);
      }
      document.removeEventListener('touchmove', handleTouchMove, options);
    };
  }, [previewOpen, previewUrl, previewZoom]);

  if (!open) return null;

  return (
    <>
      <div className={cn("grid gap-6 min-h-[calc(100vh-12rem)]", !isMobile && "lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]")}>
        {!isMobile && (
          <div className="w-full bg-background lg:sticky lg:top-6 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b bg-background">
              <h2 className="text-lg font-semibold">Preview</h2>
            </div>
            <div 
              ref={previewContainerRef}
              data-preview-container
              className="h-[calc(100vh-16rem)] overflow-auto bg-background relative"
              style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
            >
              {previewUrl ? (
                <div
                  data-iframe-wrapper
                  style={{
                    transform: `scale(${previewZoom})`,
                    transformOrigin: 'top left',
                    width: `${100 / previewZoom}%`,
                    height: `${100 / previewZoom}%`,
                    transition: 'transform 0.1s ease-out',
                  }}
                >
                  <iframe
                    src={previewUrl}
                    className="w-full h-full border-0"
                    title={previewFileName}
                    style={{ pointerEvents: 'auto' }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>Preview will appear here when you open it</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="w-full bg-background flex flex-col">
          {/* PageHeader-like structure matching Invoices page */}
          <div className="flex-shrink-0" style={{ marginBottom: 'var(--space-page-gap, 24px)' }}>
          {/* TitleRow */}
          <div className="flex items-center gap-3" style={{ paddingTop: isMobile ? '0' : '1rem' }}>
            {/* Arrow button on left */}
            <Button
              variant="icon"
              size="icon"
              onClick={handleClose}
              className="size-9 [&_svg]:size-8 hover:bg-muted/50 shrink-0"
              aria-label="Close"
            >
              <ArrowLeft />
            </Button>
            
            {/* Title with icon */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {isReview ? (
                <FileText className="h-6 w-6 text-primary shrink-0" />
              ) : (
                <DocumentCurrencyEuro className="h-6 w-6 text-primary shrink-0" />
              )}
              <h1 className="text-2xl md:text-3xl font-light">
                {isReview ? "Review Invoice" : "Edit Invoice"}
              </h1>
            </div>
            
            {/* Status badge and three-dot menu on right */}
            {invoice && (
              <div className="flex items-center gap-2 shrink-0">
                {/* Status badge - display only, no dropdown */}
                <div className="flex items-center gap-2">
                  {renderStatusButton(invoice)}
                </div>
                
                {/* Three-dot menu for invoice actions */}
                {availableInvoiceActions.length > 0 && (
                  <DropdownMenu open={actionsMenuOpen} onOpenChange={setActionsMenuOpen}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="icon"
                        size="icon"
                        className="size-9 [&_svg]:size-5 border border-transparent bg-transparent text-foreground hover:bg-foreground/5 hover:border-border/70 active:bg-foreground/8 dark:hover:bg-foreground/7 dark:active:bg-foreground/10 transition-[background-color,border-color] duration-[var(--dur-quick)] ease-[var(--ease-out)]"
                        aria-label="More actions"
                      >
                        <MoreVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuLabel>Invoice Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {availableInvoiceActions.map((action) => {
                        const config = actionConfig[action];
                        if (!config) return null;
                        const Icon = config.icon;
                        const isDestructive = config.variant === "destructive";
                        
                        // Skip "edit" and "select" actions in dialog context
                        if (action === "edit" || action === "select") return null;
                        
                        return (
                          <DropdownMenuItem
                            key={action}
                            onClick={() => handleInvoiceAction(action)}
                            className={cn(
                              "flex items-center gap-2",
                              isDestructive && "text-destructive focus:text-destructive"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{config.label}</span>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )}
          </div>
          
          {/* Invoice Number Row - aligned below icon */}
          {invoice?.invoiceNumber && (
            <div className="flex items-start gap-3 pb-1">
              {/* Spacer to align with icon (arrow button width + gap) */}
              <div className="size-9 shrink-0" />
              {/* Invoice number - aligned with icon (gap-3 automatically adds space) */}
              <p className="text-2xl md:text-3xl font-light text-muted-foreground">
                {invoice.invoiceNumber}
              </p>
            </div>
          )}
        </div>

        {/* Fade-out separator */}
        <div className="separator-fade" />

        <div className={cn(
          "space-y-4 pt-2 sm:px-6",
          isMobile ? "pb-4" : "pb-6"
        )}>


          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="client">Client</Label>
              {isAutofilled("clientId") && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Sparkles className="h-4 w-4 text-primary" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Autofilled from uploaded invoice</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <Select 
              value={clientId} 
              onValueChange={(value) => {
                handleFieldEdit("clientId");
                setClientId(value);
              }} 
              disabled={isReadOnly || isCancelled}
            >
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

          {/* Row 1: Invoice Number and Total Amount side by side on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="invoiceNumber">Invoice Number</Label>
                {isAutofilled("invoiceNumber") && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Sparkles className="h-4 w-4 text-primary" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Autofilled from uploaded invoice</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <Input
                id="invoiceNumber"
                value={invoiceNumber}
                onChange={(e) => {
                  handleFieldEdit("invoiceNumber");
                  setInvoiceNumber(e.target.value);
                }}
                placeholder="Auto-generated if empty"
                disabled={isReadOnly || isCancelled}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="totalAmount">Total Amount (€) *</Label>
                {isAutofilled("totalAmount") && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Sparkles className="h-4 w-4 text-primary" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Autofilled from uploaded invoice</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <Input
                id="totalAmount"
                type="number"
                step="0.01"
                min="0"
                value={totalAmount}
                onChange={(e) => {
                  handleFieldEdit("totalAmount");
                  setTotalAmount(e.target.value);
                }}
                placeholder="0.00"
                required
                disabled={isReadOnly || isCancelled}
              />
            </div>
          </div>

          {/* Row 2: Invoice Date and Due Date side by side on all screen sizes */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="issueDate">Invoice Date *</Label>
                {isAutofilled("issueDate") && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Sparkles className="h-4 w-4 text-primary" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Autofilled from uploaded invoice</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <Input
                id="issueDate"
                type="date"
                value={issueDate}
                onChange={(e) => {
                  handleFieldEdit("issueDate");
                  setIssueDate(e.target.value);
                }}
                required
                disabled={isReadOnly || isCancelled}
              />
            </div>

            {/* Due Date - shown for both review and draft states, required for sending */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="dueDate">Due Date *</Label>
                {isAutofilled("dueDate") && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Sparkles className="h-4 w-4 text-primary" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Autofilled from uploaded invoice</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => {
                  handleFieldEdit("dueDate");
                  setDueDate(e.target.value);
                }}
                required
                disabled={isReadOnly || isCancelled}
              />
            </div>
          </div>

          {/* Payment Date - shown only when invoice is paid */}
          {invoice?.paidAt && (
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Payment Date</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                disabled
                readOnly
                className="bg-muted"
              />
            </div>
          )}

          {/* Footer with Preview button - part of scrollable content */}
          {(isReview || isDraft) && invoice?.source === "uploaded" && (
            <div className={cn(
              "pt-4 border-t",
              isMobile ? "flex flex-col gap-2 w-full" : "flex flex-col gap-2"
            )}>
                {/* Preview button - only on mobile */}
                {isMobile && (
                  <Button 
                    variant="outline"
                    onClick={() => {
                      if (showInlinePreview) {
                        setShowInlinePreview(false);
                        return;
                      }
                      if (previewUrl) {
                        setShowInlinePreview(true);
                        requestAnimationFrame(() => {
                          inlinePreviewRef.current?.scrollIntoView({ behavior: 'smooth' });
                        });
                        return;
                      }
                      handlePreviewPDF();
                    }}
                    disabled={isLoading}
                    className="w-full gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    {showInlinePreview ? "Hide Preview" : "Preview"}
                  </Button>
                )}
              </div>
            )}

          {/* Footer with Preview button for sent/paid states - part of scrollable content */}
          {!isReview && !isDraft && invoice?.source === "uploaded" && (
            <div className={cn(
              "pt-4 border-t",
              isMobile ? "flex flex-col gap-2 w-full" : "flex flex-col gap-2"
            )}>
                {/* Preview button - only on mobile */}
                {isMobile && (
                  <Button 
                    variant="outline"
                    onClick={() => {
                      if (showInlinePreview) {
                        setShowInlinePreview(false);
                        return;
                      }
                      if (previewUrl) {
                        setShowInlinePreview(true);
                        requestAnimationFrame(() => {
                          inlinePreviewRef.current?.scrollIntoView({ behavior: 'smooth' });
                        });
                        return;
                      }
                      handlePreviewPDF();
                    }}
                    disabled={isLoading}
                    className="w-full gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    {showInlinePreview ? "Hide Preview" : "Preview"}
                  </Button>
                )}
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Inline Mobile Preview - below form */}
      {isMobile && showInlinePreview && previewUrl && (
        <div
          ref={inlinePreviewRef}
          className="w-full border-t bg-muted/30"
        >
          <DocumentPreview
            fileUrl={previewUrl}
            fileName={previewFileName}
            mimeType={previewMimeType}
          />
        </div>
      )}

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

      {/* Mark as Sent and Paid Dialog */}
      <MarkAsSentAndPaidDialog
        open={markAsSentAndPaidDialogOpen}
        onOpenChange={setMarkAsSentAndPaidDialogOpen}
        onConfirm={handleConfirmMarkAsSentAndPaid}
        isProcessing={markAsPaidMutation.isPending}
      />

      {/* Mark as Not Paid Dialog */}
      {invoice && (
        <MarkAsNotPaidDialog
          open={markAsNotPaidDialogOpen}
          onOpenChange={setMarkAsNotPaidDialogOpen}
          onConfirm={handleConfirmMarkAsNotPaid}
          isProcessing={revertToSentMutation.isPending || revertToDraftMutation.isPending}
          hasPayments={Number(invoice.amountPaid || 0) > 0}
        />
      )}
    </>
  );
}
