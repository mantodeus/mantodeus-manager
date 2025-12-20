import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { renderPDF } from "./services/pdfService";
import { generateInvoiceHTML } from "./templates/invoice";
import { storagePut, generateFileKey } from "./storage";

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

export const invoiceRouter = router({
  /**
   * List all invoices for the current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return await db.getInvoicesByUserId(ctx.user.id);
  }),

  /**
   * Get a single invoice by ID
   */
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found",
        });
      }
      if (invoice.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this invoice",
        });
      }
      return invoice;
    }),

  /**
   * Create a new invoice as draft
   */
  create: protectedProcedure
    .input(
      z.object({
        contactId: z.number().optional(),
        items: z.array(invoiceItemSchema).default([]),
        notes: z.string().optional(),
        dueDate: z.date().optional(),
        invoiceDate: z.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Get company settings for VAT calculation
      const companySettings = await db.getCompanySettingsByUserId(ctx.user.id);
      if (!companySettings) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Company settings not found. Please configure your company settings first.",
        });
      }

      // Calculate totals
      const items = input.items.map((item) => ({
        ...item,
        total: item.quantity * item.unitPrice,
      }));
      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const vatAmount = companySettings.isKleinunternehmer
        ? 0
        : subtotal * (Number(companySettings.vatRate) / 100);
      const total = subtotal + vatAmount;

      // Create invoice as draft
      const invoice = await db.createInvoice({
        status: "draft",
        contactId: input.contactId || null,
        items: items as any,
        subtotal: subtotal.toString(),
        vatAmount: vatAmount.toString(),
        total: total.toString(),
        notes: input.notes || null,
        invoiceDate: input.invoiceDate || new Date(),
        dueDate: input.dueDate || null,
        userId: ctx.user.id,
      });

      return invoice;
    }),

  /**
   * Update an invoice (only allowed for drafts)
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        contactId: z.number().optional().nullable(),
        items: z.array(invoiceItemSchema).optional(),
        notes: z.string().optional().nullable(),
        dueDate: z.date().optional().nullable(),
        invoiceDate: z.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found",
        });
      }
      if (invoice.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this invoice",
        });
      }
      if (invoice.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft invoices can be updated",
        });
      }

      // Get company settings for VAT calculation
      const companySettings = await db.getCompanySettingsByUserId(ctx.user.id);
      if (!companySettings) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Company settings not found",
        });
      }

      // Calculate totals if items are provided
      let items = invoice.items as Array<{
        description: string;
        quantity: number;
        unitPrice: number;
        total: number;
      }>;
      let subtotal = Number(invoice.subtotal);
      let vatAmount = Number(invoice.vatAmount);
      let total = Number(invoice.total);

      if (input.items) {
        items = input.items.map((item) => ({
          ...item,
          total: item.quantity * item.unitPrice,
        }));
        subtotal = items.reduce((sum, item) => sum + item.total, 0);
        vatAmount = companySettings.isKleinunternehmer
          ? 0
          : subtotal * (Number(companySettings.vatRate) / 100);
        total = subtotal + vatAmount;
      }

      // Update invoice
      const updated = await db.updateInvoice(input.id, {
        contactId: input.contactId !== undefined ? input.contactId : invoice.contactId,
        items: items as any,
        subtotal: subtotal.toString(),
        vatAmount: vatAmount.toString(),
        total: total.toString(),
        notes: input.notes !== undefined ? input.notes : invoice.notes,
        dueDate: input.dueDate !== undefined ? input.dueDate : invoice.dueDate,
        invoiceDate: input.invoiceDate || invoice.invoiceDate,
      });

      return updated;
    }),

  /**
   * Issue an invoice (assigns number, generates PDF, locks it)
   */
  issue: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found",
        });
      }
      if (invoice.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this invoice",
        });
      }
      if (invoice.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft invoices can be issued",
        });
      }

      // Get company settings
      const companySettings = await db.getCompanySettingsByUserId(ctx.user.id);
      if (!companySettings) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Company settings not found",
        });
      }

      // Generate invoice number
      const invoiceNumber = `${companySettings.invoicePrefix}-${new Date().getFullYear()}-${String(companySettings.nextInvoiceNumber).padStart(4, "0")}`;
      await db.incrementInvoiceNumber(ctx.user.id);

      // Get client contact if linked
      let client = null;
      if (invoice.contactId) {
        const contact = await db.getContactById(invoice.contactId);
        if (contact) {
          client = {
            name: contact.name,
            address: contact.address,
          };
        }
      }

      // Generate PDF
      const html = generateInvoiceHTML({
        invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        company: companySettings,
        client,
        items: invoice.items as Array<{
          description: string;
          quantity: number;
          unitPrice: number;
          total: number;
        }>,
        subtotal: Number(invoice.subtotal),
        vatAmount: Number(invoice.vatAmount),
        total: Number(invoice.total),
        notes: invoice.notes || undefined,
        logoUrl: "",
      });

      const pdfBuffer = await renderPDF(html);

      // Upload PDF to S3
      const timestamp = Date.now();
      const fileKey = generateFileKey("pdfs", ctx.user.id, `invoice-${invoiceNumber}-${timestamp}.pdf`);
      await storagePut(fileKey, pdfBuffer, "application/pdf");

      // Update invoice: set status, number, PDF reference, issued date
      const updated = await db.updateInvoice(input.id, {
        status: "issued",
        invoiceNumber,
        pdfFileKey: fileKey,
        issuedAt: new Date(),
      });

      return updated;
    }),

  /**
   * Delete an invoice (only drafts)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const invoice = await db.getInvoiceById(input.id);
      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found",
        });
      }
      if (invoice.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this invoice",
        });
      }
      if (invoice.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft invoices can be deleted",
        });
      }

      await db.deleteInvoice(input.id);
      return { success: true };
    }),
});

