/**
 * Invoice Upload Review Dialog
 * 
 * Dialog for reviewing and confirming uploaded PDF invoice data.
 * Per spec Section 19: Review state has Mark as Sent/Paid buttons, Save, and Delete (no Cancel).
 * Buttons ONLY appear in review state for uploaded invoices.
 */

import { useState, useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Loader2, FileText, Eye, Send, CheckCircle2, DocumentCurrencyEuro, CurrencyEuro, X, RotateCcw } from "@/components/ui/Icon";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/useMobile";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { getInvoiceState, getDerivedValues } from "@/lib/invoiceState";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "@/components/ui/Icon";
import { ShareInvoiceDialog } from "./invoices/ShareInvoiceDialog";
import { RevertInvoiceStatusDialog } from "@/components/RevertInvoiceStatusDialog";
import { MarkAsSentAndPaidDialog } from "./invoices/MarkAsSentAndPaidDialog";
import { MarkAsPaidDialog } from "./invoices/MarkAsPaidDialog";
import { MarkAsNotPaidDialog } from "./invoices/MarkAsNotPaidDialog";
import { useSidebar } from "@/components/ui/sidebar";
import { useLongPress } from "@/hooks/useLongPress";

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
  // Get sidebar state to adjust dialog position
  // The dialog is always used within DashboardLayout which has SidebarProvider
  let isSidebarCollapsed = false;
  try {
    const sidebar = useSidebar();
    isSidebarCollapsed = sidebar.state === "collapsed";
  } catch {
    // useSidebar not available (shouldn't happen in normal usage), assume expanded
    isSidebarCollapsed = false;
  }
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState("invoice.pdf");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusButtonRef = useRef<HTMLDivElement>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: invoice } = trpc.invoices.get.useQuery(
    { id: invoiceId! },
    { enabled: !!invoiceId }
  );

  const handlePreviewPDF = async () => {
    if (!invoiceId || !invoice) return;
    
    // On mobile, open in new tab as before
    if (isMobile) {
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
      return;
    }
    
    // On desktop, open preview in left panel
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
      setPreviewOpen(true);
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

  // Track if we've hydrated from parsedData for this invoiceId to prevent overwriting saved values
  const hydratedFromParsedDataRef = useRef<Set<number>>(new Set());

  // Initialize form when parsed data or invoice changes
  // CRITICAL: Prefer invoice (saved DB values) over parsedData to prevent overwriting edits
  useEffect(() => {
    if (!invoiceId) return;

    // If invoice exists (has been saved), always use invoice values
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
    } 
    // Only use parsedData ONCE per invoiceId (first time, before any save)
    else if (parsedData && !hydratedFromParsedDataRef.current.has(invoiceId)) {
      setInvoiceNumber(parsedData.invoiceNumber || "");
      setIssueDate(
        parsedData.invoiceDate
          ? new Date(parsedData.invoiceDate).toISOString().split("T")[0]
          : ""
      );
      setTotalAmount(parsedData.totalAmount || "");
      setClientId("none");
      setDueDate(""); // parsedData doesn't have dueDate, start empty
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

  type StatusAction = {
    action: string;
    label: string;
    icon?: ReactNode;
    disabled?: boolean;
    disabledReason?: string;
    onClick: () => void;
  };

  function getStatusActions(invoice: any): StatusAction[] {
    if (!invoice) return [];

    const actions: StatusAction[] = [];
    const invoiceState = getInvoiceState(invoice);
    const derivedValues = getDerivedValues(invoice);
    const isCancelled = Boolean(invoice.cancelledAt);
    const isReview = invoiceState === "REVIEW";
    const isDraft = invoiceState === "DRAFT" || (invoice.source === "uploaded" && !invoice.needsReview && !invoice.sentAt);
    const isSent = invoiceState === "SENT" || invoiceState === "PARTIAL";
    const isPaid = invoiceState === "PAID";

    if (isDraft || isReview) {
      if (isCancelled) {
        actions.push({
          action: "markAsNotCancelled",
          label: "Mark as Not Cancelled",
          icon: <X className="h-4 w-4" />,
          onClick: () => markAsNotCancelledMutation.mutate({ id: invoiceId! }),
        });
      } else {
        if (!invoice.sentAt) {
          actions.push({
            action: "markAsSent",
            label: "Mark as Sent",
            icon: <Send className="h-4 w-4" />,
            onClick: handleMarkAsSent,
          });
        }
        actions.push({
          action: "markAsPaid",
          label: "Mark as Paid",
          icon: <CurrencyEuro className="h-4 w-4" />,
          onClick: handleMarkAsPaid,
        });
        actions.push({
          action: "cancel",
          label: "Cancel (Void draft)",
          icon: <X className="h-4 w-4" />,
          onClick: () => markAsCancelledMutation.mutate({ id: invoiceId! }),
        });
      }
    }

    if (isSent) {
      actions.push({
        action: "markAsPaid",
        label: "Mark as Paid",
        icon: <CurrencyEuro className="h-4 w-4" />,
        onClick: handleMarkAsPaid,
      });
      // Always show "Revert to Draft" for SENT/OVERDUE invoices
      // Enabled if no payments, disabled if payments exist (to preserve payment data)
      const amountPaid = Number(invoice.amountPaid || 0);
      const hasPayments = amountPaid > 0;
      if (!hasPayments) {
        actions.push({
          action: "revertToDraft",
          label: "Revert to Draft",
          icon: <RotateCcw className="h-4 w-4" />,
          onClick: handleRevertToDraft,
        });
      } else {
        actions.push({
          action: "revertToDraft",
          label: "Revert to Draft",
          icon: <RotateCcw className="h-4 w-4" />,
          disabled: true,
          disabledReason: "Cannot revert to draft: invoice has received payments",
          onClick: () => {},
        });
      }
    }

    if (isPaid) {
      actions.push({
        action: "markAsNotPaid",
        label: "Mark as Not Paid",
        icon: <CheckCircle2 className="h-4 w-4" />,
        onClick: handleMarkAsNotPaid,
      });
    }

    if (isCancelled && !actions.some((action) => action.action === "markAsNotCancelled")) {
      actions.push({
        action: "markAsNotCancelled",
        label: "Mark as Not Cancelled",
        icon: <RotateCcw className="h-4 w-4" />,
        onClick: () => markAsNotCancelledMutation.mutate({ id: invoiceId! }),
      });
    }

    return actions;
  }

  function renderStatusButton(invoice: any) {
    if (!invoice) return null;
    
    const invoiceState = getInvoiceState(invoice);
    const derivedValues = getDerivedValues(invoice);
    
    // Cancelled button (dark color) - highest priority
    if (invoice.cancelledAt) {
      return (
        <Button
          asChild={false}
          variant="default"
          size="default"
          className="text-sm font-semibold border cursor-pointer"
          style={{
            backgroundColor: isDarkMode ? '#0A0F14' : '#F2F1EE',
            color: isDarkMode ? '#FFFFFF' : '#000000',
            borderColor: isDarkMode ? 'rgba(10, 15, 20, 0.5)' : 'rgba(0, 0, 0, 0.2)',
          }}
        >
          CANCELLED
        </Button>
      );
    }
    
    // Button priority: OVERDUE > PARTIAL > SENT/PAID
    if (derivedValues.isOverdue) {
      return (
        <Button asChild={false} variant="destructive" size="default" className="text-sm font-semibold cursor-pointer">
          OVERDUE
        </Button>
      );
    }
    
    if (invoiceState === 'PARTIAL') {
      return (
        <Button
          asChild={false}
          variant="default"
          size="default"
          className="text-sm font-semibold bg-orange-500 text-white dark:bg-orange-600 dark:text-white border-orange-500/50 cursor-pointer hover:bg-orange-600 dark:hover:bg-orange-700"
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
          variant="default"
          size="default"
          className="text-sm font-semibold bg-blue-500 text-white dark:bg-blue-600 dark:text-white border-blue-500/50 cursor-pointer hover:bg-blue-600 dark:hover:bg-blue-700"
        >
          SENT
        </Button>
      );
    }
    
    if (invoiceState === 'DRAFT') {
      return (
        <Button asChild={false} variant="outline" size="default" className="text-sm font-semibold cursor-pointer">
          DRAFT
        </Button>
      );
    }
    
    return null;
  }

  const statusActions = invoice ? getStatusActions(invoice) : [];
  const { longPressHandlers } = useLongPress({
    onLongPress: () => {
      if (statusActions.length > 0) {
        setStatusMenuOpen(true);
      }
    },
    duration: 500,
    hapticFeedback: true,
  });

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

  // Add mouse wheel and trackpad zoom support for preview iframe
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container || !previewOpen) return;

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

    // Listen on both container and iframe wrapper to catch all events
    const iframeWrapper = container.querySelector('[data-iframe-wrapper]') as HTMLElement;
    
    // Use capture phase to catch events before they reach the iframe
    container.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    if (iframeWrapper) {
      iframeWrapper.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    }
    
    // Also listen on the iframe itself (though it may not receive events)
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    if (iframe) {
      iframe.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    }
    
    return () => {
      container.removeEventListener('wheel', handleWheel, { capture: true });
      if (iframeWrapper) {
        iframeWrapper.removeEventListener('wheel', handleWheel, { capture: true });
      }
      if (iframe) {
        iframe.removeEventListener('wheel', handleWheel, { capture: true });
      }
    };
  }, [previewOpen, previewUrl]);

  return (
    <>
      {/* Preview Panel - Left side on desktop - optimized for A4 display */}
      {!isMobile && previewOpen && previewUrl && (
        <div
          data-preview-panel
          className="fixed z-[60] bg-background rounded-lg"
          style={{
            top: '1.5rem',
            left: '1.5rem',
            width: 'calc(40vw - 2rem)', // 40% width with margins for blurred border
            height: 'calc(100vh - 3rem)', // Full height with margins
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col h-full overflow-hidden rounded-lg bg-background">
            {/* Preview Header */}
            <div className="flex items-center justify-between p-4 border-b bg-background">
              <h2 className="text-lg font-semibold">Preview</h2>
            </div>
            {/* Preview Content - full page, no borders - zoomable */}
            <div 
              ref={previewContainerRef}
              data-preview-container
              className="flex-1 overflow-auto bg-background relative"
              style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
            >
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
            </div>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className={cn(
            "flex flex-col p-0",
            // Desktop: right side with margins, showing blurred background border
            "sm:!top-[1.5rem] sm:!bottom-[1.5rem] sm:!translate-x-0 sm:!translate-y-0 sm:!max-w-none sm:!h-auto sm:max-h-[calc(100vh-3rem)]",
            // Mobile: fullscreen with safe margins
            isMobile && "max-h-[calc(100vh-var(--bottom-safe-area,0px)-2rem)] mb-[calc(var(--bottom-safe-area,0px)+1rem)]"
          )}
          style={{
            // Desktop: right side, 60% width with margins for blurred border
            // Mobile: normal dialog behavior
            left: isMobile ? undefined : "calc(40vw + 0.5rem)", // Start after preview + small gap
            right: isMobile ? undefined : "1.5rem",
            top: isMobile ? undefined : "1.5rem",
            bottom: isMobile ? undefined : "1.5rem",
            width: isMobile ? undefined : "calc(60vw - 2rem)", // 60% width with margins
            height: isMobile ? undefined : "calc(100vh - 3rem)",
            maxHeight: isMobile ? undefined : "calc(100vh - 3rem)",
          } as React.CSSProperties}
          showCloseButton={false}
          onInteractOutside={(e) => {
            // Prevent closing when clicking on preview panel
            const target = e.target as HTMLElement;
            const previewPanel = document.querySelector('[data-preview-panel]');
            if (previewPanel && previewPanel.contains(target)) {
              e.preventDefault();
            }
          }}
          onPointerDownOutside={(e) => {
            // Prevent closing when clicking on preview panel
            const target = e.target as HTMLElement;
            const previewPanel = document.querySelector('[data-preview-panel]');
            if (previewPanel && previewPanel.contains(target)) {
              e.preventDefault();
            }
          }}
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
            {/* Preview button - only on mobile (desktop auto-opens preview) */}
            {isMobile && (
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
            )}
            {/* Status button - right click or long-press for status actions */}
            {invoice && (
              statusActions.length === 0 ? (
                renderStatusButton(invoice)
              ) : (
                <DropdownMenu open={statusMenuOpen} onOpenChange={setStatusMenuOpen}>
                  <div
                    ref={statusButtonRef}
                    className="inline-block"
                    {...longPressHandlers}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (statusActions.length > 0) {
                        setStatusMenuOpen(true);
                      }
                    }}
                  >
                    <DropdownMenuTrigger asChild>
                      {renderStatusButton(invoice)}
                    </DropdownMenuTrigger>
                  </div>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>Invoice Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {statusActions.map((actionItem) => (
                      <DropdownMenuItem
                        key={actionItem.action}
                        onClick={() => !actionItem.disabled && actionItem.onClick()}
                        disabled={actionItem.disabled}
                        className={cn("flex items-center gap-2", actionItem.disabled && "opacity-50")}
                      >
                        {actionItem.icon}
                        <div className="flex-1">
                          <div>{actionItem.label}</div>
                          {actionItem.disabled && actionItem.disabledReason && (
                            <div className="text-xs text-muted-foreground">{actionItem.disabledReason}</div>
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )
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


          <div className="space-y-2">
            <Label htmlFor="client">Client</Label>
            <Select value={clientId} onValueChange={setClientId} disabled={isReadOnly || isCancelled}>
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
              <Label htmlFor="invoiceNumber">Invoice Number</Label>
              <Input
                id="invoiceNumber"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Auto-generated if empty"
                disabled={isReadOnly || isCancelled}
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
                disabled={isReadOnly || isCancelled}
              />
            </div>
          </div>

          {/* Row 2: Invoice Date and Due Date side by side on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="issueDate">Invoice Date *</Label>
              <Input
                id="issueDate"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
                disabled={isReadOnly || isCancelled}
              />
            </div>

            {/* Due Date - shown for both review and draft states, required for sending */}
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date *</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
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

          {/* Action buttons: Footer layout for REVIEW and DRAFT states for uploaded invoices */}
          {(isReview || isDraft) && invoice?.source === "uploaded" && (
            <div className={cn(
              "pt-4 border-t",
              isMobile ? "flex flex-col gap-2 w-full" : "flex flex-col gap-2"
            )}>
              {/* Send button - only for non-cancelled draft invoices */}
              {!isReview && isDraft && !isCancelled && (
                <Button
                  onClick={handleSend}
                  disabled={isLoading || (!dueDate && !invoice?.dueDate) || Number(totalAmount || 0) <= 0}
                  className={cn(
                    isMobile ? "w-full" : "",
                    "bg-blue-500 hover:bg-blue-600 text-white dark:bg-blue-600 dark:hover:bg-blue-700"
                  )}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </Button>
              )}

              {/* Delete and Save buttons on same line - Delete left, Save right */}
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isLoading || (isReview ? cancelMutation.isPending : moveToTrashMutation.isPending)}
                  className="flex-1"
                >
                  {(isReview ? cancelMutation.isPending : moveToTrashMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Delete
                </Button>
                {!isReadOnly && !isCancelled && (
                  <Button 
                    onClick={handleSave} 
                    disabled={isLoading || !isFormValid}
                    className="flex-1"
                  >
                    {(confirmMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save
                  </Button>
                )}
              </div>
              
              {/* Revert buttons - only shown when sent/paid (after review) */}
              {!isReview && isSent && !isPaid && derivedValues.outstanding === 0 && (
                <Button
                  variant="outline"
                  onClick={handleRevertToDraft}
                  disabled={isLoading}
                  className={isMobile ? "w-full" : ""}
                >
                  Revert to Draft
                </Button>
              )}
              {!isReview && isPaid && (
                <Button
                  variant="outline"
                  onClick={handleRevertToSent}
                  disabled={isLoading}
                  className={cn(
                    isMobile ? "w-full" : "",
                    "bg-transparent hover:bg-red-500 hover:text-white hover:border-red-500"
                  )}
                >
                  Mark as Not Paid
                </Button>
              )}

              {/* Cancel/Uncancel buttons - only for draft/review invoices */}
              {/* Mark as Not Cancelled - only for cancelled invoices in review state */}
              {isReview && isCancelled && (
                <Button
                  variant="outline"
                  onClick={() => markAsNotCancelledMutation.mutate({ id: invoiceId! })}
                  disabled={isLoading || markAsNotCancelledMutation.isPending}
                  className={cn(
                    isMobile ? "w-full" : "",
                    "bg-transparent hover:bg-red-500 hover:text-white hover:border-red-500"
                  )}
                >
                  {markAsNotCancelledMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Mark as Not Cancelled
                </Button>
              )}
            </div>
          )}

          {/* After review and draft states (sent/paid) - standard layout for uploaded invoices */}
          {!isReview && !isDraft && invoice?.source === "uploaded" && (
            <div className="pt-4 border-t flex flex-col gap-2">
              {/* Revert to Draft - shown for sent invoices, above Delete */}
              {isSent && !isPaid && derivedValues.outstanding === 0 && (
                <Button
                  variant="outline"
                  onClick={handleRevertToDraft}
                  disabled={isLoading}
                  className={cn(
                    "w-full",
                    "bg-transparent hover:bg-red-500 hover:text-white hover:border-red-500"
                  )}
                >
                  Revert to Draft
                </Button>
              )}
              <div className="flex gap-2">
                {/* Delete (replaces Cancel) */}
                <Button 
                  variant="destructive" 
                  onClick={handleDelete} 
                  disabled={isLoading || moveToTrashMutation.isPending}
                  className="flex-1"
                >
                  {moveToTrashMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Delete
                </Button>
                {!isReadOnly && !isCancelled && (
                  <Button 
                    onClick={handleSave} 
                    disabled={isLoading || !isFormValid}
                    className="flex-1"
                  >
                    {(confirmMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save
                  </Button>
                )}
              </div>
              {/* Mark as Not Paid - only shown when paid, on separate line */}
              {isPaid && (
                <Button
                  variant="outline"
                  onClick={handleRevertToSent}
                  disabled={isLoading}
                  className={cn(
                    "w-full",
                    "bg-transparent hover:bg-red-500 hover:text-white hover:border-red-500"
                  )}
                >
                  Mark as Not Paid
                </Button>
              )}
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
    </Dialog>
    </>
  );
}
