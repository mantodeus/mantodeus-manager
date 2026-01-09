/**
 * Confidence Scoring for Document Extraction
 * 
 * Defines thresholds and determines which fields require manual review.
 */

import type { RawExtractionOutput, ConfidenceMetadata, NormalizedExtractionResult } from "./types";

/**
 * Confidence thresholds
 */
export const CONFIDENCE_THRESHOLDS = {
  /** Overall confidence below this requires review */
  OVERALL_REVIEW: 0.7,
  /** Field confidence below this is flagged */
  FIELD_REVIEW: 0.6,
  /** Critical fields that must have high confidence */
  CRITICAL_FIELDS: ["invoiceNumber", "issueDate", "total", "clientName"] as const,
  /** Critical field confidence threshold */
  CRITICAL_FIELD_REVIEW: 0.8,
} as const;

/**
 * Compute confidence metadata from raw extraction
 * Handles both new format (with per-field confidence) and legacy format
 */
export function computeConfidenceMetadata(
  raw: RawExtractionOutput | NormalizedExtractionResult
): ConfidenceMetadata {
  // Handle normalized format (already processed)
  if ("confidence" in raw && typeof raw.confidence === "object" && "overall" in raw.confidence) {
    const normalized = raw as NormalizedExtractionResult;
    const overall = normalized.confidence.overall;
    const fieldScores = normalized.confidence.fields;
    
    // Build field-level confidence with reasons
    const fields: ConfidenceMetadata["fields"] = {};
    for (const [field, score] of Object.entries(fieldScores)) {
      const isCritical = CONFIDENCE_THRESHOLDS.CRITICAL_FIELDS.includes(
        field as typeof CONFIDENCE_THRESHOLDS.CRITICAL_FIELDS[number]
      );
      const threshold = isCritical
        ? CONFIDENCE_THRESHOLDS.CRITICAL_FIELD_REVIEW
        : CONFIDENCE_THRESHOLDS.FIELD_REVIEW;
      
      let reason: string | undefined;
      if (score < threshold) {
        reason = isCritical
          ? "Critical field with low confidence"
          : "Low confidence - may require manual verification";
      }
      if (normalized.flags.missingFields.includes(field)) {
        reason = "Field not found in document";
      }
      if (normalized.flags.suspiciousFields.includes(field)) {
        reason = "Field value may be incorrect";
      }
      
      fields[field] = {
        score,
        reason,
      };
    }
    
    return {
      overall,
      fields,
      requiresReview: normalized.flags.requiresReview,
    };
  }
  
  // Handle raw format (legacy or new)
  const rawOutput = raw as RawExtractionOutput;
  const isNewFormat = "client" in rawOutput && typeof rawOutput.client === "object";
  
  let overall: number;
  const fieldScores: Record<string, number> = {};
  
  if (isNewFormat) {
    // New format - extract confidence from per-field objects
    if (rawOutput.client) fieldScores.clientName = rawOutput.client.confidence;
    if (rawOutput.invoiceNumber) fieldScores.invoiceNumber = rawOutput.invoiceNumber.confidence;
    if (rawOutput.invoiceDate) fieldScores.issueDate = rawOutput.invoiceDate.confidence;
    if (rawOutput.dueDate) fieldScores.dueDate = rawOutput.dueDate.confidence;
    if (rawOutput.total) fieldScores.total = rawOutput.total.confidence;
    
    const scores = Object.values(fieldScores);
    overall = scores.length > 0 ? scores.reduce((sum, val) => sum + val, 0) / scores.length : 0.5;
  } else {
    // Legacy format
    overall = rawOutput.confidence?.overall ?? 0.5;
    if (rawOutput.confidence?.fields) {
      Object.assign(fieldScores, rawOutput.confidence.fields);
    }
  }
  
    // Check critical fields
    const criticalFieldsLow = CONFIDENCE_THRESHOLDS.CRITICAL_FIELDS.some(
      (field) => {
        const score = fieldScores[field] ?? 0;
        return score < CONFIDENCE_THRESHOLDS.CRITICAL_FIELD_REVIEW;
      }
    );
    
    // Get flags
    const flags = isNewFormat 
      ? (rawOutput.flags && Array.isArray(rawOutput.flags) ? rawOutput.flags : [])
      : (rawOutput.flags && typeof rawOutput.flags === "object" 
          ? {
              missingFields: rawOutput.flags.missingFields || [],
              suspiciousFields: rawOutput.flags.suspiciousFields || [],
              requiresReview: rawOutput.flags.requiresReview || false,
            }
          : { missingFields: [], suspiciousFields: [], requiresReview: false });
    
    // Determine if review is required
    const requiresReview =
      overall < CONFIDENCE_THRESHOLDS.OVERALL_REVIEW ||
      criticalFieldsLow ||
      (typeof flags === "object" && "requiresReview" in flags && flags.requiresReview) ||
      (typeof flags === "object" && "missingFields" in flags && flags.missingFields.length > 0) ||
      (typeof flags === "object" && "suspiciousFields" in flags && flags.suspiciousFields.length > 0);
    
    // Build field-level confidence with reasons
    const fields: ConfidenceMetadata["fields"] = {};
    for (const [field, score] of Object.entries(fieldScores)) {
      const isCritical = CONFIDENCE_THRESHOLDS.CRITICAL_FIELDS.includes(
        field as typeof CONFIDENCE_THRESHOLDS.CRITICAL_FIELDS[number]
      );
      const threshold = isCritical
        ? CONFIDENCE_THRESHOLDS.CRITICAL_FIELD_REVIEW
        : CONFIDENCE_THRESHOLDS.FIELD_REVIEW;
      
      let reason: string | undefined;
      if (score < threshold) {
        reason = isCritical
          ? "Critical field with low confidence"
          : "Low confidence - may require manual verification";
      }
      if (typeof flags === "object" && "missingFields" in flags && flags.missingFields.includes(field)) {
        reason = "Field not found in document";
      }
      if (typeof flags === "object" && "suspiciousFields" in flags && flags.suspiciousFields.includes(field)) {
        reason = "Field value may be incorrect";
      }
      
      fields[field] = {
        score,
        reason,
      };
    }
    
    return {
      overall,
      fields,
      requiresReview,
    };
  }

/**
 * Get list of fields that require manual review
 */
export function getFieldsRequiringReview(
  metadata: ConfidenceMetadata
): string[] {
  const fields: string[] = [];
  
  for (const [field, data] of Object.entries(metadata.fields)) {
    if (data.reason) {
      fields.push(field);
    }
  }
  
  return fields;
}
