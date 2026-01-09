/**
 * Document OCR Client
 * 
 * Calls Mistral Document AI & OCR API for document processing.
 * STRICTLY SEPARATE from AI Helper system.
 * 
 * Two-step process:
 * 1. OCR endpoint (/v1/ocr) extracts markdown text from document
 * 2. Chat completions API extracts structured data from markdown
 */

import { ENV } from "../../../_core/env";
import type { OcrInput, RawExtractionOutput } from "./types";
import { DOCUMENT_PROMPT_V1 } from "./documentPrompt_v1";

const MISTRAL_OCR_API_URL = "https://api.mistral.ai/v1/ocr";
const MISTRAL_CHAT_API_URL = "https://api.mistral.ai/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 60000; // 60 seconds for two-step processing

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
 * Step 1: Extract markdown text from document using Mistral OCR
 */
async function extractMarkdownFromDocument(
  input: OcrInput,
  apiKey: string
): Promise<string> {
  const model = "mistral-ocr-latest";
  const base64Data = input.fileBuffer.toString("base64");
  const dataUrl = `data:${input.mimeType};base64,${base64Data}`;
  
  const payload = {
    model,
    document: {
      type: "document_url",
      document_url: dataUrl,
    },
  };

  console.log("[Mistral OCR] Step 1: Extracting markdown from document");
  console.log("[Mistral OCR] Request details:", {
    model,
    filename: input.filename,
    mimeType: input.mimeType,
    fileSize: input.fileBuffer.length,
  });

  const response = await fetch(MISTRAL_OCR_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[Mistral OCR] OCR API error:", {
      status: response.status,
      errorBody: errorBody.substring(0, 500),
    });
    throw new DocumentOcrError(
      `Mistral OCR API error: ${response.status} ${response.statusText}`,
      response.status,
      errorBody
    );
  }

  const data = await response.json();
  
  // Extract markdown from pages array
  if (data.pages && Array.isArray(data.pages)) {
    const markdownParts: string[] = [];
    for (const page of data.pages) {
      if (page.markdown) {
        markdownParts.push(page.markdown);
      }
    }
    const fullMarkdown = markdownParts.join("\n\n---\n\n");
    console.log("[Mistral OCR] Extracted markdown length:", fullMarkdown.length);
    console.log("[Mistral OCR] Markdown preview:", fullMarkdown.substring(0, 300) + "...");
    return fullMarkdown;
  }

  throw new DocumentOcrError(
    "OCR response did not contain pages with markdown",
    response.status,
    data
  );
}

/**
 * Step 2: Extract structured data from markdown using Mistral Chat
 */
async function extractStructuredDataFromMarkdown(
  markdown: string,
  apiKey: string
): Promise<RawExtractionOutput> {
  // Use a capable model for structured extraction
  const model = ENV.aiAssistantModel || "mistral-large-latest";

  console.log("[Mistral OCR] Step 2: Extracting structured data from markdown");
  console.log("[Mistral OCR] Using model:", model);

  const response = await fetch(MISTRAL_CHAT_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: DOCUMENT_PROMPT_V1 },
        { role: "user", content: `Extract structured invoice data from this document:\n\n${markdown}` },
      ],
      temperature: 0.1, // Low temperature for deterministic extraction
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[Mistral OCR] Chat API error:", {
      status: response.status,
      errorBody: errorBody.substring(0, 500),
    });
    throw new DocumentOcrError(
      `Mistral Chat API error: ${response.status} ${response.statusText}`,
      response.status,
      errorBody
    );
  }

  const data = await response.json();
  const assistantMessage = data.choices?.[0]?.message?.content;

  if (!assistantMessage || typeof assistantMessage !== "string") {
    console.error("[Mistral OCR] Invalid chat response:", data);
    throw new DocumentOcrError(
      "Invalid response format from Mistral Chat API",
      response.status,
      data
    );
  }

  console.log("[Mistral OCR] Chat response received, length:", assistantMessage.length);

  // Parse JSON from response
  let jsonStr = assistantMessage.trim();
  
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

  try {
    const parsed = JSON.parse(jsonStr) as RawExtractionOutput;
    console.log("[Mistral OCR] Structured data extracted:", {
      documentType: parsed.documentType,
      hasClient: !!parsed.client,
      hasInvoiceNumber: !!parsed.invoiceNumber,
      hasTotal: !!parsed.total,
    });
    
    // Add confidence if not present (for compatibility)
    if (!parsed.confidence) {
      parsed.confidence = {
        overall: 0.8,
        fields: {},
      };
    }
    
    return parsed;
  } catch (parseError) {
    console.error("[Mistral OCR] JSON parse error:", {
      error: parseError instanceof Error ? parseError.message : "Unknown",
      jsonPreview: jsonStr.substring(0, 500),
    });
    throw new DocumentOcrError(
      `Failed to parse structured data: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
      200,
      assistantMessage
    );
  }
}

/**
 * Process document using Mistral Document AI
 * 
 * Two-step process:
 * 1. OCR API extracts markdown text
 * 2. Chat API extracts structured invoice data
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

  const startTime = Date.now();

  try {
    // Step 1: Extract markdown from document
    const markdown = await extractMarkdownFromDocument(input, apiKey);

    // Step 2: Extract structured data from markdown
    const structuredData = await extractStructuredDataFromMarkdown(markdown, apiKey);

    const duration = Date.now() - startTime;
    console.log("[Mistral OCR] Document processing complete:", {
      durationMs: duration,
      documentType: structuredData.documentType,
    });

    return structuredData;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[Mistral OCR] Error during processing:", {
      durationMs: duration,
      errorName: error instanceof Error ? error.name : "Unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof DocumentOcrError) {
      throw error;
    }

    throw new DocumentOcrError(
      error instanceof Error ? error.message : "Unknown error",
      undefined,
      error
    );
  }
}
