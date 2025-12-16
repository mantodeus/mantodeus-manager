import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { generatePDF } from "./services/pdfService";
import { generateProjectReportHTML } from "./templates/projectReport";
import { generateInvoiceHTML } from "./templates/invoice";
import { generateInspectionHTML } from "./templates/inspection";
import * as db from "./db";
import { storagePut, createPresignedReadUrl, generateFileKey } from "./storage";
import { nanoid } from "nanoid";
import { ENV } from "./_core/env";

export const pdfRouter = router({
  /**
   * Generate a project report PDF
   */
  generateProjectReport: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const project = await db.getProjectById(input.projectId);
      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Get client contact if linked
      let clientContact = null;
      if (project.clientId) {
        const contact = await db.getContactById(project.clientId);
        if (contact) {
          clientContact = {
            name: contact.name,
            address: contact.address,
          };
        }
      }

      // Get jobs for this project
      const jobs = await db.getProjectJobsByProjectId(input.projectId);

      // Get files (images) for this project
      const files = await db.getFilesByProjectId(input.projectId);
      
      // Generate signed URLs for images
      const filesWithUrls = await Promise.all(
        files
          .filter((f: typeof files[0]) => f.mimeType?.startsWith('image/'))
          .slice(0, 10) // Limit to first 10 images
          .map(async (file: typeof files[0]) => {
            try {
              const signedUrl = await createPresignedReadUrl(file.s3Key, 3600); // 1 hour
              return { ...file, signedUrl };
            } catch {
              return file;
            }
          })
      );

      // Get company settings for logo/name
      const companySettings = await db.getCompanySettingsByUserId(ctx.user.id);
      const logoUrl = companySettings ? '' : ''; // TODO: Add logo URL to settings
      const companyName = companySettings?.companyName || 'Mantodeus Manager';

      // Generate HTML
      const html = generateProjectReportHTML({
        project: {
          ...project,
          clientContact: clientContact ? {
            name: clientContact.name,
            address: clientContact.address,
          } : null,
        },
        jobs,
        files: filesWithUrls,
        logoUrl,
        companyName,
      });

      // Generate PDF
      const pdfBuffer = await generatePDF(html);

      // Upload to S3
      const timestamp = Date.now();
      const fileKey = generateFileKey('pdfs', ctx.user.id, `project-report-${input.projectId}-${timestamp}.pdf`);
      await storagePut(fileKey, pdfBuffer, 'application/pdf');

      // Create shared document record
      const shareToken = nanoid(32);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + ENV.pdfExpiryDefaultHours);

      await db.createSharedDocument({
        documentType: 'project_report',
        referenceId: input.projectId,
        s3Key: fileKey,
        shareToken,
        expiresAt,
        createdBy: ctx.user.id,
      });

      // Generate shareable URL
      const shareUrl = `${ENV.appUrl}/share/${shareToken}`;

      return {
        success: true,
        shareUrl,
        fileKey,
      };
    }),

  /**
   * Generate an invoice PDF
   */
  generateInvoice: protectedProcedure
    .input(
      z.object({
        invoiceId: z.number().optional(),
        clientId: z.number().optional(),
        items: z.array(
          z.object({
            description: z.string(),
            quantity: z.number(),
            unitPrice: z.number(),
          })
        ),
        notes: z.string().optional(),
        dueDate: z.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Get company settings
      let companySettings = await db.getCompanySettingsByUserId(ctx.user.id);
      
      // Create default settings if none exist
      if (!companySettings) {
        await db.createCompanySettings({
          userId: ctx.user.id,
          companyName: ctx.user.name || 'Mantodeus Manager',
          isKleinunternehmer: false,
          vatRate: '19.00',
          invoicePrefix: 'RE',
          nextInvoiceNumber: 1,
        });
        companySettings = await db.getCompanySettingsByUserId(ctx.user.id);
        if (!companySettings) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create company settings",
          });
        }
      }

      // Get client if provided
      let client: { id: number; name: string; address: string | null } | null = null;
      if (input.clientId) {
        const contact = await db.getContactById(input.clientId);
        if (contact) {
          client = {
            id: contact.id,
            name: contact.name,
            address: contact.address,
          };
        }
      }

      // Generate invoice number
      const invoiceNumber = `${companySettings.invoicePrefix}-${new Date().getFullYear()}-${String(companySettings.nextInvoiceNumber).padStart(4, '0')}`;
      await db.incrementInvoiceNumber(ctx.user.id);

      // Calculate totals
      const items = input.items.map(item => ({
        ...item,
        total: item.quantity * item.unitPrice,
      }));
      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const vatAmount = companySettings.isKleinunternehmer ? 0 : subtotal * (Number(companySettings.vatRate) / 100);
      const total = subtotal + vatAmount;

      // Generate HTML
      const html = generateInvoiceHTML({
        invoiceNumber,
        invoiceDate: new Date(),
        dueDate: input.dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Default 14 days
        company: companySettings,
        client,
        items,
        subtotal,
        vatAmount,
        total,
        notes: input.notes,
        logoUrl: '', // TODO: Add logo URL to settings
      });

      // Generate PDF
      const pdfBuffer = await generatePDF(html);

      // Upload to S3
      const timestamp = Date.now();
      const fileKey = generateFileKey('pdfs', ctx.user.id, `invoice-${invoiceNumber}-${timestamp}.pdf`);
      await storagePut(fileKey, pdfBuffer, 'application/pdf');

      // Create shared document record
      const shareToken = nanoid(32);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + ENV.pdfExpiryDefaultHours);

      const referenceId = input.invoiceId || 0; // Use 0 if no invoice ID yet
      await db.createSharedDocument({
        documentType: 'invoice',
        referenceId,
        s3Key: fileKey,
        shareToken,
        expiresAt,
        createdBy: ctx.user.id,
      });

      // Generate shareable URL
      const shareUrl = `${ENV.appUrl}/share/${shareToken}`;

      return {
        success: true,
        shareUrl,
        fileKey,
        invoiceNumber,
      };
    }),

  /**
   * Create a shareable link for an existing document
   */
  createShareLink: protectedProcedure
    .input(
      z.object({
        documentType: z.enum(['project_report', 'invoice', 'inspection']),
        referenceId: z.number(),
        expiryHours: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Find existing shared document or create new one
      // For now, we'll create a new share link each time
      // In the future, you might want to check for existing non-expired links
      
      // Get the document's S3 key based on type
      let s3Key: string | null = null;
      
      if (input.documentType === 'project_report') {
        // Project reports are stored when generated, so we need to find the latest one
        // For now, we'll require the user to generate the report first
        throw new TRPCError({
          code: "NOT_IMPLEMENTED",
          message: "Creating share links for project reports requires the report to be generated first. Use generateProjectReport instead.",
        });
      } else if (input.documentType === 'invoice') {
        const invoice = await db.getInvoiceById(input.referenceId);
        if (!invoice || !invoice.fileKey) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invoice not found or has no file",
          });
        }
        s3Key = invoice.fileKey;
      } else {
        throw new TRPCError({
          code: "NOT_IMPLEMENTED",
          message: "Inspection document sharing not yet implemented",
        });
      }

      if (!s3Key) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document S3 key not found",
        });
      }

      // Create new share link
      const shareToken = nanoid(32);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + (input.expiryHours || ENV.pdfExpiryDefaultHours));

      await db.createSharedDocument({
        documentType: input.documentType,
        referenceId: input.referenceId,
        s3Key,
        shareToken,
        expiresAt,
        createdBy: ctx.user.id,
      });

      const shareUrl = `${ENV.appUrl}/share/${shareToken}`;

      return {
        success: true,
        shareUrl,
        shareToken,
        expiresAt,
      };
    }),
});

