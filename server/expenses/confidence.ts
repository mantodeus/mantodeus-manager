/**
 * Confidence Scoring System for Expense Review Lane
 * 
 * Deterministic confidence scoring (0.0-1.0) for proposed expense fields.
 * Used for review lane UI to show users what can be auto-applied.
 */

export type ConfidenceLevel = "high" | "medium" | "low";

export type ProposedField<T = any> = {
  value: T;
  confidence: number; // 0.0-1.0
  reason: string;
  source: "filename" | "supplier_memory" | "keyword" | "heuristic" | "default";
};

export type ProposedFields = {
  supplierName?: ProposedField<string>;
  description?: ProposedField<string>;
  expenseDate?: ProposedField<Date>;
  grossAmountCents?: ProposedField<number>;
  category?: ProposedField<string>;
  vatMode?: ProposedField<"none" | "german" | "foreign">;
  businessUsePct?: ProposedField<number>;
};

/**
 * Get confidence level label from score
 */
export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.85) return "high";
  if (score >= 0.70) return "medium";
  return "low";
}

/**
 * Get confidence label for UI
 */
export function getConfidenceLabel(score: number): string {
  const level = getConfidenceLevel(score);
  switch (level) {
    case "high":
      return "High";
    case "medium":
      return "Med";
    case "low":
      return "Low";
  }
}

/**
 * Calculate overall review score for an expense
 * 
 * Rules:
 * - Start at 100
 * - -30 missing category
 * - -30 missing amount or amount <= 0
 * - -20 missing supplier
 * - -10 missing date
 * - -10 if any applied field confidence < 0.70
 * - Clamp 0-100
 */
export function calculateOverallScore(
  expense: {
    category: string | null;
    grossAmountCents: number;
    supplierName: string;
    expenseDate: Date | string;
  },
  proposedFields: ProposedFields
): number {
  let score = 100;

  // Missing required fields
  if (!expense.category) {
    score -= 30;
  }

  if (!expense.grossAmountCents || expense.grossAmountCents <= 0) {
    score -= 30;
  }

  if (!expense.supplierName || expense.supplierName.trim().length === 0) {
    score -= 20;
  }

  if (!expense.expenseDate) {
    score -= 10;
  }

  // Low confidence penalty (only for fields that differ from current)
  const fields = [
    proposedFields.category,
    proposedFields.grossAmountCents,
    proposedFields.supplierName,
    proposedFields.vatMode,
    proposedFields.businessUsePct,
  ];

  for (const field of fields) {
    if (field && field.confidence < 0.70) {
      score -= 10;
      break; // Only penalize once
    }
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Get review score badge label
 */
export function getReviewScoreLabel(score: number): string {
  if (score >= 85) return "Quick approve";
  if (score >= 60) return "Check";
  return "Needs attention";
}

/**
 * Get missing required fields list
 */
export function getMissingRequiredFields(expense: {
  category: string | null;
  grossAmountCents: number;
  supplierName: string;
  expenseDate: Date | string;
}): string[] {
  const missing: string[] = [];

  if (!expense.category) {
    missing.push("Category");
  }

  if (!expense.grossAmountCents || expense.grossAmountCents <= 0) {
    missing.push("Amount");
  }

  if (!expense.supplierName || expense.supplierName.trim().length === 0) {
    missing.push("Supplier");
  }

  if (!expense.expenseDate) {
    missing.push("Date");
  }

  return missing;
}

