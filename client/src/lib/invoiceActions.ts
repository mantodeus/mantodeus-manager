/**
 * Shared Invoice Actions Model
 * 
 * Provides a consistent action model for both long-press context menus and multi-select bars.
 * Ensures both UIs offer the same actions based on invoice state.
 */

import type { CenteredContextMenuAction } from "@/components/CenteredContextMenu";
import { getInvoiceState, getDerivedValues } from "./invoiceState";
import type { Invoice } from "@shared/types";

export type InvoiceAction = CenteredContextMenuAction;

export interface InvoiceActionConfig {
  action: InvoiceAction;
  label: string;
  variant?: "default" | "destructive";
  disabled?: boolean;
  requiresConfirmation?: boolean;
}

export interface GetInvoiceActionsParams {
  invoice: Invoice;
  selectionCount?: number;
  selectionMode?: boolean;
}

/**
 * Get available actions for an invoice based on its state
 * 
 * State rules:
 * - Mark as Sent: only for draft/needsReview invoices, requires dueDate and total>0
 * - Mark as Paid: only for sent/draft historical uploaded invoices; if not sent, show confirm "Mark as Sent and Paid?"
 * - Mark as Not Paid: only from paid
 * - Revert to Draft: only from sent AND no payments/outstanding==0
 * - Delete: in review => cancel upload (hard delete); else => move to trash (soft delete)
 * - Archive: only for open/sent/paid where allowed
 * - Duplicate: creates a new draft copy
 */
export function getInvoiceActions({
  invoice,
  selectionCount = 1,
  selectionMode = false,
}: GetInvoiceActionsParams): InvoiceAction[] {
  const actions: InvoiceAction[] = [];
  const invoiceState = getInvoiceState(invoice);
  const derivedValues = getDerivedValues(invoice);
  const isReview = invoiceState === 'REVIEW';
  const isDraft = invoiceState === 'DRAFT';
  const isSent = invoiceState === 'SENT' || invoiceState === 'PARTIAL';
  const isPaid = invoiceState === 'PAID';
  const isOverdue = derivedValues.isOverdue;

  // Primary actions (always available)
  actions.push("edit");
  
  // Duplicate - always available
  actions.push("duplicate");

  // Select - only in single-item mode (not in multi-select bar)
  if (!selectionMode) {
    actions.push("select");
  }

  // Check if invoice is cancelled - cancelled invoices cannot have markAsSent or markAsPaid actions
  const isCancelled = invoice.cancelledAt !== null;

  // Lifecycle actions based on state
  if (isDraft || isReview) {
    // Mark as Sent - only available for draft/review invoices that are NOT cancelled
    // Validation (dueDate and total>0) happens in the handler
    if (!isCancelled) {
      actions.push("markAsSent");
    }
    
    // Mark as Paid - for uploaded invoices that haven't been sent (only if not cancelled)
    if (!isCancelled && invoice.source === "uploaded" && !invoice.sentAt) {
      actions.push("markAsPaid");
    }

    // Mark as Cancelled / Mark as Not Cancelled - only for draft/review invoices
    if (isCancelled) {
      actions.push("markAsNotCancelled");
    } else {
      actions.push("markAsCancelled");
    }
  }

  if (isSent || isPaid) {
    // Mark as Paid - for sent invoices (only if not cancelled)
    if (!isCancelled && isSent && !isPaid) {
      actions.push("markAsPaid");
    }
  }

  // Revert actions
  if (isPaid) {
    actions.push("revertToSent");
  }

  if (isSent) {
    // Allow revert to draft for sent invoices with no payments
    // For sent invoices: outstanding = total when no payments, so check amountPaid instead
    const amountPaid = Number(invoice.amountPaid || 0);
    if (amountPaid === 0) {
      // No payments received - can revert to draft
      actions.push("revertToDraft");
    }
  }

  // Archive - for open/sent/paid (not draft or review)
  if (!isDraft && !isReview) {
    actions.push("archive");
  }

  // Delete - always available
  // In review => cancel upload (hard delete)
  // Else => move to trash (soft delete)
  actions.push("delete");

  return actions;
}

/**
 * Check if an action is valid for a specific invoice
 * Used for batch operations to filter out invalid actions
 */
export function isActionValidForInvoice(
  action: InvoiceAction,
  invoice: Invoice
): { valid: boolean; reason?: string } {
  const invoiceState = getInvoiceState(invoice);
  const derivedValues = getDerivedValues(invoice);
  const isReview = invoiceState === 'REVIEW';
  const isDraft = invoiceState === 'DRAFT';
  const isSent = invoiceState === 'SENT' || invoiceState === 'PARTIAL';
  const isPaid = invoiceState === 'PAID';

  // Check if invoice is cancelled - cancelled invoices cannot have markAsSent or markAsPaid actions
  const isCancelled = invoice.cancelledAt !== null;

  switch (action) {
    case "markAsSent":
      // Cancelled invoices cannot be marked as sent
      if (isCancelled) {
        return { valid: false, reason: "Cancelled invoices cannot be marked as sent" };
      }
      // Only for draft/needsReview
      if (!isDraft && !isReview) {
        return { valid: false, reason: "Invoice must be in draft or review state" };
      }
      // Note: dueDate and total>0 validation happens in the handler, not here
      // This allows the action to show in menus even if validation fails
      return { valid: true };

    case "markAsPaid":
      // Cancelled invoices cannot be marked as paid
      if (isCancelled) {
        return { valid: false, reason: "Cancelled invoices cannot be marked as paid" };
      }
      // For sent invoices or draft/uploaded invoices
      if (isPaid) {
        return { valid: false, reason: "Invoice is already paid" };
      }
      return { valid: true };

    case "revertToSent":
      // Only from paid
      if (!isPaid) {
        return { valid: false, reason: "Invoice must be paid to mark as not paid" };
      }
      return { valid: true };

    case "revertToDraft":
      // Only from sent AND no payments (amountPaid must be 0)
      if (!isSent) {
        return { valid: false, reason: "Invoice must be sent to revert to draft" };
      }
      // Check if there are any payments (amountPaid > 0)
      const amountPaid = Number(invoice.amountPaid || 0);
      if (amountPaid > 0) {
        return { valid: false, reason: "Invoice has payments and cannot be reverted to draft" };
      }
      return { valid: true };

    case "archive":
      // Not for draft or review
      if (isDraft || isReview) {
        return { valid: false, reason: "Draft and review invoices cannot be archived" };
      }
      return { valid: true };

    case "delete":
      // Always valid (handled differently for review vs others)
      return { valid: true };

    case "duplicate":
      // Always valid
      return { valid: true };

    case "edit":
      // Always valid
      return { valid: true };

    case "select":
      // Always valid
      return { valid: true };

    case "markAsCancelled":
      // Only for draft or review invoices
      if (!isDraft && !isReview) {
        return { valid: false, reason: "Only draft or review invoices can be cancelled" };
      }
      if (invoice.cancelledAt !== null) {
        return { valid: false, reason: "Invoice is already cancelled" };
      }
      return { valid: true };

    case "markAsNotCancelled":
      // Only for draft or review invoices
      if (!isDraft && !isReview) {
        return { valid: false, reason: "Only draft or review invoices can be uncancelled" };
      }
      if (invoice.cancelledAt === null) {
        return { valid: false, reason: "Invoice is not cancelled" };
      }
      return { valid: true };

    default:
      return { valid: false, reason: "Unknown action" };
  }
}

