/**
 * Confidence Scoring for Document Extraction
 * 
 * Defines thresholds and determines which fields require manual review.
 */

import type { RawExtractionOutput, ConfidenceMetadata } from "./types";

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
 */
export function computeConfidenceMetadata(
  raw: RawExtractionOutput
): ConfidenceMetadata {
  const overall = raw.confidence.overall;
  const fieldScores = raw.confidence.fields;
  
  // Check critical fields
  const criticalFieldsLow = CONFIDENCE_THRESHOLDS.CRITICAL_FIELDS.some(
    (field) => {
      const score = fieldScores[field] ?? 0;
      return score < CONFIDENCE_THRESHOLDS.CRITICAL_FIELD_REVIEW;
    }
  );
  
  // Determine if review is required
  const requiresReview =
    overall < CONFIDENCE_THRESHOLDS.OVERALL_REVIEW ||
    criticalFieldsLow ||
    raw.flags.requiresReview ||
    raw.flags.missingFields.length > 0 ||
    raw.flags.suspiciousFields.length > 0;
  
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
    if (raw.flags.missingFields.includes(field)) {
      reason = "Field not found in document";
    }
    if (raw.flags.suspiciousFields.includes(field)) {
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
