/**
 * Client-side confidence utilities
 * Mirrors server-side confidence.ts types and helpers
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

export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.85) return "high";
  if (score >= 0.70) return "medium";
  return "low";
}

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

export function getReviewScoreLabel(score: number): string {
  if (score >= 85) return "Quick approve";
  if (score >= 60) return "Check";
  return "Needs attention";
}

