/**
 * Document AI & OCR Pipeline Types
 * 
 * STRICTLY SEPARATE from AI Helper system.
 * This pipeline ONLY extracts structured data from documents.
 */

/**
 * Supported document types for extraction
 */
export type DocumentType = "invoice" | "receipt" | "credit_note" | "unknown";

/**
 * OCR input - file data for processing
 */
export interface OcrInput {
  /** File buffer (PDF or image) */
  fileBuffer: Buffer;
  /** MIME type of the file */
  mimeType: string;
  /** Original filename */
  filename: string;
  /** Optional language hint (e.g., "de", "en") */
  languageHint?: string;
}

/**
 * Raw extraction output from Mistral Document AI
 * Matches the new prompt format with per-field confidence
 */
export interface RawExtractionOutput {
  documentType: DocumentType;
  client: {
    name: string | null;
    confidence: number;
  };
  invoiceNumber: {
    value: string | null;
    confidence: number;
  };
  invoiceDate: {
    value: string | null; // ISO date string (YYYY-MM-DD)
    confidence: number;
  };
  dueDate: {
    value: string | null; // ISO date string (YYYY-MM-DD)
    confidence: number;
  };
  servicePeriod: {
    from: string | null; // ISO date string (YYYY-MM-DD)
    to: string | null; // ISO date string (YYYY-MM-DD)
  };
  total: {
    amount: number | null; // Decimal number (e.g., 1234.56)
    currency: string | null; // ISO currency code (e.g., "EUR")
    confidence: number;
  };
  flags: string[]; // Array of flag strings (e.g., ["missing_client", "low_confidence"])
  
  // Legacy fields for backward compatibility (may be present in old format)
  fields?: {
    invoiceNumber?: string | null;
    issueDate?: string | null;
    dueDate?: string | null;
    servicePeriodStart?: string | null;
    servicePeriodEnd?: string | null;
    clientName?: string | null;
    total?: string | null;
    currency?: string | null;
    [key: string]: any;
  };
  confidence?: {
    overall: number;
    fields: Record<string, number>;
  };
}

/**
 * Normalized extraction result (internal structure)
 */
export interface NormalizedExtractionResult {
  documentType: DocumentType;
  
  // Invoice identification
  invoiceNumber: string | null;
  referenceNumber: string | null;
  
  // Dates (Date objects or null)
  issueDate: Date | null;
  dueDate: Date | null;
  servicePeriodStart: Date | null;
  servicePeriodEnd: Date | null;
  
  // Parties
  clientName: string | null;
  clientAddress: string | null;
  clientVatNumber: string | null;
  supplierName: string | null;
  supplierAddress: string | null;
  supplierVatNumber: string | null;
  
  // Financial (stored as cents/integers)
  subtotalCents: number | null;
  vatAmountCents: number | null;
  totalCents: number | null;
  currency: string; // Default: "EUR"
  
  // VAT/Tax
  vatRate: number | null; // Percentage as number (e.g., 19)
  isKleinunternehmer: boolean | null;
  vatExempt: boolean | null;
  
  // Line items
  items: Array<{
    name: string;
    description: string | null;
    quantity: number; // Decimal
    unitPriceCents: number; // In cents
    lineTotalCents: number; // In cents
  }>;
  
  // Notes
  notes: string | null;
  terms: string | null;
  
  // Confidence metadata
  confidence: {
    overall: number;
    fields: Record<string, number>;
  };
  
  // Flags
  flags: {
    missingFields: string[];
    suspiciousFields: string[];
    requiresReview: boolean;
  };
}

/**
 * Confidence metadata for field-level scoring
 */
export interface ConfidenceMetadata {
  overall: number; // 0-1
  fields: Record<string, {
    score: number; // 0-1
    reason?: string; // Why confidence is low/high
  }>;
  requiresReview: boolean;
}
