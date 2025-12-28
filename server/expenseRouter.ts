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
import { createPresignedUploadUrl, createPresignedReadUrl, deleteFromStorage } from "./storage";

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
  listExpenses: protectedProcedure
    .input(
      z
        .object({
          statusFilter: expenseStatusSchema.optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const statusFilter = input?.statusFilter;
      return await db.listExpensesByUser(ctx.user.id, statusFilter);
    }),

  /**
   * Get a single expense by ID
   */
  getExpense: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      await validateExpenseOwnership(input.id, ctx.user.id, ctx.user.role);
      const expense = await db.getExpenseById(input.id);
      if (!expense) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found" });
      }
      return expense;
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
   * Set expense status
   * Hard rules:
   * - Void only if in_order + reason
   * - Payment field edits never affect status
   */
  setExpenseStatus: protectedProcedure
    .input(setExpenseStatusSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, status, voidReason, voidNote } = input;
      
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

      const file = await db.addExpenseFile({
        expenseId: input.expenseId,
        s3Key: input.s3Key,
        mimeType: input.mimeType,
        originalFilename: input.originalFilename,
        fileSize: input.fileSize,
      });

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
});

