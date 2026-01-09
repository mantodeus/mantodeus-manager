import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { parseInvoicePdf } from "./_core/pdfParser";
import { storagePut, generateFileKey, deleteFromStorage } from "./storage";
import { logger } from "./_core/logger";

const lineItemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unitPrice: z.number().nonnegative(),
  currency: z.string().length(3).default("EUR"),
});

const invoiceMetadataSchema = z.object({
  invoiceNumber: z.string().trim().min(1, "Invoice number is required").optional(),
  clientId: z.number().optional().nullable(),
  issueDate: z.date().optional(),
  dueDate: z.date().optional().nullable(),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  servicePeriodStart: z.date().optional().nullable(),
  servicePeriodEnd: z.date().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
  partialInvoice: z.boolean().optional(),
});

function normalizeLineItems(items: Array<z.infer<typeof lineItemSchema>>) {
  return items.map((item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const lineTotal = Number((quantity * unitPrice).toFixed(2));
    return {
      name: item.name,
      description: item.description ?? null,
      category: item.category ?? null,
      quantity,
      unitPrice,
      currency: item.currency || "EUR",
      lineTotal,
    };
  });
}

function calculateTotals(items: ReturnType<typeof normalizeLineItems>) {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const vatAmount = 0; // VAT handling will be added later
  const total = subtotal + vatAmount;
  return {
    subtotal: Number(subtotal.toFixed(2)),
    vatAmount: Number(vatAmount.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}

/**
 * Format invoice name - just return the invoice number (no prefix)
 */
function formatInvoiceName(invoiceNumber: string): string {
  return invoiceNumber;
}

function extractInvoiceCounter(value: string): number | null {
  const match = value.match(/^(.*)(\d+)(\D*)$/);
  if (!match) return null;
  const parsed = Number(match[2]);
  return Number.isFinite(parsed) ? parsed : null;
}

function deriveInvoiceNameFromFilename(filename: string) {
  const trimmed = filename.trim();
  const lastDotIndex = trimmed.lastIndexOf(".");
  if (lastDotIndex > 0) {
    return trimmed.slice(0, lastDotIndex);
  }
  return trimmed;
}

/**
 * Check if invoice needs review and block mutations
 * Uploaded invoices with needsReview=true must be confirmed before any other action
 * Exception: Draft invoices can always be updated, even if they need review
 */
function checkInvoiceNeedsReview(invoice: Awaited<ReturnType<typeof db.getInvoiceById>>, action: string) {
  // Allow updates to draft invoices even if they need review
  if (action === "updated" && invoice.status === "draft") {
    return;
  }
  
  if (invoice.source === "uploaded" && invoice.needsReview) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `This invoice requires review before it can be ${action}. Please confirm the uploaded invoice first.`,
    });
  }
}

/**
 * Get invoice state based on timestamps + needsReview (NOT status field)
 * This is the single source of truth for UI state logic
 */
function getInvoiceState(invoice: {
  needsReview: boolean;
  sentAt: Date | null;
  paidAt: Date | null;
  amountPaid: number | string | null;
}) {
  if (invoice.needsReview) return 'REVIEW';
  if (!invoice.sentAt) return 'DRAFT';
  if (invoice.paidAt) return 'PAID';
  const amountPaid = Number(invoice.amountPaid || 0);
  if (amountPaid > 0) return 'PARTIAL';
  return 'SENT';
}

/**
 * Get derived values for invoice (never stored)
 */
function getDerivedValues(invoice: {
  total: number | string;
  amountPaid: number | string | null;
  sentAt: Date | null;
  paidAt: Date | null;
  dueDate: Date | null;
}) {
  const total = Number(invoice.total || 0);
  const amountPaid = Number(invoice.amountPaid || 0);
  const outstanding = Math.max(0, total - amountPaid);
  const isPaid = outstanding <= 0;
  const isPartial = amountPaid > 0 && outstanding > 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
  if (dueDate) dueDate.setHours(0, 0, 0, 0);
  
  const isOverdue = invoice.sentAt !== null && !isPaid && dueDate !== null && dueDate < today;
  
  return {
    outstanding,
    isPaid,
    isPartial,
    isOverdue,
  };
}

function mapInvoiceToPayload(invoice: Awaited<ReturnType<typeof db.getInvoiceById>>) {
  if (!invoice) {
    return invoice;
  }
  
  const items = (invoice.items || []).map((item) => ({
    ...item,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    lineTotal: Number(item.lineTotal),
  }));
  
  const amountPaid = Number(invoice.amountPaid || 0);
  
  return {
    ...invoice,
    items,
    subtotal: Number(invoice.subtotal),
    vatAmount: Number(invoice.vatAmount),
    total: Number(invoice.total),
    amountPaid,
    // Add derived values
    state: getInvoiceState(invoice),
    ...getDerivedValues({
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      sentAt: invoice.sentAt,
      paidAt: invoice.paidAt,
      dueDate: invoice.dueDate,
    }),
  };
}

async function withCancellationMetadata<T extends { id: number; type?: string; cancelledInvoiceId?: number | null }>(
  invoices: T[]
) {
  if (!invoices.length) return invoices;
  const ids = invoices.map((invoice) => invoice.id);
  const cancellationMap = await db.getCancellationInvoiceMapByOriginalIds(ids);
  const cancellationTargets = invoices
    .filter((invoice) => invoice.type === "cancellation" && invoice.cancelledInvoiceId)
    .map((invoice) => invoice.cancelledInvoiceId as number);
  const originalNumberMap = await db.getInvoiceNumbersByIds(cancellationTargets);
  const cancellationInvoiceIds = Array.from(new Set(Array.from(cancellationMap.values())));
  const cancellationSummaryMap = await db.getInvoiceSummariesByIds(cancellationInvoiceIds);

  return invoices.map((invoice) => {
    const cancellationOfInvoiceNumber =
      invoice.type === "cancellation" && invoice.cancelledInvoiceId
        ? originalNumberMap.get(invoice.cancelledInvoiceId) ?? null
        : null;
    if (invoice.type === "cancellation" && invoice.cancelledInvoiceId && !cancellationOfInvoiceNumber) {
      console.warn(`[Invoices] Cancellation invoice ${invoice.id} missing original invoice number.`);
    }
    const cancelledBySummary = cancellationMap.has(invoice.id)
      ? cancellationSummaryMap.get(cancellationMap.get(invoice.id) as number)
      : null;
    return {
      ...invoice,
      isCancellation: invoice.type === "cancellation",
      hasCancellation: cancellationMap.has(invoice.id),
      cancellationInvoiceId: cancellationMap.get(invoice.id) ?? null,
      cancellationOfInvoiceNumber,
      cancelledByInvoiceNumber: cancelledBySummary?.invoiceNumber ?? null,
      isCancelled: Boolean(cancelledBySummary?.sentAt),
    };
  });
}

export const invoiceRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const invoices = await db.getInvoicesByUserId(userId);
    const mapped = invoices.map(mapInvoiceToPayload);
    const withMeta = await withCancellationMetadata(mapped);
    const visible = withMeta.filter(
      (invoice) => !(invoice.hasCancellation && invoice.type !== "cancellation")
    );
    return visible;
  }),

  listArchived: protectedProcedure.query(async ({ ctx }) => {
    const invoices = await db.getArchivedInvoicesByUserId(ctx.user.id);
    return withCancellationMetadata(invoices.map(mapInvoiceToPayload));
  }),

  listTrashed: protectedProcedure.query(async ({ ctx }) => {
    const invoices = await db.getTrashedInvoicesByUserId(ctx.user.id);
    return withCancellationMetadata(invoices.map(mapInvoiceToPayload));
  }),

  listNeedsReview: protectedProcedure.query(async ({ ctx }) => {
    const invoices = await db.getNeedsReviewInvoicesByUserId(ctx.user.id);
    return invoices.map(mapInvoiceToPayload);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }
      const withMeta = await withCancellationMetadata([mapInvoiceToPayload(invoice)]);
      return withMeta[0];
    }),

  nextNumber: protectedProcedure
    .input(z.object({ issueDate: z.date().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const settings = await db.getCompanySettingsByUserId(ctx.user.id);
      const issueDate = input?.issueDate ?? new Date();
      const generated = await db.generateInvoiceNumber(
        ctx.user.id,
        issueDate,
        settings?.invoiceNumberFormat ?? null,
        settings?.invoicePrefix ?? "RE"
      );
      return generated;
    }),

  create: protectedProcedure
    .input(
      invoiceMetadataSchema.extend({
        items: z.array(lineItemSchema).min(1, "At least one line item is required"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const settings = await db.getCompanySettingsByUserId(userId);
      if (!settings) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Company settings not found. Please configure your company settings first.",
        });
      }

      const issueDate = input.issueDate ?? new Date();
      const { invoiceNumber: generatedNumber, invoiceCounter, invoiceYear } = await db.generateInvoiceNumber(
        userId,
        issueDate,
        settings.invoiceNumberFormat ?? null,
        settings.invoicePrefix ?? "RE"
      );
      const manualNumber = input.invoiceNumber?.trim();
      if (manualNumber && extractInvoiceCounter(manualNumber) === null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invoice number must include a numeric sequence.",
        });
      }
      if (manualNumber && manualNumber !== generatedNumber) {
        console.warn(
          `[Invoices] Manual invoice number override for user ${userId}: ${manualNumber} (suggested ${generatedNumber})`
        );
      }
      const invoiceNumber = manualNumber || generatedNumber;
      const manualCounter = manualNumber ? extractInvoiceCounter(manualNumber) : null;
      const effectiveCounter = manualCounter ?? invoiceCounter;
      await db.ensureUniqueInvoiceNumber(userId, invoiceNumber);

      const normalizedItems = normalizeLineItems(input.items);
      const totals = calculateTotals(normalizedItems);

      const created = await db.createInvoice({
        userId: userId,
        clientId: input.clientId ?? null,
        invoiceNumber,
        invoiceName: formatInvoiceName(invoiceNumber),
        invoiceCounter: effectiveCounter,
        invoiceYear,
        status: "draft",
        issueDate,
        dueDate: input.dueDate ?? null,
        notes: input.notes ?? null,
        terms: input.terms ?? null,
        servicePeriodStart: input.servicePeriodStart ?? null,
        servicePeriodEnd: input.servicePeriodEnd ?? null,
        referenceNumber: input.referenceNumber ?? null,
        partialInvoice: input.partialInvoice ?? false,
        subtotal: totals.subtotal.toFixed(2),
        vatAmount: totals.vatAmount.toFixed(2),
        total: totals.total.toFixed(2),
        items: normalizedItems.map((item) => ({
          ...item,
          quantity: item.quantity.toFixed(2),
          unitPrice: item.unitPrice.toFixed(2),
          lineTotal: item.lineTotal.toFixed(2),
        })),
      });

      return mapInvoiceToPayload(created);
    }),

  update: protectedProcedure
    .input(
      invoiceMetadataSchema.extend({
        id: z.number(),
        items: z.array(lineItemSchema).optional(),
        totalAmount: z.string().optional(), // For uploaded invoices to update total directly
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }
      const cancellation = await db.getCancellationInvoiceByOriginalId(invoice.id);
      if (cancellation?.sentAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cancelled invoices are read-only." });
      }
      // Archived invoices are view-only
      if (invoice.archivedAt) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Archived invoices cannot be updated" });
      }
      // Only draft invoices can be updated
      if (invoice.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft invoices can be updated" });
      }
      checkInvoiceNeedsReview(invoice, "updated");

      const settings = await db.getCompanySettingsByUserId(userId);
      if (!settings) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Company settings not found. Please configure your company settings first.",
        });
      }

      const issueDate = input.issueDate ?? invoice.issueDate ?? new Date();
      let invoiceYear = issueDate.getFullYear();
      let invoiceCounter = invoice.invoiceCounter;
      let invoiceNumber = input.invoiceNumber?.trim() || invoice.invoiceNumber;
      if (input.invoiceNumber?.trim() && extractInvoiceCounter(input.invoiceNumber.trim()) === null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invoice number must include a numeric sequence.",
        });
      }

      if (invoiceYear !== invoice.invoiceYear && !input.invoiceNumber) {
        const regenerated = await db.generateInvoiceNumber(
          userId,
          issueDate,
          settings.invoiceNumberFormat ?? null,
          settings.invoicePrefix ?? "RE"
        );
        invoiceNumber = regenerated.invoiceNumber;
        invoiceCounter = regenerated.invoiceCounter;
        invoiceYear = regenerated.invoiceYear;
      } else if (input.invoiceNumber?.trim() && input.invoiceNumber.trim() !== invoice.invoiceNumber) {
        console.warn(
          `[Invoices] Manual invoice number override for user ${userId}: ${input.invoiceNumber.trim()}`
        );
        const manualCounter = extractInvoiceCounter(input.invoiceNumber.trim());
        if (manualCounter !== null) {
          invoiceCounter = manualCounter;
        }
      }

      await db.ensureUniqueInvoiceNumber(userId, invoiceNumber, invoice.id);

      const normalizedItems = input.items
        ? normalizeLineItems(input.items)
        : (invoice.items || []).map((item) => ({
            name: item.name,
            description: item.description,
            category: item.category,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            currency: item.currency,
            lineTotal: Number(item.lineTotal),
          }));

      // For uploaded invoices, allow updates without line items (they may not have been parsed yet)
      // For created invoices, require at least one line item
      if (!normalizedItems.length && invoice.source !== "uploaded") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "At least one line item is required" });
      }
      
      // If no items provided and invoice has no items, use empty array (for uploaded invoices)
      const finalItems = normalizedItems.length > 0 ? normalizedItems : [];

      // Calculate totals - for uploaded invoices, allow direct totalAmount override
      const totals = finalItems.length > 0 
        ? calculateTotals(finalItems)
        : input.totalAmount && invoice.source === "uploaded"
        ? {
            subtotal: Number(input.totalAmount),
            vatAmount: Number(invoice.vatAmount || 0),
            total: Number(input.totalAmount),
          }
        : {
            subtotal: Number(invoice.subtotal || 0),
            vatAmount: Number(invoice.vatAmount || 0),
            total: Number(invoice.total || 0),
          };

      // Always format invoiceName as "Rechnung {invoiceNumber}" when invoiceNumber exists
      const invoiceName = formatInvoiceName(invoiceNumber);

      const updated = await db.updateInvoice(invoice.id, {
        clientId: input.clientId ?? invoice.clientId,
        invoiceNumber,
        invoiceName,
        invoiceCounter,
        invoiceYear,
        issueDate,
        dueDate: input.dueDate ?? invoice.dueDate,
        notes: input.notes ?? invoice.notes,
        terms: input.terms ?? invoice.terms,
        servicePeriodStart: input.servicePeriodStart ?? invoice.servicePeriodStart,
        servicePeriodEnd: input.servicePeriodEnd ?? invoice.servicePeriodEnd,
        referenceNumber: input.referenceNumber ?? invoice.referenceNumber,
        partialInvoice: input.partialInvoice ?? invoice.partialInvoice,
        subtotal: totals.subtotal.toFixed(2),
        vatAmount: totals.vatAmount.toFixed(2),
        total: totals.total.toFixed(2),
        items: finalItems.map((item) => ({
          ...item,
          quantity: item.quantity.toFixed(2),
          unitPrice: item.unitPrice.toFixed(2),
          lineTotal: item.lineTotal.toFixed(2),
        })),
      });

      return mapInvoiceToPayload(updated);
    }),

  issue: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }
      const cancellation = await db.getCancellationInvoiceByOriginalId(invoice.id);
      if (cancellation?.sentAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cancelled invoices are read-only." });
      }
      if (invoice.status !== "draft" || invoice.sentAt || invoice.paidAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft invoices can be issued" });
      }
      if (invoice.type === "cancellation" && !invoice.cancelledInvoiceId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cancellation invoices must reference an original invoice." });
      }
      checkInvoiceNeedsReview(invoice, "sent");

      await db.issueInvoice(invoice.id);
      const updated = await db.getInvoiceById(invoice.id);
      return mapInvoiceToPayload(updated);
    }),

  markAsPaid: protectedProcedure
    .input(z.object({ 
      id: z.number(),
      paidAt: z.date(), // REQUIRED: Payment date must be provided
      alsoMarkAsSent: z.boolean().optional() // For uploaded invoices: also set sentAt if not already set
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }
      const cancellation = await db.getCancellationInvoiceByOriginalId(invoice.id);
      if (cancellation?.sentAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cancelled invoices are read-only." });
      }
      if (invoice.paidAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice is already marked as paid" });
      }
      // For uploaded invoices (review or draft state), allow marking as paid without sentAt (historical import)
      if (invoice.source === "uploaded") {
        // Allow - this is the historical import use case
        // If alsoMarkAsSent is true, we'll set sentAt when marking as paid
        // NOTE: Backend doesn't require issueDate/total for uploaded invoices as they come from PDF parsing
        // However, if user edited metadata in review dialog, they should save first via confirmUploadedInvoice
      } else {
        // For created invoices, require sentAt
        if (!invoice.sentAt) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only sent invoices can be marked as paid" });
        }
        checkInvoiceNeedsReview(invoice, "marked as paid");
      }
      
      // Ensure invoice has required fields before marking as paid
      // This prevents marking incomplete invoices as paid
      if (!invoice.issueDate) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice must have an issue date before it can be marked as paid" });
      }
      const total = Number(invoice.total || 0);
      if (total <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice total must be greater than 0 before it can be marked as paid" });
      }

      await db.markInvoiceAsPaid(invoice.id, input.paidAt, input.alsoMarkAsSent && !invoice.sentAt);
      const updated = await db.getInvoiceById(invoice.id);
      return mapInvoiceToPayload(updated);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }
      if (invoice.status !== "draft") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only draft invoices can be permanently deleted." });
      }
      if (!invoice.trashedAt) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Invoices must be moved to the Rubbish before permanent deletion.",
        });
      }
      checkInvoiceNeedsReview(invoice, "deleted");

      await db.deleteInvoice(input.id);
      return { success: true };
    }),

  duplicate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }
      return await db.duplicateInvoice(input.id, userId);
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }
      checkInvoiceNeedsReview(invoice, "archived");

      await db.archiveInvoice(input.id);
      const updated = await db.getInvoiceById(input.id);
      return mapInvoiceToPayload(updated);
    }),

  moveToTrash: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }
      if (invoice.status !== "draft") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only draft invoices can be moved to the Rubbish." });
      }
      checkInvoiceNeedsReview(invoice, "moved to trash");

      await db.moveInvoiceToTrash(input.id);
      const updated = await db.getInvoiceById(input.id);
      return mapInvoiceToPayload(updated);
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }

      await db.restoreInvoice(input.id);
      const updated = await db.getInvoiceById(input.id);
      return mapInvoiceToPayload(updated);
    }),

  revertStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        targetStatus: z.enum(["draft", "open"]),
        confirmed: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!input.confirmed) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Confirmation is required to revert invoice status." });
      }

      const userId = ctx.user.id;
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }
      const cancellation = await db.getCancellationInvoiceByOriginalId(invoice.id);
      if (cancellation?.sentAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cancelled invoices are read-only." });
      }

      // Validate transitions: open→draft (if sent), paid→open
      const isOpenToDraft = Boolean(invoice.sentAt) && !invoice.paidAt && input.targetStatus === "draft";
      const isPaidToOpen = Boolean(invoice.paidAt) && input.targetStatus === "open";

      if (!isOpenToDraft && !isPaidToOpen) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid status transition for this invoice." });
      }
      checkInvoiceNeedsReview(invoice, "reverted");

      await db.revertInvoiceStatus(invoice.id, input.targetStatus);
      const updated = await db.getInvoiceById(invoice.id);
      return mapInvoiceToPayload(updated);
    }),

  markAsSent: protectedProcedure
    .input(z.object({ id: z.number(), confirmed: z.boolean().optional() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }
      // Allow marking as sent even if already sent - user can fix mistakes with warning dialog
      // If already sent and not confirmed, require confirmation (frontend will show warning)
      if (invoice.sentAt && !input.confirmed) {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: "Invoice has already been sent. Please confirm to proceed." 
        });
      }
      // Allow uploaded invoices in review state (Section 19 exception)
      if (invoice.source === "uploaded" && invoice.needsReview) {
        // Allow - this is the historical import use case
      } else {
        checkInvoiceNeedsReview(invoice, "sent");
      }

      await db.markInvoiceAsSent(invoice.id);
      const updated = await db.getInvoiceById(invoice.id);
      return mapInvoiceToPayload(updated);
    }),

  revertToDraft: protectedProcedure
    .input(z.object({ id: z.number(), confirmed: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      if (!input.confirmed) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Confirmation is required to revert invoice status." });
      }

      const userId = ctx.user.id;
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }
      const cancellation = await db.getCancellationInvoiceByOriginalId(invoice.id);
      if (cancellation?.sentAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cancelled invoices are read-only." });
      }

      // Backend enforces: cannot revert to draft if payments exist (db.revertInvoiceToDraft will throw)
      // This check happens in the database function, not here, to ensure no bypass
      if (!invoice.sentAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice is not in sent state" });
      }

      checkInvoiceNeedsReview(invoice, "reverted");

      // db.revertInvoiceToDraft will throw if amountPaid > 0 - backend enforcement
      await db.revertInvoiceToDraft(invoice.id);
      const updated = await db.getInvoiceById(input.id);
      return mapInvoiceToPayload(updated);
    }),

  markAsCancelled: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }

      // Only allow cancelling draft or review invoices
      const isDraft = !invoice.sentAt;
      const isReview = invoice.needsReview;
      
      if (!isDraft && !isReview) {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: "Only draft or review invoices can be cancelled" 
        });
      }

      await db.markInvoiceAsCancelled(input.id);
      const updated = await db.getInvoiceById(input.id);
      return mapInvoiceToPayload(updated);
    }),

  markAsNotCancelled: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }

      await db.markInvoiceAsNotCancelled(input.id);
      const updated = await db.getInvoiceById(input.id);
      return mapInvoiceToPayload(updated);
    }),

  revertToSent: protectedProcedure
    .input(z.object({ id: z.number(), confirmed: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      if (!input.confirmed) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Confirmation is required to revert invoice status." });
      }

      const userId = ctx.user.id;
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }
      const cancellation = await db.getCancellationInvoiceByOriginalId(invoice.id);
      if (cancellation?.sentAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cancelled invoices are read-only." });
      }

      if (!invoice.paidAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice is not in paid state" });
      }

      checkInvoiceNeedsReview(invoice, "reverted");

      await db.revertInvoiceToSent(invoice.id);
      const updated = await db.getInvoiceById(input.id);
      return mapInvoiceToPayload(updated);
    }),

  addInvoicePayment: protectedProcedure
    .input(z.object({
      id: z.number(),
      amount: z.number().positive("Payment amount must be greater than 0"),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }
      if (!invoice.sentAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only sent invoices can receive payments" });
      }
      if (invoice.paidAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice is already fully paid" });
      }

      const total = Number(invoice.total || 0);
      const currentAmountPaid = Number(invoice.amountPaid || 0);
      const outstanding = total - currentAmountPaid;

      if (input.amount > outstanding) {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: `Payment amount (${input.amount.toFixed(2)}) exceeds outstanding balance (${outstanding.toFixed(2)})` 
        });
      }

      await db.addInvoicePayment(invoice.id, input.amount);
      const updated = await db.getInvoiceById(invoice.id);
      return mapInvoiceToPayload(updated);
    }),

  createCancellation: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const invoice = await db.getInvoiceById(input.invoiceId);
        if (!invoice) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
        }
        if (invoice.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
        }
        checkInvoiceNeedsReview(invoice, "cancelled");
        
        const cancellationInvoiceId = await db.createCancellationInvoice(ctx.user.id, input.invoiceId);
        return { cancellationInvoiceId };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create cancellation invoice";
        if (message.includes("not found")) {
          throw new TRPCError({ code: "NOT_FOUND", message });
        }
        if (message.includes("access")) {
          throw new TRPCError({ code: "FORBIDDEN", message });
        }
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
    }),

  confirmUploadedInvoice: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        clientId: z.number().optional().nullable(),
        invoiceNumber: z.string().optional(),
        issueDate: z.date().optional(),
        totalAmount: z.string().optional(),
        dueDate: z.date().optional().nullable(),
        items: z.array(lineItemSchema).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const invoice = await db.getInvoiceById(input.id);
      
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      
      if (invoice.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }
      
      if (invoice.source !== "uploaded" || !invoice.needsReview) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invoice does not need review",
        });
      }
      
      // Validate required fields
      if (!input.issueDate && !invoice.issueDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invoice date is required",
        });
      }
      
      if (!input.totalAmount && !invoice.total) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Total amount is required",
        });
      }
      
      // Calculate totals if items provided
      let subtotal = invoice.subtotal;
      let total = invoice.total;
      
      if (input.items && input.items.length > 0) {
        const normalizedItems = normalizeLineItems(input.items);
        const totals = calculateTotals(normalizedItems);
        subtotal = totals.subtotal.toFixed(2);
        total = totals.total.toFixed(2);
      } else if (input.totalAmount) {
        total = input.totalAmount;
        subtotal = input.totalAmount;
      }
      
      // Update invoice with confirmed data
      // IMPORTANT: Always use input values when provided to ensure all edits are persisted
      // The client always sends issueDate and totalAmount (validated as required)
      const finalInvoiceNumber = input.invoiceNumber ?? invoice.invoiceNumber;
      // issueDate is always provided by client (validated as required)
      const finalIssueDate = input.issueDate 
        ? new Date(input.issueDate) 
        : (invoice.issueDate ? new Date(invoice.issueDate) : null);
      // dueDate: if explicitly provided in input (even if null), use it; otherwise keep existing
      const finalDueDate = input.dueDate !== undefined 
        ? (input.dueDate ? new Date(input.dueDate) : null)
        : (invoice.dueDate ? new Date(invoice.dueDate) : null);
      // clientId: if explicitly provided (even if null), use it; otherwise keep existing
      const finalClientId = input.clientId !== undefined 
        ? input.clientId 
        : invoice.clientId;
      
      const updated = await db.updateInvoice(input.id, {
        clientId: finalClientId,
        invoiceNumber: finalInvoiceNumber,
        invoiceName: formatInvoiceName(finalInvoiceNumber),
        issueDate: finalIssueDate,
        dueDate: finalDueDate,
        subtotal,
        total,
        needsReview: false, // Clear review flag - this moves invoice from Needs Review to Draft
        items: input.items
          ? normalizeLineItems(input.items).map((item) => ({
              ...item,
              quantity: item.quantity.toFixed(2),
              unitPrice: item.unitPrice.toFixed(2),
              lineTotal: item.lineTotal.toFixed(2),
            }))
          : undefined,
      });
      
      return mapInvoiceToPayload(updated);
    }),

  cancelUploadedInvoice: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const invoice = await db.getInvoiceById(input.id);
      
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      
      if (invoice.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }
      
      if (invoice.source !== "uploaded" || !invoice.needsReview) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only uploaded invoices pending review can be cancelled",
        });
      }
      
      // Delete PDF from S3 if it exists
      if (invoice.originalPdfS3Key) {
        try {
          await deleteFromStorage(invoice.originalPdfS3Key);
        } catch (error) {
          console.error("[Invoice] Failed to delete PDF from S3:", error);
          // Continue with DB delete even if S3 delete fails
        }
      }
      
      // Also try to delete from other file key fields
      const keysToDelete = [
        invoice.fileKey,
        invoice.pdfFileKey,
      ].filter((key): key is string => Boolean(key));
      
      for (const key of keysToDelete) {
        if (key !== invoice.originalPdfS3Key) {
          try {
            await deleteFromStorage(key);
          } catch (error) {
            console.error("[Invoice] Failed to delete file from S3:", error);
          }
        }
      }
      
      // Delete invoice from database
      await db.deleteInvoice(input.id);
      
      return { success: true };
    }),

  uploadInvoice: protectedProcedure
    .input(
      z.object({
        filename: z.string().min(1),
        base64Data: z.string(),
        mimeType: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      
      // Validate MIME type (must be PDF)
      const mimeType = input.mimeType || "application/pdf";
      if (!mimeType.includes("pdf")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "File must be a PDF",
        });
      }
      
      // Convert base64 to buffer
      const pdfBuffer = Buffer.from(input.base64Data, "base64");
      
      // Validate file size (max 50MB)
      const maxSize = 50 * 1024 * 1024;
      if (pdfBuffer.length > maxSize) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `File size exceeds maximum of ${maxSize / (1024 * 1024)}MB`,
        });
      }
      
      // Parse PDF to extract invoice data
      const parsedData = await parseInvoicePdf(pdfBuffer);
      
      // Upload PDF to S3
      const fileKey = generateFileKey("invoices", userId, input.filename);
      await storagePut(fileKey, pdfBuffer, mimeType);
      
      // Use parsed date or current date
      const issueDate = parsedData.invoiceDate || new Date();

      const originalFileName = input.filename;
      const invoiceName = deriveInvoiceNameFromFilename(originalFileName);
      if (!invoiceName) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice name cannot be empty." });
      }

      try {
        await db.ensureUniqueInvoiceName(userId, invoiceName);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invoice name must be unique.";
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }

      // Create invoice with needsReview flag
      const uploadedAt = new Date();
      
      // Use extracted invoice number if available, otherwise it will be auto-generated
      // Note: We don't generate a number here - if extracted number is invalid/missing,
      // the user can set it in the review dialog
      const invoiceNumber = parsedData.invoiceNumber?.trim() || null;
      
      const created = await db.createInvoice({
        userId,
        clientId: null, // Can be updated later if needed
        status: "draft",
        issueDate,
        dueDate: parsedData.dueDate || null, // Use extracted due date if available
        invoiceNumber, // Save extracted invoice number
        subtotal: parsedData.totalAmount || "0.00",
        vatAmount: "0.00",
        total: parsedData.totalAmount || "0.00",
        source: "uploaded",
        needsReview: parsedData.needsReview,
        originalPdfS3Key: fileKey,
        originalFileName,
        invoiceName,
        uploadedAt,
        pdfFileKey: fileKey,
        filename: input.filename,
        fileKey: fileKey,
        fileSize: pdfBuffer.length,
        mimeType,
        uploadDate: uploadedAt,
        uploadedBy: userId,
        items: [], // Empty items - user can add in review
      });

      return {
        invoice: mapInvoiceToPayload(created),
        parsedData: {
          clientName: parsedData.clientName,
          invoiceDate: parsedData.invoiceDate,
          totalAmount: parsedData.totalAmount,
          invoiceNumber: parsedData.invoiceNumber,
        },
      };
    }),

  uploadInvoicesBulk: protectedProcedure
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
      // Use both console.log (for PM2) and logger (for structured logging)
      logger.info({ fileCount: input.files.length }, "[Invoice Bulk Upload] ===== BULK UPLOAD CALLED =====");
      console.log("[Invoice Bulk Upload] ===== BULK UPLOAD CALLED =====");
      console.log("[Invoice Bulk Upload] Files count:", input.files.length);
      
      const userId = ctx.user.id;
      console.log("[Invoice Bulk Upload] User ID:", userId);
      
      const createdInvoiceIds: number[] = [];
      const errors: Array<{ filename: string; error: string }> = [];
      const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

      // Process each file independently
      for (const file of input.files) {
        console.log("[Invoice Bulk Upload] Processing file:", file.filename);
        let invoiceId: number | null = null;
        try {
          // Validate file size
          if (file.fileSize > MAX_FILE_SIZE) {
            console.error("[Invoice Bulk Upload] File too large:", file.filename, file.fileSize);
            throw new Error(
              `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`
            );
          }

          // Validate MIME type (must be PDF)
          const mimeType = file.mimeType || "application/pdf";
          console.log("[Invoice Bulk Upload] MIME type:", mimeType);
          if (!mimeType.includes("pdf")) {
            console.error("[Invoice Bulk Upload] Invalid MIME type:", mimeType);
            throw new Error("File must be a PDF");
          }

          // Convert base64 to buffer
          console.log("[Invoice Bulk Upload] Converting base64 to buffer...");
          const fileBuffer = Buffer.from(file.base64Data, "base64");
          if (fileBuffer.length === 0) {
            console.error("[Invoice Bulk Upload] Empty buffer after conversion");
            throw new Error("Invalid base64 data");
          }
          console.log("[Invoice Bulk Upload] Buffer created, size:", fileBuffer.length);

          // Process document with AI OCR (same as documents.process)
          console.log("[Invoice Bulk Upload] Importing OCR modules...");
          const { processDocumentOcr } = await import("./services/ai/document/documentOcrClient");
          const { normalizeExtractedData } = await import("./services/ai/document/normalizeExtractedData");
          const { matchClient } = await import("./services/ai/document/clientMatching");
          
          // Helper to convert cents to decimal string
          const centsToDecimal = (cents: number | null): string => {
            if (cents === null) return "0.00";
            return (cents / 100).toFixed(2);
          };
          
          console.log("[Invoice Bulk Upload] About to call processDocumentOcr...");
          let normalized;
          try {
            console.log("[Invoice Bulk Upload] Calling processDocumentOcr with:", {
              filename: file.filename,
              mimeType,
              fileBufferSize: fileBuffer.length,
            });
            
            const raw = await processDocumentOcr({
              fileBuffer,
              mimeType,
              filename: file.filename,
              languageHint: undefined,
            });
            
            console.log("[Invoice Bulk Upload] processDocumentOcr returned successfully");
            normalized = normalizeExtractedData(raw);
            console.log("[Invoice Bulk Upload] Data normalized successfully");
          } catch (error) {
            console.error("[Invoice Bulk Upload] OCR processing failed:", error);
            console.error("[Invoice Bulk Upload] Error details:", {
              name: error instanceof Error ? error.name : "Unknown",
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            });
            throw new Error(
              error instanceof Error 
                ? `Document processing failed: ${error.message}`
                : "Document processing failed. Please try again."
            );
          }

          // Upload original file to S3
          const s3Key = generateFileKey("invoices", file.filename);
          let uploadedS3Key: string;
          try {
            const uploadResult = await storagePut(s3Key, fileBuffer, mimeType);
            uploadedS3Key = uploadResult.key;
          } catch (error) {
            console.error("[Invoice Bulk Upload] S3 upload failed:", error);
            throw new Error("Failed to store document. Please try again.");
          }

          // Create staging invoice with extracted data
          // IMPORTANT: Do NOT default to today's date - use extracted date or null
          // If extraction failed, leave it null so user can set it manually
          const issueDate = normalized.issueDate || null;
          const invoiceYear = issueDate ? issueDate.getFullYear() : new Date().getFullYear();
          
          // Log extraction results for debugging
          console.log("[Invoice Bulk Upload] Extracted data for", file.filename, ":", {
            invoiceNumber: normalized.invoiceNumber,
            issueDate: normalized.issueDate,
            dueDate: normalized.dueDate,
            clientName: normalized.clientName,
            totalCents: normalized.totalCents,
            itemsCount: normalized.items.length,
            confidence: normalized.confidence.overall,
          });

          // Generate invoice number if not extracted
          let invoiceNumber = normalized.invoiceNumber;
          let invoiceCounter = 0;
          if (!invoiceNumber) {
            const settings = await db.getCompanySettingsByUserId(userId);
            if (settings) {
              // Use extracted date if available, otherwise use current date for invoice number generation
              const dateForInvoiceNumber = issueDate || new Date();
              const generated = await db.generateInvoiceNumber(
                userId,
                dateForInvoiceNumber,
                settings.invoiceNumberFormat ?? null,
                settings.invoicePrefix ?? "RE"
              );
              invoiceNumber = generated.invoiceNumber;
              invoiceCounter = generated.invoiceCounter;
            } else {
              // Fallback: generate a simple number
              invoiceNumber = `INV-${invoiceYear}-${Date.now()}`;
            }
          } else {
            // Extract counter from invoice number if possible
            const match = invoiceNumber.match(/(\d+)$/);
            if (match) {
              invoiceCounter = parseInt(match[1], 10) || 0;
            }
          }

          // Derive invoice name from filename
          const invoiceName = file.filename.replace(/\.[^/.]+$/, "");

          // Match client (non-destructive - only preselect if confidence is high)
          const clientMatch = await matchClient(normalized.clientName, userId, 0.85);
          const matchedClientId = clientMatch.matchedClientId; // May be null if confidence too low

          // Check for unique invoice name
          try {
            await db.ensureUniqueInvoiceName(userId, invoiceName);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Invoice name must be unique";
            throw new Error(message);
          }

          // Create invoice with needsReview=true
          const uploadedAt = new Date();
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
            originalFileName: file.filename,
            uploadedAt,
            uploadedBy: userId,
            mimeType,
            fileSize: fileBuffer.length,
            items: normalized.items.map((item) => ({
              name: item.name,
              description: item.description,
              quantity: item.quantity,
              unitPrice: centsToDecimal(item.unitPriceCents),
              currency: normalized.currency,
            })),
          });

          invoiceId = created.id;
          createdInvoiceIds.push(created.id);
        } catch (error) {
          // If invoice was created but something else failed, try to clean up
          if (invoiceId) {
            try {
              await db.deleteInvoice(invoiceId);
            } catch (cleanupError) {
              console.error("[Invoice Bulk Upload] Failed to cleanup invoice:", cleanupError);
            }
          }

          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          errors.push({
            filename: file.filename,
            error: errorMessage,
          });
        }
      }

      return {
        success: createdInvoiceIds.length,
        errors: errors.length > 0 ? errors : undefined,
      };
    }),

  // TEMPORARY DEBUG ENDPOINT - Remove after diagnosis
  debug: protectedProcedure.query(async ({ ctx }) => {
    const userId = db.getUserIdFromUser(ctx.user);
    const allInvoices = await db.getInvoicesByUserId(userId);
    
    // Check RE-2025-0001 specifically using direct DB query
    const dbInstance = await db.getDb();
    if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
    
    const { eq } = await import("drizzle-orm");
    const { invoices: invoicesTable } = await import("../drizzle/schema");
    
    const re20250001 = await dbInstance
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.invoiceNumber, "RE-2025-0001"))
      .limit(1);
    
    return {
      currentUser: {
        id: ctx.user.id,
        supabaseId: ctx.user.supabaseId,
        email: ctx.user.email,
      },
      resolvedUserId: userId,
      invoicesFound: allInvoices.length,
      invoiceNumbers: allInvoices.map(i => i.invoiceNumber),
      re20250001: re20250001.length > 0 ? {
        id: re20250001[0].id,
        invoiceNumber: re20250001[0].invoiceNumber,
        userId: re20250001[0].userId,
        archivedAt: re20250001[0].archivedAt,
        trashedAt: re20250001[0].trashedAt,
        status: re20250001[0].status,
      } : null,
    };
  }),
});
