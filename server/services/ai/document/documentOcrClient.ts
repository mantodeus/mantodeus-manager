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
    throw new DocumentOcrError("MISTRAL_API_KEY not configured");
  }

  // Convert file to base64 for API
  const base64DataUrl = bufferToBase64DataUrl(input.fileBuffer, input.mimeType);

  // Use Mistral OCR model for document processing
  // Purpose: OCR + document understanding for uploaded PDFs/images
  // Input: files, Output: structured extraction (no chat, no prose)
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

    const response = await fetch(MISTRAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.1, // Low temperature for deterministic extraction
        max_tokens: 4000, // Enough for structured JSON output
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `Mistral Document AI error: ${response.status} ${response.statusText}`;
      try {
        const parsed = JSON.parse(errorBody);
        errorMessage = parsed.error?.message || errorMessage;
      } catch {
        // Use default error message
      }
      throw new DocumentOcrError(
        errorMessage,
        response.status,
        errorBody
      );
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content;

    if (!assistantMessage || typeof assistantMessage !== "string") {
      throw new DocumentOcrError(
        "Invalid response format from Mistral Document AI",
        response.status,
        data
      );
    }

    // Parse JSON response
    // Remove markdown code blocks if present
    let jsonStr = assistantMessage.trim();
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

    let parsed: RawExtractionOutput;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      throw new DocumentOcrError(
        `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
        response.status,
        assistantMessage
      );
    }

    // Validate structure
    if (!parsed.documentType || !parsed.fields || !parsed.confidence) {
      throw new DocumentOcrError(
        "Invalid extraction output structure",
        response.status,
        parsed
      );
    }

    return parsed;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof DocumentOcrError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new DocumentOcrError(
        `Request timeout after ${timeoutMs}ms`,
        408,
        error
      );
    }

    throw new DocumentOcrError(
      error instanceof Error ? error.message : "Unknown error",
      undefined,
      error
    );
  }
}
