/**
 * Expense Suggestion Engine
 * 
 * Pure, stateless suggestion engine that proposes (but never applies):
 * - Category
 * - VAT mode
 * - Business use %
 * 
 * All suggestions are:
 * - Explainable (reason field)
 * - Confidence-scored (0.0-1.0)
 * - User-confirmable (never auto-applied)
 * 
 * ⚠️ This module MUST NOT:
 * - Write to DB
 * - Modify expenses
 * - Change status
 * - Affect audit fields
 */

import * as db from "../db";
import type { Expense, ExpenseFile } from "../../drizzle/schema";

// =============================================================================
// TYPES
// =============================================================================

export type CategorySuggestion = {
  value: string;
  confidence: number; // 0.0-1.0
  reason: string;
};

export type VatModeSuggestion = {
  value: "none" | "german" | "foreign";
  confidence: number;
  reason: string;
};

export type BusinessUsePctSuggestion = {
  value: number;
  confidence: number;
  reason: string;
};

export type ExpenseSuggestions = {
  category?: CategorySuggestion;
  vatMode?: VatModeSuggestion;
  businessUsePct?: BusinessUsePctSuggestion;
};

// =============================================================================
// KEYWORD DICTIONARY
// =============================================================================

const KEYWORD_CATEGORY_MAP: Record<string, string> = {
  amazon: "equipment",
  ikea: "office_supplies",
  hotel: "travel",
  taxi: "travel",
  uber: "travel",
  restaurant: "meals",
  cafe: "meals",
  adobe: "software",
  figma: "software",
  dhl: "shipping",
  post: "shipping",
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Normalize supplier name for matching
 * - Lowercase
 * - Remove punctuation
 * - Strip common suffixes (gmbh, ug, kg, ag, ltd, inc, llc)
 * - Trim whitespace
 */
function normalizeSupplierName(name: string): string {
  let normalized = name.trim().toLowerCase();
  
  // Remove punctuation (keep spaces)
  normalized = normalized.replace(/[^\w\s]/g, "");
  
  // Strip common suffixes
  const suffixes = [
    /\bgmbh\b/gi,
    /\bug\b/gi,
    /\bkg\b/gi,
    /\bag\b/gi,
    /\bltd\b/gi,
    /\binc\b/gi,
    /\bllc\b/gi,
    /\bco\b/gi,
    /\bcorp\b/gi,
    /\bcorporation\b/gi,
    /\bcompany\b/gi,
  ];
  
  for (const suffix of suffixes) {
    normalized = normalized.replace(suffix, "");
  }
  
  // Clean up multiple spaces
  normalized = normalized.replace(/\s+/g, " ").trim();
  
  return normalized;
}

/**
 * Extract keywords from text (case-insensitive)
 */
function extractKeywords(text: string): string[] {
  const normalized = text.toLowerCase();
  const keywords: string[] = [];
  
  for (const keyword of Object.keys(KEYWORD_CATEGORY_MAP)) {
    if (normalized.includes(keyword)) {
      keywords.push(keyword);
    }
  }
  
  return keywords;
}

/**
 * Get supplier history (last 5 expenses with same supplier)
 * Performance: Uses database-level filtering instead of fetching all expenses
 */
async function getSupplierHistory(
  userId: number,
  supplierName: string
): Promise<Expense[]> {
  // Use database-level filtering for performance (prevents N+1 query issue)
  const normalized = normalizeSupplierName(supplierName);
  return await db.listSupplierHistory(userId, normalized, 5);
}

/**
 * Get expense files for keyword matching
 */
async function getExpenseFiles(expenseId: number): Promise<ExpenseFile[]> {
  return await db.getExpenseFilesByExpenseId(expenseId);
}

// =============================================================================
// SUGGESTION RULES
// =============================================================================

/**
 * Rule A: Supplier Memory (highest priority)
 * Query last 5 expenses for same supplier and suggest last used values
 */
async function suggestFromSupplierHistory(
  userId: number,
  supplierName: string
): Promise<Partial<ExpenseSuggestions>> {
  const history = await getSupplierHistory(userId, supplierName);
  
  if (history.length === 0) {
    return {};
  }
  
  // Use the most recent expense's values
  const latest = history[0];
  
  // Calculate confidence: base 0.8 + 0.05 per matching record (max 0.95)
  const confidence = Math.min(0.8 + history.length * 0.05, 0.95);
  
  const suggestions: Partial<ExpenseSuggestions> = {};
  
  if (latest.category) {
    suggestions.category = {
      value: latest.category,
      confidence,
      reason: `Previously used for this supplier (${history.length} ${history.length === 1 ? "expense" : "expenses"})`,
    };
  }
  
  if (latest.vatMode) {
    suggestions.vatMode = {
      value: latest.vatMode,
      confidence,
      reason: `Previously used for this supplier (${history.length} ${history.length === 1 ? "expense" : "expenses"})`,
    };
  }
  
  if (latest.businessUsePct !== null && latest.businessUsePct !== undefined) {
    suggestions.businessUsePct = {
      value: latest.businessUsePct,
      confidence,
      reason: `Previously used for this supplier (${history.length} ${history.length === 1 ? "expense" : "expenses"})`,
    };
  }
  
  return suggestions;
}

/**
 * Rule B: Filename / Supplier Keyword Matching
 */
function suggestFromKeywords(
  supplierName: string,
  filenames: string[]
): Partial<ExpenseSuggestions> {
  const allText = [supplierName, ...filenames].join(" ");
  const keywords = extractKeywords(allText);
  
  if (keywords.length === 0) {
    return {};
  }
  
  // Get unique categories from matched keywords
  const categories = new Set(
    keywords.map((kw) => KEYWORD_CATEGORY_MAP[kw])
  );
  
  if (categories.size === 0) {
    return {};
  }
  
  // Use first category (or could use most common)
  const category = Array.from(categories)[0];
  
  // Confidence: single keyword 0.6, multiple 0.7
  const confidence = keywords.length === 1 ? 0.6 : 0.7;
  const keywordList = keywords.join("', '");
  
  return {
    category: {
      value: category,
      confidence,
      reason: `Matched keyword${keywords.length > 1 ? "s" : ""} '${keywordList}'`,
    },
  };
}

/**
 * Rule C: Category → VAT Heuristic
 * Only suggest if currency === 'EUR'
 */
function suggestVatFromCategory(
  category: string | null | undefined,
  currency: string
): Partial<ExpenseSuggestions> {
  if (currency !== "EUR") {
    return {}; // Currency guard handled separately
  }
  
  if (!category) {
    return {};
  }
  
  // meals, travel, rent → suggest vatMode = german
  if (["meals", "travel", "rent"].includes(category)) {
    return {
      vatMode: {
        value: "german",
        confidence: 0.6,
        reason: `Category '${category}' typically uses German VAT`,
      },
    };
  }
  
  // software + non-EU vendor keyword → foreign (handled in keyword matching)
  // This is a fallback for software category
  if (category === "software") {
    // Could check for non-EU vendor keywords, but for now return nothing
    // as this is better handled by keyword matching
    return {};
  }
  
  return {};
}

/**
 * Rule D: Currency Guard (absolute, highest priority for VAT)
 * If currency !== 'EUR', suggest vatMode = foreign
 */
function suggestVatFromCurrency(currency: string): Partial<ExpenseSuggestions> {
  if (currency === "EUR") {
    return {};
  }
  
  return {
    vatMode: {
      value: "foreign",
      confidence: 1.0,
      reason: "Non-EUR currency",
    },
  };
}

// =============================================================================
// MAIN SUGGESTION ENGINE
// =============================================================================

/**
 * Get expense suggestions
 * 
 * Pure function that computes suggestions based on:
 * - Supplier history
 * - Keyword matching
 * - Category heuristics
 * - Currency rules
 * 
 * ⚠️ This function MUST NOT:
 * - Write to DB
 * - Modify expense
 * - Change status
 * - Affect audit fields
 */
export async function getExpenseSuggestions(
  expenseId: number,
  userId: number
): Promise<ExpenseSuggestions> {
  // Get expense data
  const expense = await db.getExpenseById(expenseId);
  if (!expense) {
    return {};
  }
  
  // Get expense files for keyword matching
  const files = await getExpenseFiles(expenseId);
  const filenames = files.map((f) => f.originalFilename);
  
  // Collect suggestions from all rules
  const allSuggestions: Array<Partial<ExpenseSuggestions>> = [];
  
  // Rule A: Supplier Memory (highest priority for category/vatMode/businessUsePct)
  const supplierHistorySuggestions = await suggestFromSupplierHistory(
    userId,
    expense.supplierName
  );
  allSuggestions.push(supplierHistorySuggestions);
  
  // Rule B: Keyword Matching (for category)
  const keywordSuggestions = suggestFromKeywords(
    expense.supplierName,
    filenames
  );
  allSuggestions.push(keywordSuggestions);
  
  // Rule C: Category → VAT Heuristic (only if EUR)
  // Use suggested category if available, otherwise use existing
  const categoryForVat =
    supplierHistorySuggestions.category?.value ||
    keywordSuggestions.category?.value ||
    expense.category;
  const categoryVatSuggestions = suggestVatFromCategory(
    categoryForVat,
    expense.currency
  );
  allSuggestions.push(categoryVatSuggestions);
  
  // Rule D: Currency Guard (absolute, overrides other VAT suggestions)
  const currencySuggestions = suggestVatFromCurrency(expense.currency);
  allSuggestions.push(currencySuggestions);
  
  // Resolve conflicts: choose highest confidence for each field
  const resolved: ExpenseSuggestions = {};
  
  // Resolve category
  const categoryCandidates = allSuggestions
    .map((s) => s.category)
    .filter((c): c is CategorySuggestion => c !== undefined);
  if (categoryCandidates.length > 0) {
    resolved.category = categoryCandidates.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );
  }
  
  // Resolve VAT mode (currency guard has highest priority)
  const vatCandidates = allSuggestions
    .map((s) => s.vatMode)
    .filter((v): v is VatModeSuggestion => v !== undefined);
  if (vatCandidates.length > 0) {
    resolved.vatMode = vatCandidates.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );
  }
  
  // Resolve business use %
  const businessUseCandidates = allSuggestions
    .map((s) => s.businessUsePct)
    .filter((b): b is BusinessUsePctSuggestion => b !== undefined);
  if (businessUseCandidates.length > 0) {
    resolved.businessUsePct = businessUseCandidates.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );
  }
  
  return resolved;
}

