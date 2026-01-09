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
 */
export interface RawExtractionOutput {
  documentType: DocumentType;
  fields: {
    // Invoice identification
    invoiceNumber?: string | null;
    referenceNumber?: string | null;
    
    // Dates
    issueDate?: string | null; // ISO date string
    dueDate?: string | null; // ISO date string
    servicePeriodStart?: string | null; // ISO date string
    servicePeriodEnd?: string | null; // ISO date string
    
    // Parties
    clientName?: string | null;
    clientAddress?: string | null;
    clientVatNumber?: string | null;
    supplierName?: string | null;
    supplierAddress?: string | null;
    supplierVatNumber?: string | null;
    
    // Financial
    subtotal?: string | null; // Decimal string (e.g., "1234.56")
    vatAmount?: string | null; // Decimal string
    total?: string | null; // Decimal string
    currency?: string | null; // ISO currency code (e.g., "EUR")
    
    // VAT/Tax indicators
    vatRate?: string | null; // Percentage string (e.g., "19")
    isKleinunternehmer?: boolean | null; // §19 UStG indicator
    vatExempt?: boolean | null;
    
    // Line items
    items?: Array<{
      name?: string | null;
      description?: string | null;
      quantity?: string | null;
      unitPrice?: string | null;
      lineTotal?: string | null;
    }> | null;
    
    // Notes
    notes?: string | null;
    terms?: string | null;
  };
  confidence: {
    overall: number; // 0-1
    fields: Record<string, number>; // Field-level confidence scores
  };
  flags: {
    missingFields: string[]; // List of expected fields that are missing
    suspiciousFields: string[]; // Fields that may be incorrect
    requiresReview: boolean;
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
