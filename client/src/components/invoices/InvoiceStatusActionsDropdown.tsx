import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInvoiceState, getDerivedValues, formatCurrency } from "@/lib/invoiceState";
import { MarkAsPaidDialog } from "./MarkAsPaidDialog";
import { MarkAsNotPaidDialog } from "./MarkAsNotPaidDialog";
import { RevertInvoiceStatusDialog } from "@/components/RevertInvoiceStatusDialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Send, CheckCircle2, X, FileX, RotateCcw, Plus, XCircle } from "@/components/ui/Icon";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { useLongPress } from "@/hooks/useLongPress";

export type InvoiceStatusAction =
  | "send"
  | "markAsPaid"
  | "addPayment"
  | "revertToSent"
  | "revertToDraft"
  | "cancel"
  | "markAsNotCancelled"
  | "createCancellation"
  | "confirmAndSave"
  | "markAsSentAndPaid"
  | "deleteUpload";

interface InvoiceStatusActionsDropdownProps {
  invoice: {
    id: number;
    invoiceNumber: string;
    needsReview: boolean;
    sentAt: Date | string | null;
    paidAt: Date | string | null;
    amountPaid: number | string | null;
    total: number | string;
    dueDate: Date | string | null;
    cancelledAt: Date | string | null;
    source: "created" | "uploaded";
    type?: "standard" | "cancellation";
  };
  onActionComplete?: () => void;
}

/**
 * Get allowed status actions for an invoice based on its current state
 * This is the single source of truth for invoice lifecycle actions
 */
function getInvoiceStatusActions(invoice: InvoiceStatusActionsDropdownProps["invoice"]): Array<{
  action: InvoiceStatusAction;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  disabledReason?: string;
}> {
  const invoiceState = getInvoiceState(invoice);
  const derivedValues = getDerivedValues(invoice);
  const isCancelled = invoice.cancelledAt !== null;
  const amountPaid = Number(invoice.amountPaid || 0);
  const total = Number(invoice.total || 0);
  const hasPayments = amountPaid > 0;

  const actions: Array<{
    action: InvoiceStatusAction;
    label: string;
    icon?: React.ReactNode;
    disabled?: boolean;
    disabledReason?: string;
  }> = [];

  // DRAFT state
  if (invoiceState === "DRAFT") {
    if (!isCancelled) {
      actions.push({
        action: "send",
        label: "Send",
        icon: <Send className="h-4 w-4" />,
      });
    }
    if (isCancelled) {
      actions.push({
        action: "markAsNotCancelled",
        label: "Mark as Not Cancelled",
        icon: <X className="h-4 w-4" />,
      });
    } else {
      actions.push({
        action: "cancel",
        label: "Cancel (Void draft)",
        icon: <XCircle className="h-4 w-4" />,
      });
    }
  }

  // REVIEW state (uploaded invoices)
  if (invoiceState === "REVIEW") {
    actions.push({
      action: "confirmAndSave",
      label: "Confirm & Save",
      icon: <CheckCircle2 className="h-4 w-4" />,
    });
    if (invoice.source === "uploaded") {
      actions.push({
        action: "markAsSentAndPaid",
        label: "Mark as Sent & Paid (Historical)",
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
    }
    actions.push({
      action: "deleteUpload",
      label: "Delete Upload",
      icon: <X className="h-4 w-4" />,
    });
    if (isCancelled) {
      actions.push({
        action: "markAsNotCancelled",
        label: "Mark as Not Cancelled",
        icon: <X className="h-4 w-4" />,
      });
    } else {
      actions.push({
        action: "cancel",
        label: "Cancel (Void draft)",
        icon: <XCircle className="h-4 w-4" />,
      });
    }
  }

  // SENT state (includes OVERDUE invoices - overdue is a visual badge, not a separate state)
  if (invoiceState === "SENT") {
    actions.push({
      action: "markAsPaid",
      label: "Mark as Paid",
      icon: <CheckCircle2 className="h-4 w-4" />,
    });
    // Always show "Revert to Draft" option for SENT/OVERDUE invoices
    // Enabled if no payments, disabled if payments exist (to preserve payment data)
    if (!hasPayments) {
      actions.push({
        action: "revertToDraft",
        label: "Revert to Draft",
        icon: <RotateCcw className="h-4 w-4" />,
      });
    } else {
      actions.push({
        action: "revertToDraft",
        label: "Revert to Draft",
        icon: <RotateCcw className="h-4 w-4" />,
        disabled: true,
        disabledReason: "Cannot revert to draft: invoice has received payments",
      });
    }
    if (!isCancelled) {
      actions.push({
        action: "cancel",
        label: "Cancel (Create cancellation invoice)",
        icon: <XCircle className="h-4 w-4" />,
      });
    }
  }

  // PARTIAL state
  if (invoiceState === "PARTIAL") {
    actions.push({
      action: "addPayment",
      label: "Add Payment",
      icon: <Plus className="h-4 w-4" />,
    });
    actions.push({
      action: "markAsPaid",
      label: "Mark as Paid",
      icon: <CheckCircle2 className="h-4 w-4" />,
    });
    // Mark as not paid is allowed (preserves payment data)
    actions.push({
      action: "revertToSent",
      label: "Mark as Not Paid",
      icon: <RotateCcw className="h-4 w-4" />,
    });
  }

  // PAID state
  if (invoiceState === "PAID") {
    actions.push({
      action: "revertToSent",
      label: "Mark as Not Paid",
      icon: <RotateCcw className="h-4 w-4" />,
    });
    if (!isCancelled && invoice.type !== "cancellation") {
      actions.push({
        action: "createCancellation",
        label: "Create Cancellation Invoice",
        icon: <XCircle className="h-4 w-4" />,
      });
    }
  }

  // CANCELLED state (for draft/review invoices)
  if (isCancelled && (invoiceState === "DRAFT" || invoiceState === "REVIEW")) {
    actions.push({
      action: "markAsNotCancelled",
      label: "Mark as Not Cancelled",
      icon: <X className="h-4 w-4" />,
    });
  }

  return actions;
}

/**
 * Status badge with dropdown menu for invoice lifecycle actions
 * This is the SINGLE control surface for all invoice status changes
 */
export function InvoiceStatusActionsDropdown({
  invoice,
  onActionComplete,
  onSend,
  onAddPayment,
}: InvoiceStatusActionsDropdownProps) {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const invoiceState = getInvoiceState(invoice);
  const derivedValues = getDerivedValues(invoice);
  const isCancelled = invoice.cancelledAt !== null;
  const amountPaid = Number(invoice.amountPaid || 0);
  const total = Number(invoice.total || 0);
  const hasPayments = amountPaid > 0;

  const utils = trpc.useUtils();
  const [markAsPaidDialogOpen, setMarkAsPaidDialogOpen] = useState(false);
  const [markAsNotPaidDialogOpen, setMarkAsNotPaidDialogOpen] = useState(false);
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [revertTarget, setRevertTarget] = useState<"sent" | "draft" | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);

  const markAsPaidMutation = trpc.invoices.markAsPaid.useMutation({
    onSuccess: () => {
      toast.success("Invoice marked as paid");
      utils.invoices.get.invalidate({ id: invoice.id });
      onActionComplete?.();
    },
    onError: (err) => toast.error(err.message),
  });

  const markAsSentMutation = trpc.invoices.markAsSent.useMutation({
    onSuccess: () => {
      toast.success("Invoice marked as sent");
      utils.invoices.get.invalidate({ id: invoice.id });
      onActionComplete?.();
    },
    onError: (err) => toast.error(err.message),
  });

  const revertToDraftMutation = trpc.invoices.revertToDraft.useMutation({
    onSuccess: () => {
      toast.success("Invoice reverted to draft");
      utils.invoices.get.invalidate({ id: invoice.id });
      onActionComplete?.();
    },
    onError: (err) => toast.error(err.message),
  });

  const revertToSentMutation = trpc.invoices.revertToSent.useMutation({
    onSuccess: () => {
      toast.success("Invoice marked as not paid");
      utils.invoices.get.invalidate({ id: invoice.id });
      onActionComplete?.();
    },
    onError: (err) => toast.error(err.message),
  });

  const markAsCancelledMutation = trpc.invoices.markAsCancelled.useMutation({
    onSuccess: () => {
      toast.success("Invoice marked as cancelled");
      utils.invoices.get.invalidate({ id: invoice.id });
      onActionComplete?.();
    },
    onError: (err) => toast.error(err.message),
  });

  const markAsNotCancelledMutation = trpc.invoices.markAsNotCancelled.useMutation({
    onSuccess: () => {
      toast.success("Invoice marked as not cancelled");
      utils.invoices.get.invalidate({ id: invoice.id });
      onActionComplete?.();
    },
    onError: (err) => toast.error(err.message),
  });

  const createCancellationMutation = trpc.invoices.createCancellation.useMutation({
    onSuccess: () => {
      toast.success("Cancellation invoice created");
      utils.invoices.list.invalidate();
      onActionComplete?.();
    },
    onError: (err) => toast.error(err.message),
  });

  const addPaymentMutation = trpc.invoices.addInvoicePayment.useMutation({
    onSuccess: () => {
      toast.success("Payment added");
      utils.invoices.get.invalidate({ id: invoice.id });
      onActionComplete?.();
    },
    onError: (err) => toast.error(err.message),
  });

  const availableActions = getInvoiceStatusActions(invoice);

  // Use long-press hook for mobile support
  const { longPressHandlers } = useLongPress({
    onLongPress: () => {
      if (availableActions.length > 0) {
        setDropdownOpen(true);
      }
    },
    duration: 500,
    hapticFeedback: true,
  });

  // Render status badge as button (bigger, more touch-friendly)
  const renderStatusBadge = () => {
    // Cancelled button (dark color) - highest priority
    if (isCancelled) {
      return (
        <Button
          asChild={false}
          variant="default"
          size="default"
          className="text-sm font-semibold border-[#F2F1EE]/50 dark:border-[#0A0F14]/50 cursor-pointer"
          style={{
            backgroundColor: isDarkMode ? "#0A0F14" : "#F2F1EE",
            color: isDarkMode ? "#FFFFFF" : undefined,
            borderColor: isDarkMode ? "rgba(10, 15, 20, 0.5)" : "rgba(242, 241, 238, 0.5)",
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

    if (invoiceState === "PARTIAL") {
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

    if (invoiceState === "PAID") {
      return (
        <Button
          asChild={false}
          variant="default"
          size="default"
          className="text-sm font-semibold cursor-pointer"
          style={{
            backgroundColor: isDarkMode ? "#00FF88" : "rgb(236, 72, 153)",
            color: isDarkMode ? "#000000" : "white",
            borderColor: isDarkMode ? "rgba(0, 255, 136, 0.5)" : "rgba(236, 72, 153, 0.5)",
          }}
        >
          PAID
        </Button>
      );
    }

    if (invoiceState === "SENT") {
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

    if (invoiceState === "DRAFT") {
      return <Button asChild={false} variant="outline" size="default" className="text-sm font-semibold cursor-pointer">DRAFT</Button>;
    }

    if (invoiceState === "REVIEW") {
      return <Button asChild={false} variant="outline" size="default" className="text-sm font-semibold cursor-pointer">NEEDS REVIEW</Button>;
    }

    return null;
  };

  const handleAction = (action: InvoiceStatusAction) => {
    switch (action) {
      case "send":
        // Check if invoice is cancelled - must be marked as not cancelled before sending
        if (invoice.cancelledAt !== null && invoice.cancelledAt !== undefined) {
          toast.error("Cancelled invoices cannot be sent. Please mark the invoice as not cancelled first.");
          return;
        }
        // Validate before sending
        if (!invoice.dueDate) {
          toast.error("Invoice must have a due date before it can be sent");
          return;
        }
        const total = Number(invoice.total || 0);
        if (total <= 0) {
          toast.error("Invoice total must be greater than 0");
          return;
        }
        // Call parent callback to open ShareInvoiceDialog
        if (onSend) {
          onSend();
        } else {
          // Fallback: just mark as sent
          markAsSentMutation.mutate({ id: invoice.id });
        }
        break;

      case "markAsPaid":
        setMarkAsPaidDialogOpen(true);
        break;

      case "addPayment":
        // Call parent callback to open AddPaymentDialog
        if (onAddPayment) {
          onAddPayment();
        } else {
          toast.info("Add Payment action - to be implemented via parent component");
        }
        break;

      case "revertToSent":
        setRevertTarget("sent");
        setRevertDialogOpen(true);
        break;

      case "revertToDraft":
        if (hasPayments) {
          toast.error("Cannot revert to draft: invoice has received payments");
          return;
        }
        setRevertTarget("draft");
        setRevertDialogOpen(true);
        break;

      case "cancel":
        markAsCancelledMutation.mutate({ id: invoice.id });
        break;

      case "markAsNotCancelled":
        markAsNotCancelledMutation.mutate({ id: invoice.id });
        break;

      case "createCancellation":
        createCancellationMutation.mutate({ invoiceId: invoice.id });
        break;

      case "confirmAndSave":
      case "markAsSentAndPaid":
      case "deleteUpload":
        // These are handled in InvoiceUploadReviewDialog, not here
        toast.info("This action should be handled in the review dialog");
        break;
    }
  };

  const handleMarkAsPaidConfirm = (paidAt: Date) => {
    const alsoMarkAsSent = invoice.source === "uploaded" && !invoice.sentAt;
    markAsPaidMutation.mutate({
      id: invoice.id,
      paidAt,
      alsoMarkAsSent,
    });
    setMarkAsPaidDialogOpen(false);
  };

  const handleMarkAsNotPaidConfirm = (target: "sent" | "draft") => {
    setMarkAsNotPaidDialogOpen(false);
    if (target === "sent") {
      revertToSentMutation.mutate({ id: invoice.id, confirmed: true });
    } else if (target === "draft") {
      revertToDraftMutation.mutate({ id: invoice.id, confirmed: true });
    }
  };

  const handleRevertConfirm = () => {
    if (revertTarget === "sent") {
      revertToSentMutation.mutate({ id: invoice.id, confirmed: true });
    } else if (revertTarget === "draft") {
      revertToDraftMutation.mutate({ id: invoice.id, confirmed: true });
    }
    setRevertDialogOpen(false);
    setRevertTarget(null);
  };


  // If no actions available, just show the badge
  if (availableActions.length === 0) {
    return renderStatusBadge();
  }

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <div
          ref={badgeRef}
          className="inline-block"
          {...longPressHandlers}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (availableActions.length > 0) {
              setDropdownOpen(true);
            }
          }}
        >
          <DropdownMenuTrigger asChild>
            {renderStatusBadge()}
          </DropdownMenuTrigger>
        </div>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Invoice Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {availableActions.map((actionItem) => (
            <DropdownMenuItem
              key={actionItem.action}
              onClick={() => !actionItem.disabled && handleAction(actionItem.action)}
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

      {/* Dialogs */}
      <MarkAsPaidDialog
        open={markAsPaidDialogOpen}
        onOpenChange={setMarkAsPaidDialogOpen}
        onConfirm={handleMarkAsPaidConfirm}
        isProcessing={markAsPaidMutation.isPending}
        invoiceNumber={invoice.invoiceNumber}
      />

      <MarkAsNotPaidDialog
        open={markAsNotPaidDialogOpen}
        onOpenChange={setMarkAsNotPaidDialogOpen}
        onConfirm={handleMarkAsNotPaidConfirm}
        isProcessing={revertToSentMutation.isPending || revertToDraftMutation.isPending}
        hasPayments={hasPayments}
      />

      {revertTarget && (
        <RevertInvoiceStatusDialog
          open={revertDialogOpen}
          onOpenChange={setRevertDialogOpen}
          currentStatus={revertTarget === "draft" ? "open" : "paid"}
          targetStatus={revertTarget}
          invoiceNumber={invoice.invoiceNumber}
          invoiceAmount={invoice.total}
          onConfirm={handleRevertConfirm}
          isReverting={revertToDraftMutation.isPending || revertToSentMutation.isPending}
        />
      )}
    </>
  );
}
