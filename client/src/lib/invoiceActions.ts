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
 * - Revert to Sent: only from paid
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

  // Lifecycle actions based on state
  if (isDraft || isReview) {
    // Mark as Sent - only for draft/needsReview, requires dueDate and total>0
    // Validation happens in the handler, but we include it here
    if (invoice.dueDate && Number(invoice.total || 0) > 0) {
      actions.push("markAsSent");
    }
    
    // Mark as Paid - for uploaded invoices that haven't been sent
    if (invoice.source === "uploaded" && !invoice.sentAt) {
      actions.push("markAsPaid");
    }
  }

  if (isSent || isPaid) {
    // Mark as Paid - for sent invoices
    if (isSent && !isPaid) {
      actions.push("markAsPaid");
    }
  }

  // Revert actions
  if (isPaid) {
    actions.push("revertToSent");
  }

  if (isSent && derivedValues.outstanding === 0) {
    // Only allow revert to draft if no payments/outstanding amount
    actions.push("revertToDraft");
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

  switch (action) {
    case "markAsSent":
      // Only for draft/needsReview, requires dueDate and total>0
      if (!isDraft && !isReview) {
        return { valid: false, reason: "Invoice must be in draft or review state" };
      }
      if (!invoice.dueDate) {
        return { valid: false, reason: "Invoice must have a due date" };
      }
      if (Number(invoice.total || 0) <= 0) {
        return { valid: false, reason: "Invoice total must be greater than 0" };
      }
      return { valid: true };

    case "markAsPaid":
      // For sent invoices or draft/uploaded invoices
      if (isPaid) {
        return { valid: false, reason: "Invoice is already paid" };
      }
      return { valid: true };

    case "revertToSent":
      // Only from paid
      if (!isPaid) {
        return { valid: false, reason: "Invoice must be paid to revert to sent" };
      }
      return { valid: true };

    case "revertToDraft":
      // Only from sent AND no payments/outstanding==0
      if (!isSent) {
        return { valid: false, reason: "Invoice must be sent to revert to draft" };
      }
      if (derivedValues.outstanding > 0) {
        return { valid: false, reason: "Invoice has outstanding payments" };
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

    default:
      return { valid: false, reason: "Unknown action" };
  }
}

