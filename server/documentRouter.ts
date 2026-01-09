/**
 * Document Processing Router
 * 
 * Handles document upload and OCR processing.
 * STRICTLY SEPARATE from AI Helper system.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { storagePut, generateFileKey } from "./storage";
import { invoiceItems } from "../drizzle/schema";
import { processDocumentOcr } from "./services/ai/document/documentOcrClient";
import { normalizeExtractedData } from "./services/ai/document/normalizeExtractedData";
import { computeConfidenceMetadata } from "./services/ai/document/confidenceScoring";
import { matchClient } from "./services/ai/document/clientMatching";
import type { NormalizedExtractionResult } from "./services/ai/document/types";
import { logger } from "./_core/logger";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Convert cents to decimal string
 */
function centsToDecimal(cents: number | null): string {
  if (cents === null) return "0.00";
  return (cents / 100).toFixed(2);
}

/**
 * Process uploaded document and create staging invoice
 */
export const documentRouter = router({
  /**
   * Process document (PDF/image) and extract invoice data
   * Creates a staging invoice with needsReview=true
   */
  process: protectedProcedure
    .input(
      z.object({
        filename: z.string().min(1),
        mimeType: z.string(),
        fileSize: z.number().max(MAX_FILE_SIZE),
        base64Data: z.string(),
        languageHint: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Use both console.log (for PM2) and logger (for structured logging)
      logger.info({ filename: input.filename, mimeType: input.mimeType, fileSize: input.fileSize }, "[Document Router] ===== PROCESS CALLED =====");
      console.log("[Document Router] ===== PROCESS CALLED =====");
      console.log("[Document Router] Input received:", {
        filename: input.filename,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        hasBase64Data: !!input.base64Data,
        base64Length: input.base64Data?.length || 0,
        languageHint: input.languageHint,
      });

      const userId = ctx.user.id;
      console.log("[Document Router] User ID:", userId);

      // Validate file type
      const allowedMimeTypes = [
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
      ];
      if (!allowedMimeTypes.includes(input.mimeType)) {
        console.error("[Document Router] Invalid file type:", input.mimeType);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid file type. Only PDF and images are supported.",
        });
      }
      console.log("[Document Router] File type validated:", input.mimeType);

      // Convert base64 to buffer
      let fileBuffer: Buffer;
      try {
        fileBuffer = Buffer.from(input.base64Data, "base64");
        console.log("[Document Router] Base64 converted to buffer, size:", fileBuffer.length);
      } catch (error) {
        console.error("[Document Router] Base64 conversion failed:", error);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid file data",
        });
      }

      // Validate file size
      if (fileBuffer.length > MAX_FILE_SIZE) {
        console.error("[Document Router] File too large:", fileBuffer.length, "max:", MAX_FILE_SIZE);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `File size exceeds maximum of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        });
      }
      console.log("[Document Router] File size validated:", fileBuffer.length);

      // Process document with OCR
      console.log("[Document Router] About to call processDocumentOcr...");
      let normalized: NormalizedExtractionResult;
      let confidenceMeta;
      try {
        console.log("[Document Router] Calling processDocumentOcr with:", {
          filename: input.filename,
          mimeType: input.mimeType,
          fileBufferSize: fileBuffer.length,
        });
        
        const raw = await processDocumentOcr({
          fileBuffer,
          mimeType: input.mimeType,
          filename: input.filename,
          languageHint: input.languageHint,
        });

        console.log("[Document Router] processDocumentOcr returned successfully");
        // Log raw extraction for debugging
        console.log("[Document Router] Raw OCR output:", JSON.stringify(raw, null, 2));

        normalized = normalizeExtractedData(raw);
        confidenceMeta = computeConfidenceMetadata(normalized);
        
        // Log normalized data for debugging
        console.log("[Document Router] Normalized data:", {
          invoiceNumber: normalized.invoiceNumber,
          issueDate: normalized.issueDate,
          dueDate: normalized.dueDate,
          clientName: normalized.clientName,
          totalCents: normalized.totalCents,
          itemsCount: normalized.items.length,
          confidence: normalized.confidence.overall,
        });
      } catch (error) {
        console.error("[Document Router] OCR processing failed:", error);
        console.error("[Document Router] Error details:", {
          name: error instanceof Error ? error.name : "Unknown",
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error 
            ? `Document processing failed: ${error.message}`
            : "Document processing failed. Please try again.",
        });
      }

      // Upload original file to S3
      const s3Key = generateFileKey("invoices", userId, input.filename);
      let uploadedS3Key: string;
      try {
        const uploadResult = await storagePut(s3Key, fileBuffer, input.mimeType);
        uploadedS3Key = uploadResult.key;
      } catch (error) {
        console.error("[Document Router] S3 upload failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to store document. Please try again.",
        });
      }

      // Create staging invoice with extracted data
      // Use needsReview=true and source="uploaded"
      // IMPORTANT: Do NOT default to today's date - use extracted date or null
      // If extraction failed, leave it null so user can set it manually
      const issueDate = normalized.issueDate || null;
      const invoiceYear = issueDate ? issueDate.getFullYear() : new Date().getFullYear();

      // Generate invoice number if not extracted
      let invoiceNumber = normalized.invoiceNumber;
      let invoiceCounter = 0;
      if (!invoiceNumber) {
        const settings = await db.getCompanySettingsByUserId(userId);
        // Use extracted date if available, otherwise use current date for invoice number generation
        const dateForInvoiceNumber = issueDate || new Date();
        const generated = await db.generateInvoiceNumber(
          userId,
          dateForInvoiceNumber,
          settings?.invoiceNumberFormat ?? null,
          settings?.invoicePrefix ?? "RE"
        );
        invoiceNumber = generated.invoiceNumber;
        invoiceCounter = generated.invoiceCounter;
      } else {
        // Extract counter from invoice number if possible
        const match = invoiceNumber.match(/(\d+)$/);
        if (match) {
          invoiceCounter = parseInt(match[1], 10) || 0;
        }
      }

      // Derive invoice name from filename
      const invoiceName = input.filename.replace(/\.[^/.]+$/, "");

      // Match client (non-destructive - only preselect if confidence is high)
      const clientMatch = await matchClient(normalized.clientName, userId, 0.85);
      const matchedClientId = clientMatch.matchedClientId; // May be null if confidence too low

      // Create invoice with needsReview=true
      const created = await db.createInvoice({
        userId,
        clientId: matchedClientId, // Preselected if match confidence >= 0.85
        invoiceNumber,
        invoiceName,
        invoiceCounter,
        invoiceYear,
        status: "draft", // Always draft on creation
        issueDate,
        dueDate: normalized.dueDate,
        notes: normalized.notes,
        servicePeriodStart: normalized.servicePeriodStart,
        servicePeriodEnd: normalized.servicePeriodEnd,
        referenceNumber: normalized.referenceNumber,
        subtotal: centsToDecimal(normalized.subtotalCents),
        vatAmount: centsToDecimal(normalized.vatAmountCents),
        total: centsToDecimal(normalized.totalCents),
        source: "uploaded",
        needsReview: true, // Always needs review after OCR
        originalPdfS3Key: uploadedS3Key,
        originalFileName: input.filename,
        uploadedAt: new Date(),
        uploadedBy: userId,
        mimeType: input.mimeType,
        fileSize: fileBuffer.length,
      });

      // Add line items if extracted
      if (normalized.items.length > 0) {
        const dbInstance = await db.getDb();
        if (!dbInstance) throw new Error("Database not available");
        await dbInstance.insert(invoiceItems).values(
          normalized.items.map((item) => ({
            invoiceId: created.id,
            name: item.name,
            description: item.description,
            quantity: item.quantity.toFixed(2),
            unitPrice: centsToDecimal(item.unitPriceCents),
            lineTotal: centsToDecimal(item.lineTotalCents),
            currency: normalized.currency,
          }))
        );
      }

      // Return staging invoice with extracted data preview
      return {
        invoiceId: created.id,
        extractedData: {
          documentType: normalized.documentType,
          invoiceNumber: normalized.invoiceNumber,
          issueDate: normalized.issueDate?.toISOString() || null,
          dueDate: normalized.dueDate?.toISOString() || null,
          clientName: normalized.clientName,
          total: centsToDecimal(normalized.totalCents),
          currency: normalized.currency,
          items: normalized.items.map((item) => ({
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unitPrice: centsToDecimal(item.unitPriceCents),
            lineTotal: centsToDecimal(item.lineTotalCents),
          })),
        },
        confidence: confidenceMeta,
        requiresReview: confidenceMeta.requiresReview,
        matchedClient: clientMatch.matchedClientId ? {
          clientId: clientMatch.matchedClientId,
          confidence: clientMatch.matchConfidence,
          name: clientMatch.matchedName,
        } : null,
      };
    }),
});
