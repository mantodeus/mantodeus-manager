import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";

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
});
