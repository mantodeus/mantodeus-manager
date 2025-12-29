/**
 * Expense Autofill Engine
 * 
 * Automatically fills expense fields based on:
 * - Filename parsing
 * - Supplier history (memory)
 * - Keyword matching
 * - Category/VAT heuristics
 * 
 * ⚠️ HARD RULES:
 * - NEVER auto-set status = "in_order"
 * - NEVER modify payment fields
 * - Only fill fields with high confidence
 * - Backend is single source of truth
 */

import * as db from "../db";
import { getExpenseSuggestions } from "./suggestionEngine";
import { parseReceiptFilename, type ParsedFilename } from "./filenameParser";
import type { InsertExpense, Expense } from "../../drizzle/schema";

/**
 * Context for autofill operation
 */
export type AutofillContext = {
  filename?: string; // Receipt filename (if available)
  userId: number; // User performing the operation
  isFirstReceipt?: boolean; // True if this is the first receipt attached
};

/**
 * Apply autofill to an expense
 * 
 * This function:
 * 1. Parses filename (if provided)
 * 2. Gets suggestions from suggestion engine
 * 3. Applies high-confidence values
 * 4. Updates expense in database
 * 5. NEVER changes status
 * 
 * @param expenseId Expense ID to autofill
 * @param context Autofill context (filename, userId, etc.)
 * @returns Updated expense
 */
export async function applyExpenseAutofill(
  expenseId: number,
  context: AutofillContext
): Promise<Expense | null> {
  // Get current expense
  const expense = await db.getExpenseById(expenseId);
  if (!expense) {
    return null;
  }

  // Only autofill expenses in "needs_review" status
  if (expense.status !== "needs_review") {
    return expense;
  }

  // Parse filename if provided
  let parsedFilename: ParsedFilename = {};
  if (context.filename) {
    parsedFilename = parseReceiptFilename(context.filename);
  }

  // Get suggestions from suggestion engine
  const suggestions = await getExpenseSuggestions(expenseId, context.userId);

  // Build update object (only fields we're confident about)
  const updates: Partial<InsertExpense> = {
    updatedByUserId: context.userId,
  };

  // 1. Supplier name: from filename (if better than current) or keep existing
  if (parsedFilename.supplierName && parsedFilename.supplierName !== "Receipt") {
    // Only update if current supplier is generic or empty
    const currentSupplier = expense.supplierName?.trim().toLowerCase() || "";
    if (
      !currentSupplier ||
      currentSupplier === "receipt" ||
      currentSupplier === "expense" ||
      currentSupplier.length < 3
    ) {
      updates.supplierName = parsedFilename.supplierName;
    }
  }

  // 2. Description: from filename (if not set) or keep existing
  if (parsedFilename.description && !expense.description) {
    updates.description = parsedFilename.description;
  }

  // 3. Expense date: from filename (if valid) or keep existing
  if (parsedFilename.expenseDate) {
    // Only update if current date is today (default) or not set
    const currentDate = new Date(expense.expenseDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    currentDate.setHours(0, 0, 0, 0);
    
    if (currentDate.getTime() === today.getTime()) {
      updates.expenseDate = parsedFilename.expenseDate;
    }
  }

  // 4. Gross amount: ONLY if parsed with absolute certainty (and current is 0)
  if (parsedFilename.grossAmountCents && expense.grossAmountCents === 0) {
    updates.grossAmountCents = parsedFilename.grossAmountCents;
  }

  // 5. Currency: from filename (if EUR) or keep existing
  if (parsedFilename.currency && parsedFilename.currency === "EUR") {
    // Only update if current is EUR (default) or not set
    if (!expense.currency || expense.currency === "EUR") {
      updates.currency = parsedFilename.currency;
    }
  }

  // 6. Category: from suggestions (high confidence only: >= 0.7)
  if (suggestions.category && suggestions.category.confidence >= 0.7 && !expense.category) {
    updates.category = suggestions.category.value as any;
  }

  // 7. VAT mode: from suggestions (high confidence only: >= 0.8)
  if (suggestions.vatMode && suggestions.vatMode.confidence >= 0.8) {
    // Only update if current is "none" (default)
    if (expense.vatMode === "none") {
      updates.vatMode = suggestions.vatMode.value;
      
      // If German VAT, suggest VAT rate based on category
      if (suggestions.vatMode.value === "german" && expense.category) {
        // meals, travel typically 7%, most others 19%
        if (["meals", "travel"].includes(expense.category)) {
          updates.vatRate = "7" as any;
        } else {
          updates.vatRate = "19" as any;
        }
      }
    }
  }

  // 8. Business use %: from suggestions (high confidence only: >= 0.8)
  if (
    suggestions.businessUsePct &&
    suggestions.businessUsePct.confidence >= 0.8 &&
    expense.businessUsePct === 100 // Only if default
  ) {
    updates.businessUsePct = suggestions.businessUsePct.value;
  }

  // Only update if we have changes
  if (Object.keys(updates).length <= 1) {
    // Only updatedByUserId, no actual field changes
    return expense;
  }

  // Apply updates (status remains "needs_review")
  const updated = await db.updateExpense(expenseId, updates, context.userId);

  return updated;
}

