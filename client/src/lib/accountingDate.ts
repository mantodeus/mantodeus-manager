/**
 * Accounting Date Utility
 * 
 * Calculates the accounting date for income recognition based on company settings.
 * This determines which year/quarter an invoice's income is counted in.
 * 
 * Rules:
 * - Kleinunternehmer + EÜR: Use paidAt (income recognized when payment received)
 * - Non-Kleinunternehmer + EÜR: Use paidAt (income recognized when payment received)
 * - Bilanz: Use servicePeriodEnd (income recognized when service completed)
 */

import type { Invoice } from "@shared/types";
import type { CompanySettings } from "@/drizzle/schema";

export interface AccountingDateResult {
  accountingDate: Date | null;
  accountingYear: number | null;
  accountingQuarter: number | null;
}

/**
 * Calculate the accounting date for an invoice based on company settings
 * 
 * @param invoice - The invoice to calculate accounting date for
 * @param companySettings - Company settings containing accounting method
 * @returns Accounting date result with date, year, and quarter
 */
export function getAccountingDate(
  invoice: Invoice,
  companySettings: CompanySettings | null | undefined
): AccountingDateResult {
  // Default to EÜR if no settings
  const accountingMethod = companySettings?.accountingMethod || 'EÜR';
  const isKleinunternehmer = companySettings?.isKleinunternehmer || false;

  let accountingDate: Date | null = null;

  // Rule 1 & 2: EÜR (both Kleinunternehmer and non-Kleinunternehmer)
  // Income recognized when payment is received
  if (accountingMethod === 'EÜR') {
    accountingDate = invoice.paidAt ? new Date(invoice.paidAt) : null;
  }
  // Rule 3: Bilanz
  // Income recognized by service period (when service was completed)
  else if (accountingMethod === 'BILANZ') {
    accountingDate = invoice.servicePeriodEnd 
      ? new Date(invoice.servicePeriodEnd) 
      : null;
  }

  // Calculate year and quarter from accounting date
  let accountingYear: number | null = null;
  let accountingQuarter: number | null = null;

  if (accountingDate) {
    accountingYear = accountingDate.getFullYear();
    accountingQuarter = Math.floor(accountingDate.getMonth() / 3) + 1;
  }

  return {
    accountingDate,
    accountingYear,
    accountingQuarter,
  };
}

/**
 * Get helper text explaining the income recognition method
 * 
 * @param companySettings - Company settings
 * @returns Helper text string
 */
export function getAccountingHelperText(
  companySettings: CompanySettings | null | undefined
): string {
  const accountingMethod = companySettings?.accountingMethod || 'EÜR';
  const isKleinunternehmer = companySettings?.isKleinunternehmer || false;

  if (accountingMethod === 'BILANZ') {
    return "Income is counted in the year the service was performed.";
  }

  if (isKleinunternehmer && accountingMethod === 'EÜR') {
    return "Income is counted when payment is received (§11 EStG).";
  }

  // Non-Kleinunternehmer + EÜR
  return "Income is counted when payment is received.";
}

