/**
 * Invoice State Helpers
 * 
 * Derived state logic based on timestamps (not status field)
 * This is the single source of truth for UI state logic
 */

export type InvoiceState = 'REVIEW' | 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID';

export interface Invoice {
  needsReview: boolean;
  sentAt: Date | string | null;
  paidAt: Date | string | null;
  amountPaid: number | string | null;
  total: number | string;
  dueDate: Date | string | null;
}

/**
 * Get invoice state based on timestamps + needsReview (NOT status field)
 */
export function getInvoiceState(invoice: Invoice): InvoiceState {
  if (invoice.needsReview) return 'REVIEW';
  if (!invoice.sentAt) return 'DRAFT';
  if (invoice.paidAt) return 'PAID';
  const amountPaid = Number(invoice.amountPaid || 0);
  if (amountPaid > 0) return 'PARTIAL';
  return 'SENT';
}

/**
 * Get derived values for invoice (never stored)
 */
export function getDerivedValues(invoice: Invoice) {
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

/**
 * Format currency in German format
 */
export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(num || 0);
}

