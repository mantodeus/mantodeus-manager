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

/**
 * Check if invoice needs review and block mutations
 * Uploaded invoices with needsReview=true must be confirmed before any other action
 */
function checkInvoiceNeedsReview(invoice: Awaited<ReturnType<typeof db.getInvoiceById>>, action: string) {
  if (invoice.source === "uploaded" && invoice.needsReview) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `This invoice requires review before it can be ${action}. Please confirm the uploaded invoice first.`,
    });
  }
}

function mapInvoiceToPayload(invoice: Awaited<ReturnType<typeof db.getInvoiceById>>) {
  try {
    console.error('[TRACE] mapInvoiceToPayload START - invoice.id:', invoice?.id);
    if (!invoice) {
      console.error('[TRACE] mapInvoiceToPayload - invoice is null/undefined, returning early');
      return invoice;
    }
    
    console.error('[TRACE] mapInvoiceToPayload - processing items, count:', invoice.items?.length || 0);
    const items = (invoice.items || []).map((item) => ({
      ...item,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
    }));
    console.error('[TRACE] mapInvoiceToPayload - items mapped, count:', items.length);
    
    console.error('[TRACE] mapInvoiceToPayload - creating return object');
    const result = {
      ...invoice,
      items,
      subtotal: Number(invoice.subtotal),
      vatAmount: Number(invoice.vatAmount),
      total: Number(invoice.total),
    };
    console.error('[TRACE] mapInvoiceToPayload - return object created, invoice.id:', result.id);
    return result;
  } catch (err) {
    console.error('[TRACE] mapInvoiceToPayload ERROR');
    console.error('[TRACE] mapInvoiceToPayload error type:', err instanceof Error ? err.constructor.name : typeof err);
    console.error('[TRACE] mapInvoiceToPayload error message:', err instanceof Error ? err.message : String(err));
    console.error('[TRACE] mapInvoiceToPayload error stack:', err instanceof Error ? err.stack : 'No stack trace');
    throw err;
  }
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
    console.error('[TRACE] invoices.list start');
    
    try {
      console.error('[TRACE] invoices.list - ctx received');
      console.error('[TRACE] invoices.list - ctx.user exists:', !!ctx.user);
      console.error('[TRACE] invoices.list - ctx.user.id:', ctx.user?.id, 'type:', typeof ctx.user?.id);
      
      // ctx.user.id is already the correct INT from the database User object
      // No need for conversion - use it directly
      const userId = ctx.user.id;
      console.error('[TRACE] invoices.list - userId extracted:', userId);
      console.error(`[Invoices Router] list query - userId: ${userId} (type: ${typeof userId})`);
      
      console.error('[TRACE] invoices.list - before getInvoicesByUserId call');
      const invoices = await db.getInvoicesByUserId(userId);
      console.error('[TRACE] invoices.list - after getInvoicesByUserId call, invoices.length:', invoices.length);
      console.error(`[Invoices Router] Returning ${invoices.length} invoices`);
      
      console.error('[TRACE] invoices.list - before mapInvoiceToPayload');
      const mapped = invoices.map(mapInvoiceToPayload);
      console.error('[TRACE] invoices.list - after mapInvoiceToPayload, mapped.length:', mapped.length);
      const withMeta = await withCancellationMetadata(mapped);
      const visible = withMeta.filter(
        (invoice) => !(invoice.hasCancellation && invoice.type !== "cancellation")
      );
      console.error('[TRACE] invoices.list - returning result');
      return visible;
    } catch (err) {
      console.error('[TRACE] invoices.list ERROR caught');
      console.error('[TRACE] invoices.list error type:', err instanceof Error ? err.constructor.name : typeof err);
      console.error('[TRACE] invoices.list error message:', err instanceof Error ? err.message : String(err));
      console.error('[TRACE] invoices.list error stack:', err instanceof Error ? err.stack : 'No stack trace');
      console.error('[TRACE] invoices.list full error object:', err);
      throw err;
    }
  }),

  listArchived: protectedProcedure.query(async ({ ctx }) => {
    const invoices = await db.getArchivedInvoicesByUserId(ctx.user.id);
    return withCancellationMetadata(invoices.map(mapInvoiceToPayload));
  }),

  listTrashed: protectedProcedure.query(async ({ ctx }) => {
    const invoices = await db.getTrashedInvoicesByUserId(ctx.user.id);
    return withCancellationMetadata(invoices.map(mapInvoiceToPayload));
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

      if (!normalizedItems.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "At least one line item is required" });
      }

      const totals = calculateTotals(normalizedItems);

      const updated = await db.updateInvoice(invoice.id, {
        clientId: input.clientId ?? invoice.clientId,
        invoiceNumber,
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
        items: normalizedItems.map((item) => ({
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
          message: "Invoices must be moved to the Rubbish bin before permanent deletion.",
        });
      }
      checkInvoiceNeedsReview(invoice, "deleted");

      await db.deleteInvoice(input.id);
      return { success: true };
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
        throw new TRPCError({ code: "FORBIDDEN", message: "Only draft invoices can be moved to the Rubbish bin." });
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
      
      // Get company settings for invoice number generation
      const settings = await db.getCompanySettingsByUserId(userId);
      if (!settings) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Company settings not found. Please configure your company settings first.",
        });
      }
      
      // Use parsed date or current date
      const issueDate = parsedData.invoiceDate || new Date();
      
      // Generate invoice number (parsed invoice number is only a hint, not auto-saved)
      // User must confirm in review dialog to avoid collisions
      const { invoiceNumber: generatedNumber, invoiceCounter, invoiceYear } = await db.generateInvoiceNumber(
        userId,
        issueDate,
        settings.invoiceNumberFormat ?? null,
        settings.invoicePrefix ?? "RE"
      );
      
      // Always use generated number - parsed number is only for pre-filling review dialog
      const invoiceNumber = generatedNumber;
      
      // Create invoice and immediately mark it as issued (uploaded invoices are finalised)
      const uploadedAt = new Date();
      const created = await db.createInvoice({
        userId,
        clientId: null, // Can be updated later if needed
        invoiceNumber,
        invoiceCounter,
        invoiceYear,
        status: "draft",
        issueDate,
        dueDate: null,
        subtotal: parsedData.totalAmount || "0.00",
        vatAmount: "0.00",
        total: parsedData.totalAmount || "0.00",
        source: "uploaded",
        needsReview: false,
        originalPdfS3Key: fileKey,
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

      await db.issueInvoice(created.id);
      const finalized = await db.getInvoiceById(created.id);
      if (!finalized) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to load uploaded invoice" });
      }

      return {
        invoice: mapInvoiceToPayload(finalized),
        parsedData: {
          clientName: parsedData.clientName,
          invoiceDate: parsedData.invoiceDate,
          totalAmount: parsedData.totalAmount,
          invoiceNumber: parsedData.invoiceNumber,
        },
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
