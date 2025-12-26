import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { storagePut, deleteFromStorage, generateFileKey, getContentType, createPresignedReadUrl } from "./storage";
import sharp from "sharp";

export const settingsRouter = router({
  /**
   * Get company settings for current user
   */
  get: protectedProcedure.query(async ({ ctx }) => {
    const settings = await db.getCompanySettingsByUserId(ctx.user.id);
    
    // Return default settings if none exist
    if (!settings) {
      return {
        companyName: ctx.user.name || '',
        address: null,
        email: null,
        phone: null,
        steuernummer: null,
        ustIdNr: null,
        iban: null,
        bic: null,
        isKleinunternehmer: false,
        vatRate: '19.00',
        invoicePrefix: 'RE',
        nextInvoiceNumber: 1,
      };
    }
    
    return settings;
  }),

  /**
   * Create or update company settings
   */
  update: protectedProcedure
    .input(
      z.object({
        companyName: z.string().optional(),
        address: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        steuernummer: z.string().optional(),
        ustIdNr: z.string().optional(),
        iban: z.string().optional(),
        bic: z.string().optional(),
        isKleinunternehmer: z.boolean().optional(),
        vatRate: z.string().optional(),
        invoicePrefix: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await db.getCompanySettingsByUserId(ctx.user.id);
      
      // Normalize empty strings to null for optional string fields
      const normalizeString = (value: string | undefined): string | null | undefined => {
        if (value === undefined) return undefined;
        return value === '' ? null : value;
      };
      
      // Build normalized input object, converting empty strings to null
      const normalizedInput: Partial<{
        companyName: string | null;
        address: string | null;
        email: string | null;
        phone: string | null;
        steuernummer: string | null;
        ustIdNr: string | null;
        iban: string | null;
        bic: string | null;
        isKleinunternehmer: boolean;
        vatRate: string | null;
        invoicePrefix: string | null;
      }> = {};
      
      // Process all fields that might be in the input
      if (input.companyName !== undefined) normalizedInput.companyName = normalizeString(input.companyName);
      if (input.address !== undefined) normalizedInput.address = normalizeString(input.address);
      if (input.email !== undefined) normalizedInput.email = normalizeString(input.email);
      if (input.phone !== undefined) normalizedInput.phone = normalizeString(input.phone);
      if (input.steuernummer !== undefined) normalizedInput.steuernummer = normalizeString(input.steuernummer);
      if (input.ustIdNr !== undefined) normalizedInput.ustIdNr = normalizeString(input.ustIdNr);
      if (input.iban !== undefined) normalizedInput.iban = normalizeString(input.iban);
      if (input.bic !== undefined) normalizedInput.bic = normalizeString(input.bic);
      if (input.isKleinunternehmer !== undefined) normalizedInput.isKleinunternehmer = input.isKleinunternehmer;
      if (input.vatRate !== undefined) normalizedInput.vatRate = normalizeString(input.vatRate);
      if (input.invoicePrefix !== undefined) normalizedInput.invoicePrefix = normalizeString(input.invoicePrefix);
      if (normalizedInput.vatRate === null) normalizedInput.vatRate = undefined;
      
      if (existing) {
        // Update existing settings
        await db.updateCompanySettings(ctx.user.id, normalizedInput);
      } else {
        // Create new settings
        await db.createCompanySettings({
          userId: ctx.user.id,
          companyName: normalizedInput.companyName || ctx.user.name || '',
          address: normalizedInput.address ?? null,
          email: normalizedInput.email ?? null,
          phone: normalizedInput.phone ?? null,
          steuernummer: normalizedInput.steuernummer ?? null,
          ustIdNr: normalizedInput.ustIdNr ?? null,
          iban: normalizedInput.iban ?? null,
          bic: normalizedInput.bic ?? null,
          isKleinunternehmer: normalizedInput.isKleinunternehmer ?? false,
          vatRate: normalizedInput.vatRate ?? '19.00',
          invoicePrefix: normalizedInput.invoicePrefix ?? 'RE',
          nextInvoiceNumber: 1,
        });
      }
      
      return { success: true };
    }),

  /**
   * Nested preferences router
   */
  preferences: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserPreferencesByUserId(ctx.user.id);
    }),

    update: protectedProcedure
      .input(
        z.object({
          dateFormat: z.string().optional(),
          timeFormat: z.enum(["12h", "24h"]).optional(),
          timezone: z.string().optional(),
          language: z.string().optional(),
          currency: z.string().optional(),
          notificationsEnabled: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await db.updateUserPreferences(ctx.user.id, input);
        return { success: true };
      }),
  }),

  /**
   * Upload company logo
   */
  uploadLogo: protectedProcedure
    .input(
      z.object({
        base64Image: z.string(),
        filename: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // 1. Validate file type
      const ext = input.filename.split(".").pop()?.toLowerCase();
      const allowedTypes = ["png", "jpg", "jpeg", "svg"];
      if (!ext || !allowedTypes.includes(ext)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid file type. Only PNG, JPG, and SVG are allowed.",
        });
      }

      // 2. Decode base64 and validate size (max 5MB)
      const base64Data = input.base64Image.includes(",")
        ? input.base64Image.split(",")[1]
        : input.base64Image;
      const buffer = Buffer.from(base64Data, "base64");

      if (buffer.length > 5 * 1024 * 1024) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "File size exceeds 5MB limit.",
        });
      }

      // 3. Process logo with square-first approach (512x512)
      // Fit within square canvas, preserving aspect ratio with transparent padding
      const processed = await sharp(buffer)
        .resize(512, 512, {
          fit: "contain", // Fit within square, add transparent padding if needed
          background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent padding
        })
        .png() // Convert to PNG to preserve transparency
        .toBuffer();

      // 4. Upload to S3: uploads/logos/{userId}/{timestamp}.png
      const s3Key = generateFileKey("uploads/logos", ctx.user.id, `logo.png`);
      await storagePut(s3Key, processed, "image/png");

      // 5. Store s3Key + URL in company_settings
      const logoUrl = await createPresignedReadUrl(s3Key, 365 * 24 * 60 * 60); // 1 year expiry

      await db.uploadCompanyLogo(
        ctx.user.id,
        s3Key,
        logoUrl,
        512, // Always 512x512 after processing
        512
      );

      // 6. Return logoUrl (presigned)
      return { logoUrl, s3Key };
    }),

  /**
   * Delete company logo
   */
  deleteLogo: protectedProcedure.mutation(async ({ ctx }) => {
    // 1. Get current logo S3 key
    const settings = await db.getCompanySettingsByUserId(ctx.user.id);
    if (!settings?.logoS3Key) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No logo found.",
      });
    }

    // 2. Delete from S3
    try {
      await deleteFromStorage(settings.logoS3Key);
    } catch (error) {
      console.error("Failed to delete logo from S3:", error);
      // Continue even if S3 delete fails
    }

    // 3. Clear logo fields in company_settings
    await db.deleteCompanyLogo(ctx.user.id);

    return { success: true };
  }),
});
