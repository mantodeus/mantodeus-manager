import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";

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

function mapInvoiceToPayload(invoice: Awaited<ReturnType<typeof db.getInvoiceById>>) {
  if (!invoice) return invoice;
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

export const invoiceRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      const userId = db.getUserIdFromUser(ctx.user);
      console.log(`[Invoices Router] list query - ctx.user.id: ${ctx.user.id}, resolved userId: ${userId}`);
      const invoices = await db.getInvoicesByUserId(userId);
      console.log(`[Invoices Router] Returning ${invoices.length} invoices`);
      return invoices.map(mapInvoiceToPayload);
    } catch (error) {
      console.error(`[Invoices Router] Error in list query:`, error);
      throw error;
    }
  }),

  listArchived: protectedProcedure.query(async ({ ctx }) => {
    const userId = db.getUserIdFromUser(ctx.user);
    const invoices = await db.getArchivedInvoicesByUserId(userId);
    return invoices.map(mapInvoiceToPayload);
  }),

  listTrashed: protectedProcedure.query(async ({ ctx }) => {
    const userId = db.getUserIdFromUser(ctx.user);
    const invoices = await db.getTrashedInvoicesByUserId(userId);
    return invoices.map(mapInvoiceToPayload);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const userId = db.getUserIdFromUser(ctx.user);
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }
      return mapInvoiceToPayload(invoice);
    }),

  nextNumber: protectedProcedure
    .input(z.object({ issueDate: z.date().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const userId = db.getUserIdFromUser(ctx.user);
      const settings = await db.getCompanySettingsByUserId(userId);
      const issueDate = input?.issueDate ?? new Date();
      const generated = await db.generateInvoiceNumber(
        userId,
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
      const userId = db.getUserIdFromUser(ctx.user);
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
      const userId = db.getUserIdFromUser(ctx.user);
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }
      // Archived invoices are view-only
      if (invoice.archivedAt) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Archived invoices cannot be updated" });
      }
      // Only draft invoices can be updated
      if (invoice.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft invoices can be updated" });
      }

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
      const userId = db.getUserIdFromUser(ctx.user);
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }
      if (invoice.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft invoices can be issued" });
      }

      await db.issueInvoice(invoice.id);
      const updated = await db.getInvoiceById(invoice.id);
      return mapInvoiceToPayload(updated);
    }),

  markAsPaid: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const userId = db.getUserIdFromUser(ctx.user);
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }
      // Can mark as paid if status is 'open' (regardless of sentAt)
      if (invoice.status !== "open" && invoice.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only open or draft invoices can be marked as paid" });
      }

      await db.markInvoiceAsPaid(invoice.id);
      const updated = await db.getInvoiceById(invoice.id);
      return mapInvoiceToPayload(updated);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const userId = db.getUserIdFromUser(ctx.user);
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

      await db.deleteInvoice(input.id);
      return { success: true };
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const userId = db.getUserIdFromUser(ctx.user);
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }

      await db.archiveInvoice(input.id);
      const updated = await db.getInvoiceById(input.id);
      return mapInvoiceToPayload(updated);
    }),

  moveToTrash: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const userId = db.getUserIdFromUser(ctx.user);
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

      await db.moveInvoiceToTrash(input.id);
      const updated = await db.getInvoiceById(input.id);
      return mapInvoiceToPayload(updated);
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const userId = db.getUserIdFromUser(ctx.user);
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

      const userId = db.getUserIdFromUser(ctx.user);
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }

      // Validate transitions: open→draft (if sent), paid→open
      const isOpenToDraft = invoice.status === "open" && input.targetStatus === "draft";
      const isPaidToOpen = invoice.status === "paid" && input.targetStatus === "open";

      if (!isOpenToDraft && !isPaidToOpen) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid status transition for this invoice." });
      }

      await db.revertInvoiceStatus(invoice.id, input.targetStatus);
      const updated = await db.getInvoiceById(invoice.id);
      return mapInvoiceToPayload(updated);
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
