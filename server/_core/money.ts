/**
 * Money utilities for accounting-grade precision
 * 
 * ALL currency arithmetic must use integer cents to avoid floating-point errors.
 * Only convert to decimal strings for display.
 * 
 * Rounding: Standard "round half away from zero" (commercial rounding)
 */

/**
 * Parse various currency input formats to integer cents
 * Accepts: "12.34", "12,34", "€12.34", "12", 12.34, 12
 * Rejects: NaN, Infinity, invalid strings
 */
export function parseMoneyToCents(input: string | number): number {
  // Handle number input
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      throw new Error(`Invalid money value: ${input} is not finite`);
    }
    // Round to avoid float precision issues (e.g., 12.345 -> 12.35)
    return Math.round(input * 100);
  }

  // Handle string input
  if (typeof input !== 'string') {
    throw new Error(`Invalid money input type: ${typeof input}`);
  }

  // Remove currency symbols and whitespace
  let cleaned = input.trim()
    .replace(/[€$£¥]/g, '')
    .replace(/\s/g, '');

  // Replace comma decimal separator with period (European format)
  // Only if there's exactly one comma and it's followed by 1-2 digits
  if (/^-?\d+,\d{1,2}$/.test(cleaned)) {
    cleaned = cleaned.replace(',', '.');
  }

  // Parse as float
  const value = parseFloat(cleaned);

  if (!Number.isFinite(value)) {
    throw new Error(`Invalid money value: "${input}" could not be parsed`);
  }

  // Convert to cents with proper rounding
  return Math.round(value * 100);
}

/**
 * Format integer cents to display string
 * @param cents - Amount in cents (integer)
 * @param currency - ISO currency code (default: EUR)
 * @param locale - Locale for formatting (default: de-DE for European format)
 */
export function formatCentsToMoney(
  cents: number,
  currency: string = 'EUR',
  locale: string = 'de-DE'
): string {
  if (!Number.isInteger(cents)) {
    throw new Error(`formatCentsToMoney requires integer cents, got ${cents}`);
  }

  const value = cents / 100;
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Multiply cents by quantity (for invoice line items)
 * unitCents * quantity
 */
export function mulCents(unitCents: number, quantity: number): number {
  if (!Number.isInteger(unitCents)) {
    throw new Error(`mulCents requires integer unitCents, got ${unitCents}`);
  }
  if (!Number.isFinite(quantity)) {
    throw new Error(`mulCents requires finite quantity, got ${quantity}`);
  }

  // Multiply and round (handles fractional quantities like 2.5 units)
  return Math.round(unitCents * quantity);
}

/**
 * Sum an array of cent values
 */
export function sumCents(values: number[]): number {
  if (!Array.isArray(values)) {
    throw new Error(`sumCents requires array, got ${typeof values}`);
  }

  let total = 0;
  for (const value of values) {
    if (!Number.isInteger(value)) {
      throw new Error(`sumCents requires integer values, got ${value}`);
    }
    total += value;
  }
  return total;
}

/**
 * Negate a cent value (for cancellation invoices)
 */
export function negateCents(cents: number): number {
  if (!Number.isInteger(cents)) {
    throw new Error(`negateCents requires integer cents, got ${cents}`);
  }
  // Handle zero to avoid -0
  if (cents === 0) {
    return 0;
  }
  return -cents;
}

/**
 * Calculate percentage of cents (for VAT, discounts, etc.)
 * @param cents - Base amount in cents
 * @param percentage - Percentage as number (19 for 19%, not 0.19)
 */
export function percentOfCents(cents: number, percentage: number): number {
  if (!Number.isInteger(cents)) {
    throw new Error(`percentOfCents requires integer cents, got ${cents}`);
  }
  if (!Number.isFinite(percentage)) {
    throw new Error(`percentOfCents requires finite percentage, got ${percentage}`);
  }

  return Math.round((cents * percentage) / 100);
}

/**
 * DEPRECATED: Legacy helper for backward compatibility
 * Convert decimal string to cents
 */
export function decimalStringToCents(decimal: string): number {
  return parseMoneyToCents(decimal);
}

/**
 * DEPRECATED: Legacy helper for backward compatibility  
 * Convert cents to decimal string (without currency symbol)
 */
export function centsToDecimalString(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new Error(`centsToDecimalString requires integer cents, got ${cents}`);
  }
  return (cents / 100).toFixed(2);
}

