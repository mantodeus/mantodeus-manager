/**
 * Normalize Extracted Data
 * 
 * Maps Mistral output to Mantodeus internal structure.
 * NEVER invents missing data - uses null for missing values.
 */

import type { RawExtractionOutput, NormalizedExtractionResult } from "./types";

/**
 * Parse date string to Date object with locale-aware parsing
 * Supports German (DD.MM.YYYY) and English (YYYY-MM-DD, MM/DD/YYYY) formats
 * Returns null if invalid or missing
 */
function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  
  const trimmed = dateStr.trim();
  if (trimmed.length === 0) return null;
  
  // Try ISO format first (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) return date;
  }
  
  // Try German format (DD.MM.YYYY)
  const germanMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (germanMatch) {
    const [, day, month, year] = germanMatch;
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    if (!isNaN(date.getTime())) return date;
  }
  
  // Try US format (MM/DD/YYYY)
  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    if (!isNaN(date.getTime())) return date;
  }
  
  // Fallback to Date constructor
  try {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) return date;
  } catch {
    // Ignore
  }
  
  return null;
}

/**
 * Parse amount to cents (integer)
 * Handles both string and number inputs
 * Returns null if invalid or missing
 */
function parseAmountToCents(amount: string | number | null | undefined): number | null {
  if (amount === null || amount === undefined) return null;
  
  // If already a number, convert directly
  if (typeof amount === "number") {
    if (isNaN(amount) || amount < 0) return null;
    return Math.round(amount * 100);
  }
  
  // If string, parse it
  if (typeof amount !== "string") return null;
  
  try {
    // Remove currency symbols, whitespace, and thousand separators
    // Handle both . and , as decimal separators
    let cleaned = amount.replace(/[€$£\s]/g, "").trim();
    
    // German format: 1.234,56 -> 1234.56
    // English format: 1,234.56 -> 1234.56
    if (cleaned.includes(",") && cleaned.includes(".")) {
      // Has both - determine which is decimal separator
      const lastComma = cleaned.lastIndexOf(",");
      const lastDot = cleaned.lastIndexOf(".");
      if (lastComma > lastDot) {
        // Comma is decimal separator
        cleaned = cleaned.replace(/\./g, "").replace(",", ".");
      } else {
        // Dot is decimal separator
        cleaned = cleaned.replace(/,/g, "");
      }
    } else if (cleaned.includes(",")) {
      // Only comma - could be German decimal or thousand separator
      // If followed by 2 digits, it's likely decimal
      const commaMatch = cleaned.match(/,(\d{1,2})$/);
      if (commaMatch && commaMatch[1].length <= 2) {
        cleaned = cleaned.replace(",", ".");
      } else {
        cleaned = cleaned.replace(/,/g, "");
      }
    }
    
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed) || parsed < 0) return null;
    
    return Math.round(parsed * 100);
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
 * Handles both new format (with per-field confidence) and legacy format
 */
export function normalizeExtractedData(
  raw: RawExtractionOutput
): NormalizedExtractionResult {
  // Handle new format (with client, invoiceNumber, etc. as objects)
  const isNewFormat = "client" in raw && typeof raw.client === "object";
  
  let clientName: string | null = null;
  let invoiceNumber: string | null = null;
  let issueDate: Date | null = null;
  let dueDate: Date | null = null;
  let servicePeriodStart: Date | null = null;
  let servicePeriodEnd: Date | null = null;
  let totalCents: number | null = null;
  let currency: string = "EUR";
  
  // Build confidence map
  const fieldConfidence: Record<string, number> = {};
  
  if (isNewFormat) {
    // New format
    clientName = raw.client?.name?.trim() || null;
    invoiceNumber = raw.invoiceNumber?.value?.trim() || null;
    issueDate = parseDate(raw.invoiceDate?.value);
    dueDate = parseDate(raw.dueDate?.value);
    servicePeriodStart = parseDate(raw.servicePeriod?.from);
    servicePeriodEnd = parseDate(raw.servicePeriod?.to);
    totalCents = parseAmountToCents(raw.total?.amount);
    currency = raw.total?.currency?.toUpperCase() || "EUR";
    
    // Extract confidence scores
    if (raw.client) fieldConfidence.clientName = raw.client.confidence;
    if (raw.invoiceNumber) fieldConfidence.invoiceNumber = raw.invoiceNumber.confidence;
    if (raw.invoiceDate) fieldConfidence.issueDate = raw.invoiceDate.confidence;
    if (raw.dueDate) fieldConfidence.dueDate = raw.dueDate.confidence;
    if (raw.total) fieldConfidence.total = raw.total.confidence;
  } else {
    // Legacy format (backward compatibility)
    const fields = raw.fields || {};
    clientName = fields.clientName?.trim() || null;
    invoiceNumber = fields.invoiceNumber?.trim() || null;
    issueDate = parseDate(fields.issueDate);
    dueDate = parseDate(fields.dueDate);
    servicePeriodStart = parseDate(fields.servicePeriodStart);
    servicePeriodEnd = parseDate(fields.servicePeriodEnd);
    totalCents = parseAmountToCents(fields.total);
    currency = fields.currency?.toUpperCase() || "EUR";
    
    // Use legacy confidence if available
    if (raw.confidence?.fields) {
      Object.assign(fieldConfidence, raw.confidence.fields);
    }
  }
  
  // Calculate overall confidence
  const confidenceValues = Object.values(fieldConfidence);
  const overallConfidence = confidenceValues.length > 0
    ? confidenceValues.reduce((sum, val) => sum + val, 0) / confidenceValues.length
    : 0.5;
  
  // Build flags array
  const flags: string[] = [];
  if (raw.flags && Array.isArray(raw.flags)) {
    flags.push(...raw.flags);
  } else if (raw.flags && typeof raw.flags === "object") {
    // Legacy flags object
    if (raw.flags.missingFields?.length > 0) {
      flags.push(...raw.flags.missingFields.map((f: string) => `missing_${f}`));
    }
    if (raw.flags.suspiciousFields?.length > 0) {
      flags.push(...raw.flags.suspiciousFields.map((f: string) => `suspicious_${f}`));
    }
  }
  
  // Check for low confidence fields
  for (const [field, conf] of Object.entries(fieldConfidence)) {
    if (conf < 0.6) {
      flags.push(`low_confidence_${field}`);
    }
  }
  
  return {
    documentType: raw.documentType,
    
    // Invoice identification
    invoiceNumber,
    referenceNumber: null, // Not in new format yet
    
    // Dates
    issueDate,
    dueDate,
    servicePeriodStart,
    servicePeriodEnd,
    
    // Parties
    clientName,
    clientAddress: null, // Not in new format yet
    clientVatNumber: null, // Not in new format yet
    supplierName: null, // Not in new format yet
    supplierAddress: null, // Not in new format yet
    supplierVatNumber: null, // Not in new format yet
    
    // Financial
    subtotalCents: null, // Not in new format yet
    vatAmountCents: null, // Not in new format yet
    totalCents,
    currency,
    
    // VAT/Tax
    vatRate: null, // Not in new format yet
    isKleinunternehmer: null, // Not in new format yet
    vatExempt: null, // Not in new format yet
    
    // Line items
    items: [], // Not in new format yet
    
    // Notes
    notes: null, // Not in new format yet
    terms: null, // Not in new format yet
    
    // Confidence
    confidence: {
      overall: overallConfidence,
      fields: fieldConfidence,
    },
    
    // Flags
    flags: {
      missingFields: flags.filter(f => f.startsWith("missing_")).map(f => f.replace("missing_", "")),
      suspiciousFields: flags.filter(f => f.startsWith("suspicious_")).map(f => f.replace("suspicious_", "")),
      requiresReview: overallConfidence < 0.7 || flags.length > 0,
    },
  };
}
