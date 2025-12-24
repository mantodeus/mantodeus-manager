import { ENV } from "../_core/env";
import { logger } from "../_core/logger";

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
    public readonly originalError?: unknown,
    public readonly isRetryable: boolean = false
  ) {
    super(message);
    this.name = "PDFServiceError";
  }
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Single attempt to render PDF without retry logic
 * Internal function - use renderPDF() instead
 */
async function renderPDFAttempt(
  html: string,
  options: PDFOptions,
  timeout: number
): Promise<Buffer> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(ENV.pdfServiceUrl!, {
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

      // Determine if error is retryable
      const isRetryable = response.status === 503 || response.status === 502 || response.status === 504;

      throw new PDFServiceError(
        errorMessage,
        response.status,
        undefined,
        isRetryable
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
        "PDF generation timed out. The service may be starting up.",
        408,
        error,
        true // Timeout is retryable - might be cold start
      );
    }

    if (error instanceof Error && error.message.includes("fetch failed")) {
      throw new PDFServiceError(
        "PDF service is unavailable. Please try again in a moment.",
        503,
        error,
        true // Service unavailable is retryable
      );
    }

    throw new PDFServiceError(
      `PDF generation failed: ${error instanceof Error ? error.message : String(error)}`,
      500,
      error,
      false // Unknown errors are not retryable
    );
  }
}

/**
 * Render HTML to PDF using the Fly.io PDF service with automatic retry
 * @param html - HTML content to convert to PDF
 * @param options - PDF generation options
 * @returns PDF buffer
 * @throws PDFServiceError if generation fails after all retries
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

  const maxRetries = 3;
  const baseTimeout = 45000; // Increased from 30s to handle cold starts
  const maxBackoff = 8000; // Max 8 seconds between retries

  let lastError: PDFServiceError | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Increase timeout on retries to account for service warmup
      const timeout = baseTimeout + (attempt * 15000); // 45s, 60s, 75s

      logger.debug(
        { attempt: attempt + 1, maxRetries, timeout },
        "Attempting PDF generation"
      );

      const buffer = await renderPDFAttempt(html, options, timeout);

      if (attempt > 0) {
        logger.info(
          { attempt: attempt + 1, retriesNeeded: attempt },
          "PDF generated successfully after retries"
        );
      }

      return buffer;
    } catch (error) {
      if (!(error instanceof PDFServiceError)) {
        throw error;
      }

      lastError = error;

      // Don't retry if error is not retryable
      if (!error.isRetryable) {
        logger.error(
          { err: error, statusCode: error.statusCode },
          "PDF generation failed with non-retryable error"
        );
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries - 1) {
        logger.error(
          { err: error, attempts: maxRetries, statusCode: error.statusCode },
          "PDF generation failed after all retries"
        );
        break;
      }

      // Calculate exponential backoff with jitter
      const backoff = Math.min(
        maxBackoff,
        Math.pow(2, attempt) * 1000 + Math.random() * 1000
      );

      logger.warn(
        {
          err: error,
          attempt: attempt + 1,
          maxRetries,
          backoffMs: Math.round(backoff),
          statusCode: error.statusCode,
        },
        "PDF generation attempt failed, retrying"
      );

      await sleep(backoff);
    }
  }

  // All retries exhausted
  throw new PDFServiceError(
    `PDF generation failed after ${maxRetries} attempts. ${lastError?.message || "Unknown error"}`,
    lastError?.statusCode || 500,
    lastError
  );
}
