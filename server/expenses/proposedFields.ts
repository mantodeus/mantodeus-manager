/**
 * Proposed Fields Generator
 * 
 * Generates proposed field values with confidence scores for review lane.
 * This is PREVIEW-ONLY data - does NOT write to database.
 */

import * as db from "../db";
import { getExpenseSuggestions } from "./suggestionEngine";
import { parseReceiptFilename } from "./filenameParser";
import type { Expense } from "../../drizzle/schema";
import type { ProposedFields, ProposedField } from "./confidence";

/**
 * Get proposed fields for an expense (preview-only)
 *
 * This function:
 * 1. Parses filename (if receipts exist)
 * 2. Gets suggestions from suggestion engine
 * 3. Combines all sources with confidence scores
 * 4. Returns proposed values WITHOUT writing to DB
 *
 * @param expense - The expense to get proposed fields for
 * @param userId - User ID for suggestion context
 * @param preloadedFiles - Optional pre-fetched files (for batch performance)
 */
export async function getProposedFields(
  expense: Expense,
  userId: number,
  preloadedFiles?: Array<any>
): Promise<ProposedFields> {
  const proposed: ProposedFields = {};

  // Get expense files for filename parsing
  // Use preloaded files if provided (batch performance optimization)
  const files = preloadedFiles ?? await db.getExpenseFilesByExpenseId(expense.id);
  const latestFile = files.length > 0 ? files[0] : null;

  // Parse filename if available
  let parsedFilename: ReturnType<typeof parseReceiptFilename> = {};
  if (latestFile) {
    parsedFilename = parseReceiptFilename(latestFile.originalFilename);
  }

  // Get suggestions from suggestion engine
  const suggestions = await getExpenseSuggestions(expense.id, userId);

  // 1. Supplier name: from filename (if better than current)
  if (parsedFilename.supplierName && parsedFilename.supplierName !== "Receipt") {
    const currentSupplier = expense.supplierName?.trim().toLowerCase() || "";
    if (
      !currentSupplier ||
      currentSupplier === "receipt" ||
      currentSupplier === "expense" ||
      currentSupplier.length < 3
    ) {
      proposed.supplierName = {
        value: parsedFilename.supplierName,
        confidence: 0.9, // Filename parsing is high confidence
        reason: "Extracted from receipt filename",
        source: "filename",
      };
    }
  }

  // 2. Description: from filename (if not set)
  if (parsedFilename.description && !expense.description) {
    proposed.description = {
      value: parsedFilename.description,
      confidence: 0.85,
      reason: "Extracted from receipt filename",
      source: "filename",
    };
  }

  // 3. Expense date: from filename (if valid and different from current)
  if (parsedFilename.expenseDate) {
    const currentDate = new Date(expense.expenseDate);
    const parsedDate = new Date(parsedFilename.expenseDate);
    currentDate.setHours(0, 0, 0, 0);
    parsedDate.setHours(0, 0, 0, 0);

    if (currentDate.getTime() !== parsedDate.getTime()) {
      proposed.expenseDate = {
        value: parsedFilename.expenseDate,
        confidence: 0.9,
        reason: "Extracted from receipt filename",
        source: "filename",
      };
    }
  }

  // 4. Gross amount: from filename (if parsed and current is 0)
  if (parsedFilename.grossAmountCents && expense.grossAmountCents === 0) {
    proposed.grossAmountCents = {
      value: parsedFilename.grossAmountCents,
      confidence: 0.95, // High confidence if parsed from filename
      reason: "Extracted from receipt filename",
      source: "filename",
    };
  }

  // 5. Category: from suggestions (if not set)
  if (suggestions.category && !expense.category) {
    proposed.category = {
      value: suggestions.category.value,
      confidence: suggestions.category.confidence,
      reason: suggestions.category.reason,
      source: suggestions.category.reason.includes("supplier") ? "supplier_memory" : "keyword",
    };
  }

  // 6. VAT mode: from suggestions (if current is "none")
  if (suggestions.vatMode && expense.vatMode === "none") {
    proposed.vatMode = {
      value: suggestions.vatMode.value,
      confidence: suggestions.vatMode.confidence,
      reason: suggestions.vatMode.reason,
      source: suggestions.vatMode.reason.includes("supplier") ? "supplier_memory" : "heuristic",
    };
  }

  // 7. Business use %: from suggestions (if current is 100)
  if (suggestions.businessUsePct && expense.businessUsePct === 100) {
    proposed.businessUsePct = {
      value: suggestions.businessUsePct.value,
      confidence: suggestions.businessUsePct.confidence,
      reason: suggestions.businessUsePct.reason,
      source: "supplier_memory",
    };
  }

  return proposed;
}

