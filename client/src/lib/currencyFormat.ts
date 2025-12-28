/**
 * Currency Formatting Utilities
 */

export function formatCurrency(amount: number | string, currency: string = "EUR"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0,00 €";
  
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: currency,
  }).format(num || 0);
}

