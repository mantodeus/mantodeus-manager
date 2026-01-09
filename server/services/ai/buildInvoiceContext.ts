/**
 * Build Invoice Context for AI Assistant
 * 
 * Constructs a context object for the invoice_detail scope.
 * Includes only the fields needed for the assistant to explain state and blockers.
 */

import type { Invoice } from "../../../drizzle/schema";

/**
 * Get invoice state based on timestamps + needsReview (NOT status field)
 */
function getInvoiceState(invoice: {
  needsReview: boolean;
  sentAt: Date | null;
  paidAt: Date | null;
  amountPaid: number | string | null;
}): "DRAFT" | "SENT" | "PARTIAL" | "PAID" | "REVIEW" {
  if (invoice.needsReview) return "REVIEW";
  if (!invoice.sentAt) return "DRAFT";
  if (invoice.paidAt) return "PAID";
  const amountPaid = Number(invoice.amountPaid || 0);
  if (amountPaid > 0) return "PARTIAL";
  return "SENT";
}

/**
 * Get derived values for invoice (never stored)
 */
function getDerivedValues(invoice: {
  total: number | string;
  amountPaid: number | string | null;
  sentAt: Date | null;
  paidAt: Date | null;
  dueDate: Date | null;
}) {
  const total = Number(invoice.total || 0);
  const amountPaid = Number(invoice.amountPaid || 0);
  const outstanding = Math.max(0, total - amountPaid);
  const isPaid = outstanding <= 0;
  const isPartial = amountPaid > 0 && outstanding > 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
  if (dueDate) dueDate.setHours(0, 0, 0, 0);
  
  const isOverdue = invoice.sentAt !== null && !isPaid && dueDate !== null && dueDate < today;
  
  return {
    outstanding,
    isPaid,
    isPartial,
    isOverdue,
  };
}

export interface InvoiceContext {
  invoiceNumber: string | null;
  issueDate: Date | null;
  dueDate: Date | null;
  sentAt: Date | null;
  paidAt: Date | null;
  total: number;
  amountPaid: number;
  state: "DRAFT" | "SENT" | "PARTIAL" | "PAID" | "REVIEW";
  isOverdue: boolean;
  outstanding: number;
  allowedActions: string[];
}

/**
 * Build invoice context for AI assistant
 * 
 * @param invoice - Invoice from database
 * @param allowedActions - List of allowed action IDs (computed server-side)
 */
export function buildInvoiceContext(
  invoice: Invoice,
  allowedActions: string[]
): InvoiceContext {
  const state = getInvoiceState({
    needsReview: invoice.needsReview,
    sentAt: invoice.sentAt,
    paidAt: invoice.paidAt,
    amountPaid: invoice.amountPaid,
    total: invoice.total,
  });

  const derived = getDerivedValues({
    total: invoice.total,
    amountPaid: invoice.amountPaid,
    sentAt: invoice.sentAt,
    paidAt: invoice.paidAt,
    dueDate: invoice.dueDate,
  });

  return {
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    sentAt: invoice.sentAt,
    paidAt: invoice.paidAt,
    total: Number(invoice.total),
    amountPaid: Number(invoice.amountPaid || 0),
    state,
    isOverdue: derived.isOverdue,
    outstanding: derived.outstanding,
    allowedActions,
  };
}
