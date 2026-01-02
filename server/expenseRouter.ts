/**
 * Expenses Router - tRPC procedures for Expenses Module
 * 
 * Phase 1 Foundation: Basic CRUD, receipt upload, status management
 * 
 * Access Control (ownership-based):
 * - Expense creator has full access to their expenses
 * - Admin users have full access to all expenses
 * - Regular users can only access their own expenses
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import {
  createPresignedUploadUrl,
  createPresignedReadUrl,
  deleteFromStorage,
  storageGet,
  storagePut,
} from "./storage";
import { applyExpenseAutofill } from "./expenses/autofillEngine";
import { parseReceiptFilename } from "./expenses/filenameParser";
import { getProposedFields } from "./expenses/proposedFields";
import { extractGermanTotalFromPdfText } from "./expenses/pdfTotalExtractor";
import {
  calculateOverallScore,
  getMissingRequiredFields,
  type ProposedFields,
} from "./expenses/confidence";

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_RECEIPT_SIZE = 15 * 1024 * 1024; // 15MB

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
] as const;

const ALLOWED_CATEGORIES = [
  "office_supplies",
  "travel",
  "meals",
  "vehicle",
  "equipment",
  "software",
  "insurance",
  "marketing",
  "utilities",
  "rent",
  "professional_services",
  "shipping",
  "training",
  "subscriptions",
  "repairs",
  "taxes_fees",
  "other",
] as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate S3 key for expense receipt
 * Pattern: expenses/{expenseId}/{yyyyMMdd-HHmmss}-{safeFilename}
 */
function generateExpenseReceiptKey(expenseId: number, filename: string): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `expenses/${expenseId}/${dateStr}-${safeFilename}`;
}

/**
 * Sanitize filename to use as supplier name
 * Removes extension and cleans up the name
 */
function sanitizeFilenameForSupplierName(filename: string): string {
  // Remove extension
  const withoutExt = filename.replace(/\.[^/.]+$/, "");
  // Replace underscores and hyphens with spaces, then clean up
  const cleaned = withoutExt
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // If empty after cleaning, use a default
  return cleaned || "Receipt";
}

/**
 * Validate that user owns the expense (or is admin)
 */
async function validateExpenseOwnership(expenseId: number, userId: number, userRole: string): Promise<void> {
  const expense = await db.getExpenseById(expenseId);
  if (!expense) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found" });
  }
  
  if (userRole !== "admin" && expense.createdBy !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this expense" });
  }
}

/**
 * Validate that expense has required fields for in_order status
 */
function validateInOrderFields(data: {
  supplierName?: string;
  expenseDate?: Date | string;
  grossAmountCents?: number;
  category?: string;
}): void {
  if (!data.supplierName || !data.expenseDate || data.grossAmountCents === undefined || !data.category) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Expense must have supplierName, expenseDate, grossAmountCents, and category to be set to in_order",
    });
  }
}

/**
 * Validate VAT and currency rules
 * - German VAT requires EUR currency
 */
function validateVatCurrencyRules(data: {
  vatMode?: "none" | "german" | "foreign";
  currency?: string;
}): void {
  if (data.vatMode === "german" && data.currency && data.currency !== "EUR") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "German VAT requires EUR currency",
    });
  }
}

/**
 * Create expense with deterministic defaults for receipt-based creation
 * All expenses start in needs_review status
 * Uses filename parsing for initial values
 */
async function createExpenseFromReceipt(
  userId: number,
  filename: string
): Promise<number> {
  // Parse filename for initial values
  const parsed = parseReceiptFilename(filename);
  
  // Use parsed supplier name or fallback to sanitized filename
  const supplierName = parsed.supplierName || sanitizeFilenameForSupplierName(filename);
  const expenseDate = parsed.expenseDate || new Date();
  
  const expense = await db.createExpense({
    createdBy: userId,
    updatedByUserId: userId,
    status: "needs_review",
    source: "upload",
    supplierName,
    description: parsed.description || null,
    expenseDate,
    grossAmountCents: parsed.grossAmountCents || 0,
    currency: parsed.currency || "EUR",
    vatMode: "none",
    vatRate: null,
    vatAmountCents: null,
    businessUsePct: 100,
    category: null,
    paymentStatus: "unpaid",
    paymentDate: null,
    paymentMethod: null,
    reviewedByUserId: null,
    reviewedAt: null,
    voidedByUserId: null,
    voidedAt: null,
    voidReason: null,
    voidNote: null,
    confidenceScore: null,
    confidenceReason: null,
  });
  
  return expense.id;
}

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

const expenseStatusSchema = z.enum(["needs_review", "in_order", "void"]);
const expenseSourceSchema = z.enum(["upload", "scan", "manual"]);
const vatModeSchema = z.enum(["none", "german", "foreign"]);
const vatRateSchema = z.enum(["0", "7", "19"]);
const categorySchema = z.enum(ALLOWED_CATEGORIES as [string, ...string[]]);
const paymentStatusSchema = z.enum(["paid", "unpaid"]);
const paymentMethodSchema = z.enum(["cash", "bank_transfer", "card", "online"]);
const voidReasonSchema = z.enum(["duplicate", "personal", "mistake", "wrong_document", "other"]);

const createManualExpenseSchema = z.object({
  supplierName: z.string().min(1, "Supplier name is required"),
  description: z.string().optional().nullable(),
  expenseDate: z.date(),
  grossAmountCents: z.number().int().positive("Gross amount must be positive"),
  currency: z.string().length(3).default("EUR"),
  vatMode: vatModeSchema.default("none"),
  vatRate: vatRateSchema.optional().nullable(),
  vatAmountCents: z.number().int().nonnegative().optional().nullable(),
  businessUsePct: z.number().int().min(0).max(100).default(100),
  category: categorySchema,
  paymentStatus: paymentStatusSchema.default("unpaid"),
  paymentDate: z.date().optional().nullable(),
  paymentMethod: paymentMethodSchema.optional().nullable(),
});

const updateExpenseSchema = z.object({
  id: z.number(),
  supplierName: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  expenseDate: z.date().optional(),
  grossAmountCents: z.number().int().positive().optional(),
  currency: z.string().length(3).optional(),
  vatMode: vatModeSchema.optional(),
  vatRate: vatRateSchema.optional().nullable(),
  vatAmountCents: z.number().int().nonnegative().optional().nullable(),
  businessUsePct: z.number().int().min(0).max(100).optional(),
  category: categorySchema.optional(),
  paymentStatus: paymentStatusSchema.optional(),
  paymentDate: z.date().optional().nullable(),
  paymentMethod: paymentMethodSchema.optional().nullable(),
});

const setExpenseStatusSchema = z.object({
  id: z.number(),
  status: expenseStatusSchema,
  voidReason: voidReasonSchema.optional(),
  voidNote: z.string().optional().nullable(),
});

// =============================================================================
// EXPENSES ROUTER
// =============================================================================

export const expenseRouter = router({
  /**
   * List expenses for the current user
   * Default: excludes void expenses
   */
  list: protectedProcedure
    .input(
      z
        .object({
          statusFilter: expenseStatusSchema.optional(),
          includeVoid: z.boolean().optional().default(false),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const statusFilter = input?.statusFilter;
      const includeVoid = input?.includeVoid ?? false;
      if (includeVoid !== true && includeVoid !== false) {
        throw new Error("includeVoid must be boolean");
      }
      const expenses = await db.listExpensesByUser(ctx.user.id, statusFilter, includeVoid);

      const counts = await db.getExpenseFileCountsByExpenseIds(
        expenses.map((expense) => expense.id)
      );

      // For needs_review expenses, get review lane data
      const needsReviewExpenses = expenses.filter((e) => e.status === "needs_review");
      const reviewMetaMap = new Map<number, any>();

      // Performance optimization: Batch fetch files for all needs_review expenses
      // This prevents N+1 queries (one per expense)
      const needsReviewIds = needsReviewExpenses.map(e => e.id);
      const allFiles = needsReviewIds.length > 0
        ? await db.getExpenseFilesByExpenseIds(needsReviewIds)
        : [];

      // Group files by expense ID for quick lookup
      const filesByExpenseId = new Map<number, any[]>();
      for (const file of allFiles) {
        if (!filesByExpenseId.has(file.expenseId)) {
          filesByExpenseId.set(file.expenseId, []);
        }
        filesByExpenseId.get(file.expenseId)!.push(file);
      }

      await Promise.all(
        needsReviewExpenses.map(async (expense) => {
          try {
            // Pass pre-fetched files to avoid per-expense DB query
            const expenseFiles = filesByExpenseId.get(expense.id) || [];
            const proposed = await getProposedFields(expense, ctx.user.id, expenseFiles);
            const overallScore = calculateOverallScore(expense, proposed);
            const missingRequired = getMissingRequiredFields(expense);

            // Only include proposed fields that differ from current values
            const proposedFiltered: ProposedFields = {};
            
            if (proposed.supplierName && proposed.supplierName.value !== expense.supplierName) {
              proposedFiltered.supplierName = proposed.supplierName;
            }
            if (proposed.description && proposed.description.value !== expense.description) {
              proposedFiltered.description = proposed.description;
            }
            if (proposed.expenseDate) {
              const currentDate = new Date(expense.expenseDate);
              const proposedDate = new Date(proposed.expenseDate.value);
              currentDate.setHours(0, 0, 0, 0);
              proposedDate.setHours(0, 0, 0, 0);
              if (currentDate.getTime() !== proposedDate.getTime()) {
                proposedFiltered.expenseDate = proposed.expenseDate;
              }
            }
            if (proposed.grossAmountCents && proposed.grossAmountCents.value !== expense.grossAmountCents) {
              proposedFiltered.grossAmountCents = proposed.grossAmountCents;
            }
            if (proposed.category && proposed.category.value !== expense.category) {
              proposedFiltered.category = proposed.category;
            }
            if (proposed.vatMode && proposed.vatMode.value !== expense.vatMode) {
              proposedFiltered.vatMode = proposed.vatMode;
            }
            if (proposed.businessUsePct && proposed.businessUsePct.value !== expense.businessUsePct) {
              proposedFiltered.businessUsePct = proposed.businessUsePct;
            }

            reviewMetaMap.set(expense.id, {
              overallScore,
              missingRequired,
              proposed: proposedFiltered,
            });
          } catch (error) {
            console.error(`[Expenses] Failed to get review meta for expense ${expense.id}:`, error);
            // Continue without review meta for this expense
          }
        })
      );

      return expenses.map((expense) => ({
        ...expense,
        receiptCount: counts.get(expense.id) ?? 0,
        reviewMeta: reviewMetaMap.get(expense.id) || null,
      }));
    }),

  /**
   * Get a single expense by ID
   * Includes suggestions for category, VAT mode, and business use %
   * Always includes files array (even if empty) with presigned GET URLs for preview
   */
  getExpense: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      await validateExpenseOwnership(input.id, ctx.user.id, ctx.user.role);
      const expense = await db.getExpenseById(input.id);
      if (!expense) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found" });
      }
      
      // Get suggestions (pure computation, no side effects)
      const { getExpenseSuggestions } = await import("./expenses/suggestionEngine");
      const suggestions = await getExpenseSuggestions(expense.id, ctx.user.id);
      
      // Ensure files array exists (always returned, even if empty)
      const files = expense.files || [];
      
      // Generate presigned GET URLs for file preview (NOT PUT URLs)
      const filesWithUrls = await Promise.all(
        files.map(async (file) => {
          const previewUrl = await createPresignedReadUrl(file.s3Key, 60 * 60); // 1 hour GET URL
          return {
            ...file,
            previewUrl, // Presigned GET URL for preview/download
          };
        })
      );
      
      // Compute autofilled fields metadata (for UI indicators)
      // Fields are considered autofilled if:
      // 1. Expense is in needs_review status
      // 2. Source is upload or scan (receipt-based)
      // 3. Field has non-default value
      const autofilledFields: string[] = [];
      if (expense.status === "needs_review" && (expense.source === "upload" || expense.source === "scan")) {
        if (expense.category) autofilledFields.push("category");
        if (expense.vatMode && expense.vatMode !== "none") autofilledFields.push("vatMode");
        if (expense.businessUsePct !== 100) autofilledFields.push("businessUsePct");
        if (expense.description) autofilledFields.push("description");
        if (expense.grossAmountCents > 0) autofilledFields.push("grossAmountCents");
        // Don't mark supplierName as autofilled (always set from filename)
        // Don't mark expenseDate as autofilled (always set)
      }
      
      return {
        ...expense,
        files: filesWithUrls, // Always an array, never undefined
        suggestions,
        autofilledFields, // Metadata for UI indicators
      };
    }),

  /**
   * Create a manual expense entry
   */
  createManualExpense: protectedProcedure
    .input(createManualExpenseSchema)
    .mutation(async ({ input, ctx }) => {
      // Validate VAT/currency rules
      validateVatCurrencyRules({ vatMode: input.vatMode, currency: input.currency });

      const expense = await db.createExpense({
        createdBy: ctx.user.id,
        updatedByUserId: ctx.user.id,
        status: "needs_review",
        source: "manual",
        supplierName: input.supplierName,
        description: input.description || null,
        expenseDate: input.expenseDate,
        grossAmountCents: input.grossAmountCents,
        currency: input.currency,
        vatMode: input.vatMode,
        vatRate: input.vatRate || null,
        vatAmountCents: input.vatAmountCents || null,
        businessUsePct: input.businessUsePct,
        category: input.category,
        paymentStatus: input.paymentStatus,
        paymentDate: input.paymentDate || null,
        paymentMethod: input.paymentMethod || null,
        reviewedByUserId: null,
        reviewedAt: null,
        voidedByUserId: null,
        voidedAt: null,
        voidReason: null,
        voidNote: null,
        confidenceScore: null,
        confidenceReason: null,
      });

      return expense;
    }),

  /**
   * Update an expense
   * Payment field edits never affect status
   * Accounting field changes reset status to needs_review if currently in_order
   */
  updateExpense: protectedProcedure
    .input(updateExpenseSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;
      
      await validateExpenseOwnership(id, ctx.user.id, ctx.user.role);

      // Validate VAT/currency rules if being updated
      if (updates.vatMode || updates.currency) {
        const existing = await db.getExpenseById(id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found" });
        }
        validateVatCurrencyRules({
          vatMode: updates.vatMode || existing.vatMode,
          currency: updates.currency || existing.currency,
        });
      }

      // Validate category if provided
      if (updates.category && !ALLOWED_CATEGORIES.includes(updates.category as any)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid category. Must be one of: ${ALLOWED_CATEGORIES.join(", ")}`,
        });
      }

      const updated = await db.updateExpense(id, updates, ctx.user.id);
      return updated;
    }),

  /**
   * Apply proposed fields (user-confirmed from review lane)
   * Only applies provided fields, does NOT change status
   */
  applyProposedFields: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        fields: z.object({
          supplierName: z.string().optional(),
          description: z.string().nullable().optional(),
          expenseDate: z.date().optional(),
          grossAmountCents: z.number().int().positive().optional(),
          currency: z.string().length(3).optional(),
          category: categorySchema.optional(),
          vatMode: vatModeSchema.optional(),
          businessUsePct: z.number().int().min(0).max(100).optional(),
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, fields } = input;

      await validateExpenseOwnership(id, ctx.user.id, ctx.user.role);

      // Validate VAT/currency rules if being updated
      if (fields.vatMode || fields.currency) {
        const existing = await db.getExpenseById(id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found" });
        }
        validateVatCurrencyRules({
          vatMode: fields.vatMode || existing.vatMode,
          currency: fields.currency || existing.currency,
        });
      }

      // Apply only provided fields (reuse updateExpense logic)
      const updated = await db.updateExpense(id, fields, ctx.user.id);
      return updated;
    }),

  /**
   * Set expense status
   * Hard rules:
   * - Void only if in_order + reason
   * - Payment field edits never affect status
   */
  setExpenseStatus: protectedProcedure
    .input(setExpenseStatusSchema)
    .mutation(async ({ input, ctx }) => {
      let { id, status, voidReason, voidNote } = input;
      
      // Defensive: Coerce legacy "wrong" to "wrong_document" for backward compatibility
      if (voidReason === "wrong") {
        voidReason = "wrong_document";
      }
      
      await validateExpenseOwnership(id, ctx.user.id, ctx.user.role);

      // Validate in_order fields if setting to in_order
      if (status === "in_order") {
        const existing = await db.getExpenseById(id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found" });
        }
        validateInOrderFields({
          supplierName: existing.supplierName,
          expenseDate: existing.expenseDate,
          grossAmountCents: existing.grossAmountCents,
          category: existing.category || undefined,
        });
      }

      const updated = await db.setExpenseStatus(id, status, ctx.user.id, voidReason, voidNote);
      return updated;
    }),

  /**
   * Delete an expense
   * Hard rule: Only allowed if status === 'needs_review'
   */
  deleteExpense: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await validateExpenseOwnership(input.id, ctx.user.id, ctx.user.role);

      // Get expense files for S3 cleanup
      const files = await db.getExpenseFilesByExpenseId(input.id);
      
      // Delete expense (DB layer enforces needs_review rule)
      await db.deleteExpense(input.id);

      // Best-effort S3 cleanup
      for (const file of files) {
        try {
          await deleteFromStorage(file.s3Key);
        } catch (error) {
          console.error(`[Expenses] Failed to delete S3 file ${file.s3Key}:`, error);
        }
      }

      return { success: true };
    }),

  /**
   * Upload expense receipt
   * Returns presigned URL for direct upload
   */
  uploadExpenseReceipt: protectedProcedure
    .input(
      z.object({
        expenseId: z.number(),
        filename: z.string().min(1),
        mimeType: z.string(),
        fileSize: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await validateExpenseOwnership(input.expenseId, ctx.user.id, ctx.user.role);

      // Validate file size
      if (input.fileSize > MAX_RECEIPT_SIZE) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `File size exceeds maximum of ${MAX_RECEIPT_SIZE / 1024 / 1024}MB`,
        });
      }

      // Validate MIME type
      if (!ALLOWED_MIME_TYPES.includes(input.mimeType as any)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
        });
      }

      // Generate S3 key
      const s3Key = generateExpenseReceiptKey(input.expenseId, input.filename);

      // Create presigned upload URL
      const { uploadUrl } = await createPresignedUploadUrl(s3Key, input.mimeType, 15 * 60); // 15 minutes

      return {
        uploadUrl,
        s3Key,
      };
    }),

  /**
   * Register receipt file after upload
   * Call this after successfully uploading to the presigned URL
   */
  registerReceipt: protectedProcedure
    .input(
      z.object({
        expenseId: z.number(),
        s3Key: z.string().min(1),
        mimeType: z.string(),
        originalFilename: z.string().min(1),
        fileSize: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await validateExpenseOwnership(input.expenseId, ctx.user.id, ctx.user.role);

      // Check if this is the first receipt
      const existingFiles = await db.getExpenseFilesByExpenseId(input.expenseId);
      const isFirstReceipt = existingFiles.length === 0;

      const file = await db.addExpenseFile({
        expenseId: input.expenseId,
        s3Key: input.s3Key,
        mimeType: input.mimeType,
        originalFilename: input.originalFilename,
        fileSize: input.fileSize,
      });

      // Apply autofill only if this is the first receipt
      if (isFirstReceipt) {
        try {
          let pdfTotalCents: number | null = null;
          if (input.mimeType.toLowerCase().includes("pdf")) {
            try {
              const { data } = await storageGet(input.s3Key);
              const totalResult = await extractGermanTotalFromPdfText(data);
              if (totalResult.confidence !== "low") {
                pdfTotalCents = totalResult.grossAmountCents;
              }
            } catch (pdfError) {
              console.error(
                `[Expenses] PDF total extraction failed for expense ${input.expenseId}:`,
                pdfError
              );
            }
          }

          await applyExpenseAutofill(input.expenseId, {
            filename: input.originalFilename,
            userId: ctx.user.id,
            isFirstReceipt: true,
            pdfTotalCents,
          });
        } catch (autofillError) {
          // Log but don't fail - autofill is best-effort
          console.error(
            `[Expenses] Autofill failed for expense ${input.expenseId}:`,
            autofillError
          );
        }
      }

      return file;
    }),

  /**
   * Get presigned URL for viewing/downloading a receipt
   */
  getReceiptUrl: protectedProcedure
    .input(z.object({ fileId: z.number() }))
    .query(async ({ input, ctx }) => {
      const file = await db.getExpenseFileById(input.fileId);
      
      if (!file) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Receipt file not found" });
      }

      // Verify expense ownership
      await validateExpenseOwnership(file.expenseId, ctx.user.id, ctx.user.role);

      const url = await createPresignedReadUrl(file.s3Key, 60 * 60); // 1 hour

      return { url, file };
    }),

  /**
   * Delete an expense receipt file
   */
  deleteExpenseFile: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // Get file before delete for ownership check and S3 cleanup
      const file = await db.getExpenseFileById(input.id);
      
      if (!file) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Receipt file not found" });
      }

      // Verify expense ownership
      await validateExpenseOwnership(file.expenseId, ctx.user.id, ctx.user.role);

      // Delete from DB (returns file before delete)
      const deletedFile = await db.deleteExpenseFile(input.id);

      // Best-effort S3 cleanup
      if (deletedFile) {
        try {
          await deleteFromStorage(deletedFile.s3Key);
        } catch (error) {
          console.error(`[Expenses] Failed to delete S3 file ${deletedFile.s3Key}:`, error);
        }
      }

      return { success: true };
    }),

  /**
   * Get all receipt files for an expense
   */
  getExpenseFiles: protectedProcedure
    .input(z.object({ expenseId: z.number() }))
    .query(async ({ input, ctx }) => {
      await validateExpenseOwnership(input.expenseId, ctx.user.id, ctx.user.role);
      return await db.getExpenseFilesByExpenseId(input.expenseId);
    }),

  /**
   * Process receipt (OCR stub - throws NOT_IMPLEMENTED)
   */
  processReceipt: protectedProcedure
    .input(
      z.object({
        expenseId: z.number(),
        fileId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await validateExpenseOwnership(input.expenseId, ctx.user.id, ctx.user.role);
      
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "OCR processing not yet implemented",
      });
    }),

  /**
   * Bulk upload expense receipts
   * Creates an expense for each file with deterministic defaults
   * All expenses start in needs_review status
   * 
   * Behavior:
   * - Max 10 files per request
   * - Each file creates a new expense
   * - Partial failures don't abort the batch
   * - Returns list of created expense IDs
   */
  uploadReceiptsBulk: protectedProcedure
    .input(
      z.object({
        files: z
          .array(
            z.object({
              filename: z.string().min(1),
              mimeType: z.string(),
              fileSize: z.number().int().positive(),
              base64Data: z.string(),
            })
          )
          .min(1, "At least one file is required")
          .max(10, "Maximum 10 files per request"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const createdExpenseIds: number[] = [];
      const errors: Array<{ filename: string; error: string }> = [];

      // Process each file independently
      for (const file of input.files) {
        let expenseId: number | null = null;
        try {
          // Validate file size
          if (file.fileSize > MAX_RECEIPT_SIZE) {
            throw new Error(
              `File size exceeds maximum of ${MAX_RECEIPT_SIZE / 1024 / 1024}MB`
            );
          }

          // Validate MIME type
          if (!ALLOWED_MIME_TYPES.includes(file.mimeType as any)) {
            throw new Error(
              `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`
            );
          }

          // Validate base64 data size matches fileSize (approximate)
          const buffer = Buffer.from(file.base64Data, "base64");
          if (buffer.length === 0) {
            throw new Error("Invalid base64 data");
          }

          // Create expense with deterministic defaults
          expenseId = await createExpenseFromReceipt(ctx.user.id, file.filename);

          // Generate S3 key
          const s3Key = generateExpenseReceiptKey(expenseId, file.filename);

          let s3UploadSucceeded = false;
          try {
            // Upload file to S3
            await storagePut(s3Key, file.base64Data, file.mimeType);
            s3UploadSucceeded = true;

            // Create expense_files row
            await db.addExpenseFile({
              expenseId,
              s3Key,
              mimeType: file.mimeType,
              originalFilename: file.filename,
              fileSize: file.fileSize,
            });

            // Apply autofill (this is the first receipt, so autofill runs)
            try {
              let pdfTotalCents: number | null = null;
              if (file.mimeType.toLowerCase().includes("pdf")) {
                try {
                  const totalResult = await extractGermanTotalFromPdfText(buffer);
                  if (totalResult.confidence !== "low") {
                    pdfTotalCents = totalResult.grossAmountCents;
                  }
                } catch (pdfError) {
                  console.error(
                    `[Expenses] PDF total extraction failed for expense ${expenseId}:`,
                    pdfError
                  );
                }
              }

              await applyExpenseAutofill(expenseId, {
                filename: file.filename,
                userId: ctx.user.id,
                isFirstReceipt: true,
                pdfTotalCents,
              });
            } catch (autofillError) {
              // Log but don't fail - autofill is best-effort
              console.error(
                `[Expenses] Autofill failed for expense ${expenseId}:`,
                autofillError
              );
            }

            createdExpenseIds.push(expenseId);
          } catch (uploadError) {
            // If S3 upload or file registration failed, clean up
            if (s3UploadSucceeded) {
              // S3 upload succeeded but file registration failed - clean up S3
              try {
                await deleteFromStorage(s3Key);
              } catch (s3CleanupError) {
                console.error(
                  `[Expenses] Failed to cleanup S3 file ${s3Key}:`,
                  s3CleanupError
                );
              }
            }
            // Clean up expense if it was created
            if (expenseId !== null) {
              try {
                await db.deleteExpense(expenseId);
              } catch (cleanupError) {
                console.error(
                  `[Expenses] Failed to cleanup orphaned expense ${expenseId}:`,
                  cleanupError
                );
              }
            }
            throw uploadError; // Re-throw to be caught by outer catch
          }
        } catch (error) {
          // Log error per file, but continue processing
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          errors.push({
            filename: file.filename,
            error: errorMessage,
          });
          console.error(
            `[Expenses] Failed to process file ${file.filename}:`,
            error
          );
        }
      }

      // Return results (even if some failed)
      return {
        createdExpenseIds,
        errors: errors.length > 0 ? errors : undefined,
      };
    }),
});

