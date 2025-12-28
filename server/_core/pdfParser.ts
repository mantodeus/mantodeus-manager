/**
 * Deterministic PDF Invoice Parser
 * 
 * Extracts invoice data from PDF text using regex and heuristics.
 * NO AI/LLM - purely deterministic parsing.
 */

export interface ParsedInvoiceData {
  clientName: string | null;
  invoiceDate: Date | null;
  totalAmount: string | null;
  invoiceNumber: string | null;
  needsReview: boolean;
}

/**
 * Extract text from PDF buffer
 * pdf-parse is a CommonJS module, use dynamic import to handle it properly in ESM
 */
async function extractPdfText(pdfBuffer: Buffer): Promise<string | null> {
  try {
    // Dynamic import to handle CommonJS module in ESM context
    const pdfParseModule = await import("pdf-parse");
    // pdf-parse exports as default in CommonJS, but may be wrapped differently in ESM
    const pdfParse = (pdfParseModule as any).default || pdfParseModule;
    const data = await pdfParse(pdfBuffer);
    return data.text || null;
  } catch (error) {
    console.error("[PDF Parser] Failed to extract text:", error);
    return null;
  }
}

/**
 * Extract total amount from invoice text
 * Looks for keywords: Total, Gesamt, Summe, Amount Due
 * Matches currency symbols: €, EUR
 * Chooses largest monetary value near total keywords
 */
function extractTotalAmount(text: string): { amount: string | null; confidence: boolean } {
  // Normalize text
  const normalized = text.replace(/\s+/g, " ").toLowerCase();
  
  // Keywords that indicate total amount
  const totalKeywords = [
    "total",
    "gesamt",
    "summe",
    "amount due",
    "zu zahlender betrag",
    "endbetrag",
    "rechnungsbetrag",
  ];
  
  // Find lines containing total keywords
  const lines = text.split(/\n/);
  const totalLines: Array<{ line: string; index: number }> = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (totalKeywords.some((keyword) => line.includes(keyword))) {
      totalLines.push({ line: lines[i], index: i });
    }
  }
  
  if (totalLines.length === 0) {
    return { amount: null, confidence: false };
  }
  
  // Extract monetary values from total lines and nearby lines
  const monetaryValues: Array<{ value: number; line: string }> = [];
  
  for (const { line, index } of totalLines) {
    // Look in the same line and next 2 lines
    for (let offset = 0; offset <= 2; offset++) {
      const searchLine = lines[index + offset] || "";
      // Match currency patterns: €123.45, 123,45 €, EUR 123.45, 123.45 EUR
      const currencyPatterns = [
        /[€€]\s*([\d.,]+)/g, // €123.45 or € 123.45
        /([\d.,]+)\s*[€€]/g, // 123.45 €
        /EUR\s*([\d.,]+)/gi, // EUR 123.45
        /([\d.,]+)\s*EUR/gi, // 123.45 EUR
        /([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/g, // Standalone numbers with thousands separators
      ];
      
      for (const pattern of currencyPatterns) {
        const matches = searchLine.matchAll(pattern);
        for (const match of matches) {
          const valueStr = match[1] || match[0];
          // Normalize: replace comma with dot, remove spaces
          const normalized = valueStr.replace(/,/g, ".").replace(/\s/g, "");
          const value = parseFloat(normalized);
          if (!isNaN(value) && value > 0) {
            monetaryValues.push({ value, line: searchLine });
          }
        }
      }
    }
  }
  
  if (monetaryValues.length === 0) {
    return { amount: null, confidence: false };
  }
  
  // If multiple values found, choose the largest (most likely to be total)
  const largest = monetaryValues.reduce((max, curr) => 
    curr.value > max.value ? curr : max
  );
  
  // Format as string with 2 decimal places
  const amount = largest.value.toFixed(2);
  
  // Low confidence if multiple totals detected or value seems too small
  const confidence = monetaryValues.length <= 2 && largest.value >= 1;
  
  return { amount, confidence };
}

/**
 * Extract invoice date from text
 * Supported formats: DD.MM.YYYY, YYYY-MM-DD, DD/MM/YYYY
 * Prefers dates near keywords: Invoice Date, Rechnungsdatum, Datum
 */
function extractInvoiceDate(text: string): { date: Date | null; confidence: boolean } {
  const dateKeywords = [
    "invoice date",
    "rechnungsdatum",
    "datum",
    "date",
    "rechnungsdatum:",
    "datum:",
    "invoice date:",
  ];
  
  const lines = text.split(/\n/);
  const dateLines: Array<{ line: string; index: number }> = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (dateKeywords.some((keyword) => line.includes(keyword))) {
      dateLines.push({ line: lines[i], index: i });
    }
  }
  
  // Date patterns
  const datePatterns = [
    /(\d{2})\.(\d{2})\.(\d{4})/, // DD.MM.YYYY
    /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
    /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
  ];
  
  // First, try to find dates near date keywords
  for (const { line, index } of dateLines) {
    for (let offset = 0; offset <= 2; offset++) {
      const searchLine = lines[index + offset] || "";
      for (const pattern of datePatterns) {
        const match = searchLine.match(pattern);
        if (match) {
          let day: number, month: number, year: number;
          if (pattern.source.includes("YYYY")) {
            // YYYY-MM-DD format
            year = parseInt(match[1], 10);
            month = parseInt(match[2], 10);
            day = parseInt(match[3], 10);
          } else {
            // DD.MM.YYYY or DD/MM/YYYY
            day = parseInt(match[1], 10);
            month = parseInt(match[2], 10);
            year = parseInt(match[3], 10);
          }
          
          // Validate date
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
            const date = new Date(year, month - 1, day);
            if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
              return { date, confidence: true };
            }
          }
        }
      }
    }
  }
  
  // Fallback: search entire text for dates
  for (const pattern of datePatterns) {
    const matches = text.matchAll(new RegExp(pattern.source, "g"));
    for (const match of matches) {
      let day: number, month: number, year: number;
      if (pattern.source.includes("YYYY")) {
        year = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        day = parseInt(match[3], 10);
      } else {
        day = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        year = parseInt(match[3], 10);
      }
      
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
          // Lower confidence for dates not near keywords
          return { date, confidence: false };
        }
      }
    }
  }
  
  return { date: null, confidence: false };
}

/**
 * Extract client name from text
 * Heuristic: Top section of document, lines without numbers, longer text lines
 * Never guess VAT IDs or addresses as client name
 */
function extractClientName(text: string): { name: string | null; confidence: boolean } {
  const lines = text.split(/\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  
  // Take first 20 lines (top section)
  const topSection = lines.slice(0, 20);
  
  // Filter out lines that look like:
  // - VAT IDs (DE123456789, USt-IdNr, etc.)
  // - Addresses (contain numbers, postal codes)
  // - Dates
  // - Invoice numbers
  // - Too short (< 3 chars)
  // - Too long (> 100 chars, likely addresses)
  // - Contain only numbers/symbols
  
  const excludePatterns = [
    /^\d+$/, // Only numbers
    /^[A-Z]{2}\d+/, // VAT ID patterns
    /ust-?id/i, // VAT ID keywords
    /steuernummer/i, // Tax number
    /\d{5}/, // Postal codes (5 digits)
    /\d{2}\.\d{2}\.\d{4}/, // Dates
    /rechnung/i, // Invoice keywords
    /invoice/i,
    /^\d+[-/]\d+/, // Invoice number patterns
  ];
  
  const candidateLines = topSection.filter((line) => {
    // Must be reasonable length
    if (line.length < 3 || line.length > 100) return false;
    
    // Must not match exclude patterns
    if (excludePatterns.some((pattern) => pattern.test(line))) return false;
    
    // Must contain at least one letter
    if (!/[a-zA-Z]/.test(line)) return false;
    
    // Prefer lines with fewer numbers (but allow some)
    const numberCount = (line.match(/\d/g) || []).length;
    if (numberCount > line.length * 0.3) return false; // More than 30% numbers
    
    return true;
  });
  
  if (candidateLines.length === 0) {
    return { name: null, confidence: false };
  }
  
  // Choose the longest line that's not too long (likely company name)
  const sorted = candidateLines.sort((a, b) => b.length - a.length);
  const bestCandidate = sorted[0];
  
  // Confidence: high if line is 10-80 chars and in first 5 lines
  const index = topSection.indexOf(bestCandidate);
  const confidence = bestCandidate.length >= 10 && bestCandidate.length <= 80 && index < 5;
  
  return { name: bestCandidate, confidence };
}

/**
 * Extract invoice number from text
 * Looks for patterns like: RE-2024-001, 2024-001, INV-001, etc.
 */
function extractInvoiceNumber(text: string): string | null {
  const invoicePatterns = [
    /(?:rechnung|invoice|re|inv)[\s:]*([A-Z0-9\-]+)/i,
    /([A-Z]{2,4}[-/]\d{4}[-/]\d+)/i, // RE-2024-001
    /(\d{4}[-/]\d+)/, // 2024-001
  ];
  
  for (const pattern of invoicePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }
  
  return null;
}

/**
 * Parse PDF invoice and extract data
 */
export async function parseInvoicePdf(pdfBuffer: Buffer): Promise<ParsedInvoiceData> {
  const text = await extractPdfText(pdfBuffer);
  
  // If no text layer, mark for review
  if (!text || text.trim().length === 0) {
    return {
      clientName: null,
      invoiceDate: null,
      totalAmount: null,
      invoiceNumber: null,
      needsReview: true,
    };
  }
  
  // Extract fields
  const totalResult = extractTotalAmount(text);
  const dateResult = extractInvoiceDate(text);
  const clientResult = extractClientName(text);
  const invoiceNumber = extractInvoiceNumber(text);
  
  // Determine if review is needed
  const needsReview =
    !totalResult.amount ||
    !totalResult.confidence ||
    !dateResult.date ||
    !dateResult.confidence ||
    !clientResult.name ||
    !clientResult.confidence ||
    totalResult.amount === "0.00";
  
  return {
    clientName: clientResult.name,
    invoiceDate: dateResult.date,
    totalAmount: totalResult.amount,
    invoiceNumber,
    needsReview,
  };
}

