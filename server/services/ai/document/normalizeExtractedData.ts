/**
 * Normalize Extracted Data
 * 
 * Maps Mistral output to Mantodeus internal structure.
 * NEVER invents missing data - uses null for missing values.
 */

import type { RawExtractionOutput, NormalizedExtractionResult } from "./types";

/**
 * Parse date string to Date object
 * Returns null if invalid or missing
 */
function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

/**
 * Parse decimal string to cents (integer)
 * Returns null if invalid or missing
 */
function parseAmountToCents(amountStr: string | null | undefined): number | null {
  if (!amountStr || typeof amountStr !== "string") return null;
  
  try {
    // Remove currency symbols and whitespace
    const cleaned = amountStr.replace(/[€$£,\s]/g, "").trim();
    const amount = parseFloat(cleaned);
    
    if (isNaN(amount) || amount < 0) return null;
    
    // Convert to cents (multiply by 100 and round)
    return Math.round(amount * 100);
  } catch {
    return null;
  }
}

/**
 * Parse VAT rate percentage string to number
 * Returns null if invalid or missing
 */
function parseVatRate(rateStr: string | null | undefined): number | null {
  if (!rateStr || typeof rateStr !== "string") return null;
  
  try {
    // Remove % symbol if present
    const cleaned = rateStr.replace(/%/g, "").trim();
    const rate = parseFloat(cleaned);
    
    if (isNaN(rate) || rate < 0 || rate > 100) return null;
    return rate;
  } catch {
    return null;
  }
}

/**
 * Normalize raw extraction output to internal structure
 */
export function normalizeExtractedData(
  raw: RawExtractionOutput
): NormalizedExtractionResult {
  const fields = raw.fields;
  
  // Normalize dates
  const issueDate = parseDate(fields.issueDate);
  const dueDate = parseDate(fields.dueDate);
  const servicePeriodStart = parseDate(fields.servicePeriodStart);
  const servicePeriodEnd = parseDate(fields.servicePeriodEnd);
  
  // Normalize financial amounts (to cents)
  const subtotalCents = parseAmountToCents(fields.subtotal);
  const vatAmountCents = parseAmountToCents(fields.vatAmount);
  const totalCents = parseAmountToCents(fields.total);
  const currency = fields.currency?.toUpperCase() || "EUR";
  
  // Normalize VAT
  const vatRate = parseVatRate(fields.vatRate);
  const isKleinunternehmer = fields.isKleinunternehmer ?? null;
  const vatExempt = fields.vatExempt ?? null;
  
  // Normalize line items
  const items = (fields.items || []).map((item) => {
    const quantity = item.quantity ? parseFloat(item.quantity) : 0;
    const unitPriceCents = parseAmountToCents(item.unitPrice);
    const lineTotalCents = parseAmountToCents(item.lineTotal) ?? 
      (unitPriceCents !== null && quantity > 0 
        ? Math.round(unitPriceCents * quantity) 
        : null);
    
    return {
      name: item.name?.trim() || "Unnamed item",
      description: item.description?.trim() || null,
      quantity: isNaN(quantity) || quantity <= 0 ? 1 : quantity,
      unitPriceCents: unitPriceCents ?? 0,
      lineTotalCents: lineTotalCents ?? 0,
    };
  });
  
  return {
    documentType: raw.documentType,
    
    // Invoice identification
    invoiceNumber: fields.invoiceNumber?.trim() || null,
    referenceNumber: fields.referenceNumber?.trim() || null,
    
    // Dates
    issueDate,
    dueDate,
    servicePeriodStart,
    servicePeriodEnd,
    
    // Parties
    clientName: fields.clientName?.trim() || null,
    clientAddress: fields.clientAddress?.trim() || null,
    clientVatNumber: fields.clientVatNumber?.trim() || null,
    supplierName: fields.supplierName?.trim() || null,
    supplierAddress: fields.supplierAddress?.trim() || null,
    supplierVatNumber: fields.supplierVatNumber?.trim() || null,
    
    // Financial
    subtotalCents,
    vatAmountCents,
    totalCents,
    currency,
    
    // VAT/Tax
    vatRate,
    isKleinunternehmer,
    vatExempt,
    
    // Line items
    items,
    
    // Notes
    notes: fields.notes?.trim() || null,
    terms: fields.terms?.trim() || null,
    
    // Confidence (pass through)
    confidence: raw.confidence,
    
    // Flags (pass through)
    flags: raw.flags,
  };
}
