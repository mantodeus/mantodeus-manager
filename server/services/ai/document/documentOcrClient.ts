/**
 * Document OCR Client
 * 
 * Calls Mistral Document AI & OCR API for document processing.
 * STRICTLY SEPARATE from AI Helper system.
 * 
 * Uses Mistral's vision/document understanding capabilities.
 */

import { ENV } from "../../../_core/env";
import type { OcrInput, RawExtractionOutput } from "./types";
import { DOCUMENT_PROMPT_V1 } from "./documentPrompt_v1";

const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";
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
 * Convert file buffer to base64 data URL
 */
function bufferToBase64DataUrl(buffer: Buffer, mimeType: string): string {
  const base64 = buffer.toString("base64");
  return `data:${mimeType};base64,${base64}`;
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

  console.log("[Mistral OCR] Starting document processing:", {
    filename: input.filename,
    mimeType: input.mimeType,
    fileSize: input.fileBuffer.length,
    apiKeyPresent: apiKey ? `${apiKey.substring(0, 8)}...` : "missing",
  });

  // Convert file to base64 for API
  const base64DataUrl = bufferToBase64DataUrl(input.fileBuffer, input.mimeType);
  const base64Length = base64DataUrl.length;
  console.log("[Mistral OCR] File converted to base64, length:", base64Length);

  // Use Mistral OCR model for document processing
  // Purpose: OCR + document understanding for uploaded PDFs/images
  // Input: files, Output: structured extraction (no chat, no prose)
  // Official model name from Mistral: mistral-ocr-latest
  const model = "mistral-ocr-latest";

  const timeoutMs = DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Build messages with image content
    const messages: Array<{
      role: "system" | "user";
      content: string | Array<{ type: "text" | "image_url"; text?: string; image_url?: { url: string } }>;
    }> = [
      {
        role: "system",
        content: DOCUMENT_PROMPT_V1,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extract structured data from this ${input.mimeType.includes("pdf") ? "PDF" : "image"} document. Output ONLY valid JSON, no explanations.`,
          },
          {
            type: "image_url",
            image_url: {
              url: base64DataUrl,
            },
          },
        ],
      },
    ];

    const requestBody = {
      model,
      messages,
      temperature: 0.1, // Low temperature for deterministic extraction
      max_tokens: 4000, // Enough for structured JSON output
    };

    console.log("[Mistral OCR] Making API request to:", MISTRAL_API_URL);
    console.log("[Mistral OCR] Request details:", {
      model,
      messageCount: messages.length,
      requestBodySize: JSON.stringify(requestBody).length,
      hasImage: messages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === "image_url")),
    });
    
    // Log request body structure (without the huge base64 data)
    const requestBodyForLog = {
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: Array.isArray(m.content) 
          ? m.content.map(c => c.type === "image_url" ? { type: "image_url", image_url: { url: "[BASE64_DATA...]" } } : c)
          : m.content?.substring(0, 200) + "...",
      })),
      temperature: requestBody.temperature,
      max_tokens: requestBody.max_tokens,
    };
    console.log("[Mistral OCR] Request body structure:", JSON.stringify(requestBodyForLog, null, 2));

    const requestStartTime = Date.now();
    const response = await fetch(MISTRAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
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

    const data = await response.json();
    console.log("[Mistral OCR] Response data structure:", {
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length || 0,
      usage: data.usage,
    });

    const assistantMessage = data.choices?.[0]?.message?.content;
    console.log("[Mistral OCR] Assistant message length:", assistantMessage?.length || 0);
    console.log("[Mistral OCR] Assistant message preview:", assistantMessage?.substring(0, 200) || "null");

    if (!assistantMessage || typeof assistantMessage !== "string") {
      console.error("[Mistral OCR] Invalid response format - no assistant message:", {
        dataKeys: Object.keys(data),
        choices: data.choices,
      });
      throw new DocumentOcrError(
        "Invalid response format from Mistral Document AI",
        response.status,
        data
      );
    }

    // Parse JSON response
    // Remove markdown code blocks if present
    let jsonStr = assistantMessage.trim();
    const originalJsonStr = jsonStr;
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

    console.log("[Mistral OCR] Parsing JSON response, length:", jsonStr.length);

    let parsed: RawExtractionOutput;
    try {
      parsed = JSON.parse(jsonStr);
      console.log("[Mistral OCR] JSON parsed successfully:", {
        documentType: parsed.documentType,
        hasFields: !!parsed.fields,
        hasClient: !!parsed.client,
        hasInvoiceNumber: !!parsed.invoiceNumber,
        hasInvoiceDate: !!parsed.invoiceDate,
        hasTotal: !!parsed.total,
        confidence: parsed.confidence,
      });
    } catch (parseError) {
      console.error("[Mistral OCR] JSON parse error:", {
        error: parseError instanceof Error ? parseError.message : "Unknown error",
        jsonPreview: jsonStr.substring(0, 500),
        originalPreview: originalJsonStr.substring(0, 500),
      });
      throw new DocumentOcrError(
        `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
        response.status,
        assistantMessage
      );
    }

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
