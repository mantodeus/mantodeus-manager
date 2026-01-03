import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { parseInvoicePdf } from "./_core/pdfParser";
import { storagePut, generateFileKey, deleteFromStorage } from "./storage";

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
  
  return {
    ...invoice,
    items,
    subtotal: Number(invoice.subtotal),
    vatAmount: Number(invoice.vatAmount),
    total: Number(invoice.total),
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
        invoiceCounter: effectiveCounter,
        invoiceYear,
        status: "draft",
        issueDate,
        dueDate: input.dueDate ?? null,
        notes: input.notes ?? null,
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

      // Calculate totals - for uploaded invoices without items, preserve existing totals
      const totals = finalItems.length > 0 
        ? calculateTotals(finalItems)
        : {
            subtotal: Number(invoice.subtotal || 0),
            vatAmount: Number(invoice.vatAmount || 0),
            total: Number(invoice.total || 0),
          };

      // Sync invoiceName with invoiceNumber when invoiceNumber changes
      const invoiceName = (input.invoiceNumber?.trim() && input.invoiceNumber.trim() !== invoice.invoiceNumber)
        ? invoiceNumber
        : invoice.invoiceName;

      const updated = await db.updateInvoice(invoice.id, {
        clientId: input.clientId ?? invoice.clientId,
        invoiceNumber,
        invoiceName,
        invoiceCounter,
        invoiceYear,
        issueDate,
        dueDate: input.dueDate ?? invoice.dueDate,
        notes: input.notes ?? invoice.notes,
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
      if (!invoice.sentAt || invoice.paidAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only sent invoices can be marked as paid" });
      }
      checkInvoiceNeedsReview(invoice, "marked as paid");

      await db.markInvoiceAsPaid(invoice.id);
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
      const updated = await db.updateInvoice(input.id, {
        clientId: input.clientId ?? invoice.clientId,
        invoiceNumber: input.invoiceNumber ?? invoice.invoiceNumber,
        issueDate: input.issueDate ? new Date(input.issueDate) : invoice.issueDate,
        subtotal,
        total,
        needsReview: false, // Clear review flag
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
      const created = await db.createInvoice({
        userId,
        clientId: null, // Can be updated later if needed
        status: "draft",
        issueDate,
        dueDate: null,
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
      const userId = ctx.user.id;
      const createdInvoiceIds: number[] = [];
      const errors: Array<{ filename: string; error: string }> = [];
      const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

      // Process each file independently
      for (const file of input.files) {
        let invoiceId: number | null = null;
        try {
          // Validate file size
          if (file.fileSize > MAX_FILE_SIZE) {
            throw new Error(
              `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`
            );
          }

          // Validate MIME type (must be PDF)
          const mimeType = file.mimeType || "application/pdf";
          if (!mimeType.includes("pdf")) {
            throw new Error("File must be a PDF");
          }

          // Validate base64 data
          const pdfBuffer = Buffer.from(file.base64Data, "base64");
          if (pdfBuffer.length === 0) {
            throw new Error("Invalid base64 data");
          }

          // Parse PDF to extract invoice data
          const parsedData = await parseInvoicePdf(pdfBuffer);

          // Generate S3 key
          const fileKey = generateFileKey("invoices", userId, file.filename);

          // Upload PDF to S3
          await storagePut(fileKey, pdfBuffer, mimeType);

          // Use parsed date or current date
          const issueDate = parsedData.invoiceDate || new Date();

          const originalFileName = file.filename;
          const invoiceName = deriveInvoiceNameFromFilename(originalFileName);
          if (!invoiceName) {
            throw new Error("Invoice name cannot be empty");
          }

          // Check for unique invoice name (skip if duplicate, but don't fail the whole batch)
          try {
            await db.ensureUniqueInvoiceName(userId, invoiceName);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Invoice name must be unique";
            throw new Error(message);
          }

          // Create invoice with needsReview flag
          const uploadedAt = new Date();
          const created = await db.createInvoice({
            userId,
            clientId: null,
            status: "draft",
            issueDate,
            dueDate: null,
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
            filename: file.filename,
            fileKey: fileKey,
            fileSize: pdfBuffer.length,
            mimeType,
            uploadDate: uploadedAt,
            uploadedBy: userId,
            items: [], // Empty items - user can add in review
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
