/**
 * Filename Parser for Expense Receipts
 * 
 * Extracts structured data from receipt filenames:
 * - Supplier name
 * - Description
 * - Expense date
 * - Gross amount
 * - Currency
 * 
 * Deterministic parsing (no ML, no ambiguity)
 */

export type ParsedFilename = {
  supplierName?: string;
  description?: string;
  expenseDate?: Date;
  grossAmountCents?: number;
  currency?: string;
};

/**
 * Normalize filename: remove extension, clean separators
 */
function normalizeFilename(filename: string): string {
  // Remove extension
  const withoutExt = filename.replace(/\.[^/.]+$/, "");
  // Replace common separators with spaces
  return withoutExt.replace(/[_-]/g, " ").trim();
}

/**
 * Extract ISO date from text (YYYY-MM-DD or DD.MM.YYYY)
 */
function extractDate(text: string): Date | null {
  // ISO format: YYYY-MM-DD
  const isoMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // German format: DD.MM.YYYY
  const germanMatch = text.match(/\b(\d{2})\.(\d{2})\.(\d{4})\b/);
  if (germanMatch) {
    const [, day, month, year] = germanMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

/**
 * Extract amount with currency from text
 * Matches: "123.45€", "123,45 EUR", "123.45 EUR", etc.
 */
function extractAmount(text: string): { amountCents: number; currency: string } | null {
  // Match amounts with € or EUR
  // Patterns: "123.45€", "123,45 EUR", "123.45 EUR", "€123.45", "EUR 123.45"
  const patterns = [
    // Decimal with €: "123.45€" or "123,45€"
    /\b(\d+[.,]\d{2})\s*€/i,
    // Decimal with EUR: "123.45 EUR" or "123,45 EUR"
    /\b(\d+[.,]\d{2})\s*EUR/i,
    // € prefix: "€123.45" or "€123,45"
    /€\s*(\d+[.,]\d{2})/i,
    // EUR prefix: "EUR 123.45" or "EUR 123,45"
    /EUR\s*(\d+[.,]\d{2})/i,
    // Integer with €: "123€" or "123 EUR"
    /\b(\d+)\s*€/i,
    /\b(\d+)\s*EUR/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const amountStr = match[1].replace(",", ".");
      const amount = parseFloat(amountStr);
      if (!isNaN(amount) && amount > 0) {
        const amountCents = Math.round(amount * 100);
        // Default to EUR if not explicitly specified
        const currency = text.includes("EUR") || text.includes("€") ? "EUR" : "EUR";
        return { amountCents, currency };
      }
    }
  }

  return null;
}

/**
 * Extract supplier name from filename
 * Removes date and amount patterns, cleans up
 */
function extractSupplierName(normalized: string, date: Date | null, amount: { amountCents: number; currency: string } | null): string {
  let cleaned = normalized;

  // Remove date patterns
  if (date) {
    // Remove ISO format
    cleaned = cleaned.replace(/\b\d{4}-\d{2}-\d{2}\b/g, "");
    // Remove German format
    cleaned = cleaned.replace(/\b\d{2}\.\d{2}\.\d{4}\b/g, "");
  }

  // Remove amount patterns
  if (amount) {
    // Remove amount with € or EUR
    cleaned = cleaned.replace(/\b\d+[.,]\d{2}\s*[€EUR]/gi, "");
    cleaned = cleaned.replace(/[€EUR]\s*\d+[.,]\d{2}/gi, "");
    cleaned = cleaned.replace(/\b\d+\s*[€EUR]/gi, "");
  }

  // Clean up multiple spaces
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // If empty after cleaning, use original normalized name
  if (!cleaned) {
    return normalized || "Receipt";
  }

  // Capitalize first letter of each word (basic formatting)
  return cleaned
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Parse receipt filename to extract expense data
 * 
 * @param filename Original filename (e.g., "2024-12-17_Amazon_123.45€.pdf")
 * @returns Parsed data or empty object if nothing could be extracted
 */
export function parseReceiptFilename(filename: string): ParsedFilename {
  if (!filename || filename.trim().length === 0) {
    return {};
  }

  const normalized = normalizeFilename(filename);
  const lowerNormalized = normalized.toLowerCase();

  // Extract date
  const date = extractDate(normalized);

  // Extract amount
  const amount = extractAmount(normalized);

  // Extract supplier name (remove date and amount patterns)
  const supplierName = extractSupplierName(normalized, date, amount);

  // Description is the supplier name (can be enhanced later)
  const description = supplierName !== "Receipt" ? supplierName : undefined;

  const result: ParsedFilename = {};

  if (supplierName && supplierName !== "Receipt") {
    result.supplierName = supplierName;
  }

  if (description) {
    result.description = description;
  }

  if (date) {
    result.expenseDate = date;
  }

  if (amount) {
    result.grossAmountCents = amount.amountCents;
    result.currency = amount.currency;
  }

  return result;
}

