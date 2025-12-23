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
    const invoices = await db.getInvoicesByUserId(ctx.user.id);
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
      return mapInvoiceToPayload(invoice);
    }),

  nextNumber: protectedProcedure
    .input(z.object({ issueDate: z.date().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const settings = await db.getCompanySettingsByUserId(ctx.user.id);
      const prefix = settings?.invoicePrefix || "RE";
      const issueDate = input?.issueDate ?? new Date();
      const generated = await db.generateInvoiceNumber(ctx.user.id, issueDate, prefix);
      return generated;
    }),

  create: protectedProcedure
    .input(
      invoiceMetadataSchema.extend({
        items: z.array(lineItemSchema).min(1, "At least one line item is required"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const settings = await db.getCompanySettingsByUserId(ctx.user.id);
      if (!settings) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Company settings not found. Please configure your company settings first.",
        });
      }

      const issueDate = input.issueDate ?? new Date();
      const { invoiceNumber: generatedNumber, invoiceCounter, invoiceYear } = await db.generateInvoiceNumber(
        ctx.user.id,
        issueDate,
        settings.invoicePrefix || "RE"
      );
      const invoiceNumber = input.invoiceNumber?.trim() || generatedNumber;
      await db.ensureUniqueInvoiceNumber(ctx.user.id, invoiceNumber);

      const normalizedItems = normalizeLineItems(input.items);
      const totals = calculateTotals(normalizedItems);

      const created = await db.createInvoice({
        userId: ctx.user.id,
        clientId: input.clientId ?? null,
        invoiceNumber,
        invoiceCounter,
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
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }
      if (invoice.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft invoices can be updated" });
      }

      const settings = await db.getCompanySettingsByUserId(ctx.user.id);
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

      if (invoiceYear !== invoice.invoiceYear && !input.invoiceNumber) {
        const regenerated = await db.generateInvoiceNumber(ctx.user.id, issueDate, settings.invoicePrefix || "RE");
        invoiceNumber = regenerated.invoiceNumber;
        invoiceCounter = regenerated.invoiceCounter;
        invoiceYear = regenerated.invoiceYear;
      }

      await db.ensureUniqueInvoiceNumber(ctx.user.id, invoiceNumber, invoice.id);

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
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }
      if (invoice.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft invoices can be issued" });
      }

      const updated = await db.updateInvoice(invoice.id, { status: "sent" });
      return mapInvoiceToPayload(updated);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (invoice.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
      }
      if (invoice.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft invoices can be deleted" });
      }

      await db.deleteInvoice(input.id);
      return { success: true };
    }),
});
