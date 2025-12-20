import { ENV } from "../_core/env";

export interface PDFOptions {
  format?: "A4" | "Letter";
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  printBackground?: boolean;
}

export class PDFServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = "PDFServiceError";
  }
}

/**
 * Render HTML to PDF using the Fly.io PDF service
 * @param html - HTML content to convert to PDF
 * @param options - PDF generation options
 * @returns PDF buffer
 * @throws PDFServiceError if generation fails
 */
export async function renderPDF(
  html: string,
  options: PDFOptions = {}
): Promise<Buffer> {
  if (!ENV.pdfServiceUrl) {
    throw new PDFServiceError("PDF service URL not configured");
  }

  if (!ENV.pdfServiceSecret) {
    throw new PDFServiceError("PDF service secret not configured");
  }

  const timeout = 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(ENV.pdfServiceUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ENV.pdfServiceSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        html,
        options: {
          format: options.format || "A4",
          margin: options.margin || {
            top: "10mm",
            right: "10mm",
            bottom: "10mm",
            left: "10mm",
          },
          printBackground: options.printBackground !== false,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = `PDF service returned ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        const text = await response.text().catch(() => "");
        if (text) errorMessage = text;
      }

      throw new PDFServiceError(
        errorMessage,
        response.status
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof PDFServiceError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new PDFServiceError(
        "PDF generation timed out. Please try again.",
        408,
        error
      );
    }

    if (error instanceof Error && error.message.includes("fetch failed")) {
      throw new PDFServiceError(
        "PDF service is unavailable. Please try again in a moment.",
        503,
        error
      );
    }

    throw new PDFServiceError(
      `PDF generation failed: ${error instanceof Error ? error.message : String(error)}`,
      500,
      error
    );
  }
}
