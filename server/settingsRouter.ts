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
      
      if (existing) {
        // Update existing settings
        await db.updateCompanySettings(ctx.user.id, input);
      } else {
        // Create new settings
        await db.createCompanySettings({
          userId: ctx.user.id,
          companyName: input.companyName || ctx.user.name || '',
          address: input.address || null,
          steuernummer: input.steuernummer || null,
          ustIdNr: input.ustIdNr || null,
          iban: input.iban || null,
          bic: input.bic || null,
          isKleinunternehmer: input.isKleinunternehmer || false,
          vatRate: input.vatRate || '19.00',
          invoicePrefix: input.invoicePrefix || 'RE',
          nextInvoiceNumber: 1,
        });
      }
      
      return { success: true };
    }),
});

