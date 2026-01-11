import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { renderPDF } from "./services/pdfService";
import { generateProjectReportHTML } from "./templates/projectReport";
import { generateInvoiceHTML } from "./templates/invoice";
import { generateInspectionHTML } from "./templates/inspection";
import { generateInspectionReportHTML } from "./templates/inspectionReport";
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
      const pdfBuffer = await renderPDF(html);

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
        terms: z.string().optional(),
        dueDate: z.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Get company settings
      let companySettings = await db.getCompanySettingsByUserId(ctx.user.id);
      
      // Create default settings if none exist
      if (!companySettings) {
        const year = new Date().getFullYear();
        await db.createCompanySettings({
          userId: ctx.user.id,
          companyName: ctx.user.name || 'Mantodeus Manager',
          address: null,
          streetName: null,
          streetNumber: null,
          postalCode: null,
          city: null,
          country: null,
          isKleinunternehmer: false,
          vatRate: '19.00',
          invoicePrefix: 'RE',
          invoiceNumberFormat: `RE-${year}-0001`,
          invoiceAccentColor: '#00ff88',
          invoiceAccountHolderName: null,
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
      
      // Ensure new fields have defaults (in case migration hasn't run or fallback query was used)
      if (!companySettings.invoiceAccentColor) {
        companySettings = { ...companySettings, invoiceAccentColor: '#00ff88' };
      }
      if (companySettings.invoiceAccountHolderName === undefined) {
        companySettings = { ...companySettings, invoiceAccountHolderName: null };
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

      const issueDate = new Date();
      const { invoiceNumber, invoiceCounter, invoiceYear } = await db.generateInvoiceNumber(
        ctx.user.id,
        issueDate,
        companySettings.invoiceNumberFormat ?? null,
        companySettings.invoicePrefix ?? "RE"
      );
      await db.ensureUniqueInvoiceNumber(ctx.user.id, invoiceNumber);

      // Calculate totals
      const normalizedItems = input.items.map(item => {
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        const lineTotal = Number((quantity * unitPrice).toFixed(2));
        return {
          name: item.description,
          description: item.description,
          category: null,
          quantity,
          unitPrice,
          lineTotal,
          currency: 'EUR',
        };
      });
      const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const vatAmount = companySettings.isKleinunternehmer ? 0 : subtotal * (Number(companySettings.vatRate) / 100);
      const total = subtotal + vatAmount;

      const itemsForPdf = normalizedItems.map((item) => ({
        description: item.name || item.description || "",
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.lineTotal,
      }));

      // Generate HTML
      const { html, footerTemplate } = generateInvoiceHTML({
        invoiceNumber,
        invoiceDate: issueDate,
        dueDate: input.dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Default 14 days
        company: companySettings,
        client,
        items: itemsForPdf,
        subtotal,
        vatAmount,
        total,
        notes: input.notes,
        terms: input.terms,
        logoUrl: companySettings.logoUrl || '',
        servicePeriodStart: input.servicePeriodStart ? new Date(input.servicePeriodStart) : undefined,
        servicePeriodEnd: input.servicePeriodEnd ? new Date(input.servicePeriodEnd) : undefined,
      });

      // Generate PDF
      const pdfBuffer = await renderPDF(html, {
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate,
      });

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
        if (!invoice) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invoice not found",
          });
        }

        // Validate: dueDate and totalAmount > 0 required before sending
        if (!invoice.dueDate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invoice must have a due date before it can be sent",
          });
        }
        const total = Number(invoice.total || 0);
        if (total <= 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invoice total must be greater than 0",
          });
        }

        // Always regenerate PDF with latest invoice data (per spec)
        const companySettings = await db.getCompanySettingsByUserId(ctx.user.id);
        if (!companySettings) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Company settings not found. Please configure your company settings first.",
          });
        }

        // Get client contact if linked
        let client = null;
        if (invoice.contactId || invoice.clientId) {
          const contact = await db.getContactById(invoice.contactId || invoice.clientId);
          if (contact) {
            client = {
              name: contact.name,
              address: contact.address,
            };
          }
        }

        const items = (invoice.items as Array<any> || []).map((item: any) => ({
          description: item.name || item.description || "",
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          total: Number(item.lineTotal ?? item.total ?? 0),
        }));

        // Generate PDF with latest data
        const { html, footerTemplate } = generateInvoiceHTML({
          invoiceNumber: invoice.invoiceNumber || "DRAFT",
          invoiceDate: invoice.issueDate || new Date(),
          dueDate: invoice.dueDate || new Date(),
          company: companySettings,
          client,
          items,
          subtotal: Number(invoice.subtotal ?? 0),
          vatAmount: Number(invoice.vatAmount ?? 0),
          total: Number(invoice.total ?? 0),
          notes: invoice.notes || undefined,
          terms: invoice.terms || undefined,
          logoUrl: companySettings.logoUrl || "",
          servicePeriodStart: invoice.servicePeriodStart || undefined,
          servicePeriodEnd: invoice.servicePeriodEnd || undefined,
        });

        const pdfBuffer = await renderPDF(html, {
          displayHeaderFooter: true,
          headerTemplate: '<div></div>',
          footerTemplate,
        });

        // Upload new PDF to S3
        const timestamp = Date.now();
        const fileKey = generateFileKey('pdfs', ctx.user.id, `invoice-${invoice.invoiceNumber || invoice.id}-${timestamp}.pdf`);
        await storagePut(fileKey, pdfBuffer, 'application/pdf');

        s3Key = fileKey;
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
      // Default expiry: 30 days (720 hours) for invoices, or use provided expiryHours
      const defaultExpiryHours = input.documentType === 'invoice' ? 720 : ENV.pdfExpiryDefaultHours;
      expiresAt.setHours(expiresAt.getHours() + (input.expiryHours || defaultExpiryHours));

      try {
        await db.createSharedDocument({
          documentType: input.documentType,
          referenceId: input.referenceId,
          s3Key,
          shareToken,
          expiresAt,
          createdBy: ctx.user.id,
        });

        // For invoices: Auto-set sentAt if null (only if share link creation succeeds)
        if (input.documentType === 'invoice') {
          const invoice = await db.getInvoiceById(input.referenceId);
          if (invoice && !invoice.sentAt) {
            // Update invoice with new PDF fileKey and set sentAt
            await db.updateInvoice(input.referenceId, {
              fileKey: s3Key,
              pdfFileKey: s3Key,
            });
            await db.markInvoiceAsSent(input.referenceId);
          } else if (invoice && invoice.sentAt) {
            // Invoice already sent - just update fileKey with new PDF
            await db.updateInvoice(input.referenceId, {
              fileKey: s3Key,
              pdfFileKey: s3Key,
            });
          }
        }

        const shareUrl = `${ENV.appUrl}/share/${shareToken}`;

        return {
          success: true,
          shareUrl,
          shareToken,
          expiresAt,
        };
      } catch (error) {
        // If share link creation fails, sentAt is NOT set (per spec)
        throw error;
      }
    }),

  /**
   * Generate an inspection report PDF
   */
  generateInspectionReport: protectedProcedure
    .input(z.object({ inspectionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // Get inspection
      const inspection = await db.getInspectionById(input.inspectionId);
      if (!inspection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inspection not found",
        });
      }

      // Verify access (inspection belongs to user's project)
      const project = await db.getProjectById(inspection.projectId);
      if (!project || project.createdBy !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied",
        });
      }

      // Get all units for this inspection (ordered by sequenceIndex, filter deletedAt)
      const allUnits = await db.getInspectionUnitsByInspectionId(input.inspectionId);
      const units = allUnits.filter(u => !u.deletedAt);

      // Get findings and media for each unit
      const unitsWithData = await Promise.all(
        units.map(async (unit) => {
          // Get findings for this unit (ordered by createdAt, filter deletedAt)
          const allFindings = await db.getInspectionFindingsByUnitId(unit.id);
          const findings = allFindings.filter(f => !f.deletedAt);

          // Get media for each finding (prefer annotated, fallback to original, filter deletedAt)
          const findingsWithMedia = await Promise.all(
            findings.map(async (finding) => {
              // Get user name
              const user = await db.getUserById(finding.createdByUserId);
              const userName = user?.name || `User ${finding.createdByUserId}`;

              // Get media for this finding
              const allMedia = await db.getInspectionMediaByFindingId(finding.id);
              const media = allMedia.filter(m => !m.deletedAt);

              // Process media: prefer annotated, fallback to original
              const findingIndex = findings.indexOf(finding);
              const mediaWithUrls = await Promise.all(
                media.map(async (mediaItem, mediaIndex) => {
                  // Prefer annotated, fallback to original
                  const imagePath = mediaItem.localAnnotatedPath || mediaItem.localOriginalPath || 
                                   mediaItem.annotatedS3Key || mediaItem.originalS3Key;
                  
                  let imageUrl = '';
                  if (imagePath) {
                    // If it's an S3 key, generate signed URL
                    if (imagePath.startsWith('files/') || imagePath.includes('s3://')) {
                      try {
                        imageUrl = await createPresignedReadUrl(imagePath, 3600); // 1 hour
                      } catch {
                        // If signed URL fails, try to use as-is (might be a local path)
                        imageUrl = imagePath;
                      }
                    } else {
                      // Local path - for PDF generation, we'd need to convert to base64
                      // For now, we'll skip local-only images in PDF (they'll need to be synced first)
                      imageUrl = '';
                    }
                  }

                  return {
                    id: mediaItem.id,
                    imageUrl,
                    caption: `${unit.label} - Befund ${findingIndex + 1} - Bild ${mediaIndex + 1}`,
                  };
                })
              );

              // Filter out media without URLs (local-only, not synced)
              const validMedia = mediaWithUrls.filter(m => m.imageUrl);

              return {
                id: finding.id,
                defectType: finding.defectType,
                severity: finding.severity,
                notes: finding.notes,
                positionDescriptor: finding.positionDescriptor,
                heightMeters: finding.heightMeters,
                createdAt: finding.createdAt,
                createdByUserId: finding.createdByUserId,
                createdByUserName: userName,
                media: validMedia,
              };
            })
          );

          return {
            id: unit.id,
            label: unit.label,
            sequenceIndex: unit.sequenceIndex,
            status: unit.status,
            findings: findingsWithMedia,
          };
        })
      );

      // Calculate summary
      const totalUnits = unitsWithData.length;
      const completedUnits = unitsWithData.filter(u => u.status === 'completed').length;
      const allFindings = unitsWithData.flatMap(u => u.findings);
      const totalFindings = allFindings.length;
      
      // Severity breakdown
      const severityBreakdown: Record<string, number> = {};
      allFindings.forEach(f => {
        if (f.severity) {
          severityBreakdown[f.severity] = (severityBreakdown[f.severity] || 0) + 1;
        }
      });

      // Get unique inspector names
      const inspectorIds = new Set<number>();
      allFindings.forEach(f => inspectorIds.add(f.createdByUserId));
      const inspectors = await Promise.all(
        Array.from(inspectorIds).map(id => db.getUserById(id))
      );
      const inspectorNames = inspectors
        .filter(u => u !== null)
        .map(u => u!.name || `User ${u!.id}`)
        .filter((name, index, self) => self.indexOf(name) === index); // Unique names

      // Get company settings
      const companySettings = await db.getCompanySettingsByUserId(ctx.user.id);
      const logoUrl = companySettings ? '' : ''; // TODO: Add logo URL to settings
      const companyName = companySettings?.companyName || 'Mantodeus Manager';

      // Generate HTML
      const html = generateInspectionReportHTML({
        inspection: {
          id: inspection.id,
          projectId: inspection.projectId,
          projectName: project.name,
          type: inspection.type,
          status: inspection.status,
          startedAt: inspection.startedAt,
          completedAt: inspection.completedAt,
          createdByUserId: inspection.createdByUserId,
          createdByUserName: inspectorNames[0] || undefined,
        },
        units: unitsWithData,
        summary: {
          totalUnits,
          completedUnits,
          totalFindings,
          severityBreakdown,
          inspectors: inspectorNames,
        },
        logoUrl,
        companyName,
      });

      // Generate PDF
      const pdfBuffer = await renderPDF(html);

      // Upload to S3
      const timestamp = Date.now();
      const fileKey = generateFileKey('pdfs', ctx.user.id, `inspection-report-${input.inspectionId}-${timestamp}.pdf`);
      await storagePut(fileKey, pdfBuffer, 'application/pdf');

      // Create shared document record
      const shareToken = nanoid(32);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + ENV.pdfExpiryDefaultHours);

      await db.createSharedDocument({
        documentType: 'inspection',
        referenceId: input.inspectionId,
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

});
