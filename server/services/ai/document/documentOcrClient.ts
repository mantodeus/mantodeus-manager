/**
 * Document OCR Client
 * 
 * Calls Mistral Document AI & OCR API for document processing.
 * STRICTLY SEPARATE from AI Helper system.
 * 
 * Uses Mistral's OCR endpoint (/v1/ocr), NOT chat completions.
 * This is a different API with different request/response format.
 */

import { ENV } from "../../../_core/env";
import type { OcrInput, RawExtractionOutput } from "./types";
import { DOCUMENT_PROMPT_V1 } from "./documentPrompt_v1";

const MISTRAL_OCR_API_URL = "https://api.mistral.ai/v1/ocr";
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds for document processing

export class DocumentOcrError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly providerError?: unknown
  ) {
    super(message);
    this.name = "DocumentOcrError";
  }
}

/**
 * Convert file buffer to Blob for FormData (Node.js 18+)
 * Falls back to Buffer if Blob is not available
 */
function bufferToBlob(buffer: Buffer, mimeType: string): Blob | Buffer {
  if (typeof Blob !== "undefined") {
    return new Blob([buffer], { type: mimeType });
  }
  // Fallback for older Node.js versions
  return buffer;
}

/**
 * Process document using Mistral Document AI
 * 
 * Uses Mistral's vision models to extract structured data from PDFs/images.
 */
export async function processDocumentOcr(
  input: OcrInput
): Promise<RawExtractionOutput> {
  const apiKey = ENV.mistralApiKey;
  if (!apiKey) {
    console.error("[Mistral OCR] MISTRAL_API_KEY not configured");
    throw new DocumentOcrError("MISTRAL_API_KEY not configured");
  }

  // Use Mistral OCR model for document processing
  // Official model name from Mistral pricing page: mistral-ocr-latest
  const model = "mistral-ocr-latest";

  console.log("[Mistral OCR] Starting document processing:", {
    filename: input.filename,
    mimeType: input.mimeType,
    fileSize: input.fileBuffer.length,
    apiKeyPresent: apiKey ? `${apiKey.substring(0, 8)}...` : "missing",
    model,
    endpoint: MISTRAL_OCR_API_URL,
  });

  const timeoutMs = DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Build FormData for multipart/form-data request
    // OCR endpoint uses FormData, NOT JSON with messages
    const { default: FormData } = await import("form-data");
    const form = new FormData();
    
    // Append file
    form.append("file", input.fileBuffer, {
      filename: input.filename,
      contentType: input.mimeType,
    });
    
    // Append model
    form.append("model", model);
    
    // Append structured extraction prompt (optional but recommended)
    // This tells the OCR API what structure to extract
    form.append("prompt", DOCUMENT_PROMPT_V1);

    console.log("[Mistral OCR] Making API request to:", MISTRAL_OCR_API_URL);
    console.log("[Mistral OCR] Request details:", {
      model,
      filename: input.filename,
      mimeType: input.mimeType,
      fileSize: input.fileBuffer.length,
      hasPrompt: !!DOCUMENT_PROMPT_V1,
    });

    const requestStartTime = Date.now();
    
    // Get headers from form-data (includes Content-Type with boundary)
    const formHeaders = form.getHeaders();
    
    const response = await fetch(MISTRAL_OCR_API_URL, {
      method: "POST",
      headers: {
        ...formHeaders, // This sets Content-Type: multipart/form-data with boundary
        Authorization: `Bearer ${apiKey}`,
      },
      body: form as any, // form-data package returns a stream that fetch accepts
      signal: controller.signal,
    });

    const requestDuration = Date.now() - requestStartTime;
    console.log("[Mistral OCR] API response received:", {
      status: response.status,
      statusText: response.statusText,
      durationMs: requestDuration,
      headers: Object.fromEntries(response.headers.entries()),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[Mistral OCR] API error response:", {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorBody, // Full error body
      });
      let errorMessage = `Mistral Document AI error: ${response.status} ${response.statusText}`;
      let parsedError: any = null;
      try {
        parsedError = JSON.parse(errorBody);
        errorMessage = parsedError.error?.message || parsedError.message || errorMessage;
        console.error("[Mistral OCR] Parsed error:", JSON.stringify(parsedError, null, 2));
        
        // Log specific error details if available
        if (parsedError.error) {
          console.error("[Mistral OCR] Error details:", {
            type: parsedError.error.type,
            code: parsedError.error.code,
            message: parsedError.error.message,
            param: parsedError.error.param,
          });
        }
      } catch {
        // Use default error message
        console.error("[Mistral OCR] Could not parse error body as JSON");
      }
      
      throw new DocumentOcrError(
        errorMessage,
        response.status,
        errorBody
      );
    }

    // OCR endpoint returns JSON directly (not chat completions format)
    const data = await response.json();
    console.log("[Mistral OCR] Response data structure:", {
      dataKeys: Object.keys(data),
      hasText: !!data.text,
      hasStructured: !!data.structured,
      hasJson: !!data.json,
    });

    // The OCR endpoint may return data in different formats
    // Try to extract structured JSON from various possible response formats
    let parsed: RawExtractionOutput;
    
    // Format 1: Direct JSON in response
    if (data.json && typeof data.json === "object") {
      parsed = data.json as RawExtractionOutput;
      console.log("[Mistral OCR] Using direct JSON from response");
    }
    // Format 2: Structured field
    else if (data.structured && typeof data.structured === "object") {
      parsed = data.structured as RawExtractionOutput;
      console.log("[Mistral OCR] Using structured field from response");
    }
    // Format 3: Text field that needs parsing
    else if (data.text && typeof data.text === "string") {
      let jsonStr = data.text.trim();
      const originalJsonStr = jsonStr;
      
      // Remove markdown code blocks if present
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.slice(7);
      }
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith("```")) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      console.log("[Mistral OCR] Parsing JSON from text field, length:", jsonStr.length);
      
      try {
        parsed = JSON.parse(jsonStr);
        console.log("[Mistral OCR] JSON parsed successfully from text field");
      } catch (parseError) {
        console.error("[Mistral OCR] JSON parse error:", {
          error: parseError instanceof Error ? parseError.message : "Unknown error",
          jsonPreview: jsonStr.substring(0, 500),
          originalPreview: originalJsonStr.substring(0, 500),
        });
        throw new DocumentOcrError(
          `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
          response.status,
          data.text
        );
      }
    }
    // Format 4: Response is the JSON object itself
    else if (data.documentType || data.fields || data.client) {
      parsed = data as RawExtractionOutput;
      console.log("[Mistral OCR] Using response as direct extraction output");
    }
    else {
      console.error("[Mistral OCR] Unknown response format:", {
        dataKeys: Object.keys(data),
        dataPreview: JSON.stringify(data).substring(0, 500),
      });
      throw new DocumentOcrError(
        "Unknown response format from Mistral OCR API",
        response.status,
        data
      );
    }

    console.log("[Mistral OCR] Extraction parsed successfully:", {
      documentType: parsed.documentType,
      hasFields: !!parsed.fields,
      hasClient: !!parsed.client,
      hasInvoiceNumber: !!parsed.invoiceNumber,
      hasInvoiceDate: !!parsed.invoiceDate,
      hasTotal: !!parsed.total,
      confidence: parsed.confidence,
    });

    // Validate structure
    // Note: New format has client/invoiceNumber as objects, legacy has fields
    const hasNewFormat = "client" in parsed && typeof parsed.client === "object";
    const hasLegacyFormat = parsed.fields && typeof parsed.fields === "object";
    
    if (!parsed.documentType || (!hasNewFormat && !hasLegacyFormat) || !parsed.confidence) {
      console.error("[Mistral OCR] Invalid extraction output structure:", {
        documentType: parsed.documentType,
        hasNewFormat,
        hasLegacyFormat,
        hasConfidence: !!parsed.confidence,
        parsedKeys: Object.keys(parsed),
      });
      throw new DocumentOcrError(
        "Invalid extraction output structure",
        response.status,
        parsed
      );
    }

    console.log("[Mistral OCR] Extraction successful, returning parsed data");
    return parsed;
  } catch (error) {
    clearTimeout(timeoutId);

    console.error("[Mistral OCR] Error during processing:", {
      errorName: error instanceof Error ? error.name : "Unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    });

    if (error instanceof DocumentOcrError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      console.error("[Mistral OCR] Request timeout after", timeoutMs, "ms");
      throw new DocumentOcrError(
        `Request timeout after ${timeoutMs}ms`,
        408,
        error
      );
    }

    // Network errors, fetch errors, etc.
    if (error instanceof Error) {
      console.error("[Mistral OCR] Network/request error:", error.message);
      if (error.message.includes("fetch")) {
        console.error("[Mistral OCR] Possible network connectivity issue or API endpoint unreachable");
      }
    }

    throw new DocumentOcrError(
      error instanceof Error ? error.message : "Unknown error",
      undefined,
      error
    );
  }
}
