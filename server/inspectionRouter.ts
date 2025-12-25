/**
 * Inspection Router - tRPC procedures for Inspection Module
 * 
 * Offline-first architecture:
 * - All mutations accept localId for offline-created entities
 * - syncStatus tracked for eventual sync
 * - No blocking validation
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

const syncStatusSchema = z.enum(["pending", "syncing", "synced", "error"]);

// Inspection Template schemas
const createInspectionTemplateSchema = z.object({
  name: z.string(),
  inspectionType: z.string(),
  unitLabelHint: z.string().optional(),
  labelPatternHint: z.string().optional(),
  suggestedFields: z.unknown().optional(),
  suggestedDefects: z.unknown().optional(),
  scope: z.enum(["global", "company"]).default("global"),
});

const updateInspectionTemplateSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  inspectionType: z.string().optional(),
  unitLabelHint: z.string().optional(),
  labelPatternHint: z.string().optional(),
  suggestedFields: z.unknown().optional(),
  suggestedDefects: z.unknown().optional(),
  scope: z.enum(["global", "company"]).optional(),
});

// Inspection schemas
const createInspectionSchema = z.object({
  projectId: z.number(),
  templateId: z.number().optional().nullable(),
  type: z.string().optional(),
  status: z.string().optional(),
  startedAt: z.date().optional().nullable(),
  completedAt: z.date().optional().nullable(),
  localId: z.string().optional(),
  syncStatus: syncStatusSchema.optional(),
});

const updateInspectionSchema = z.object({
  id: z.number(),
  templateId: z.number().optional().nullable(),
  type: z.string().optional(),
  status: z.string().optional(),
  startedAt: z.date().optional().nullable(),
  completedAt: z.date().optional().nullable(),
  syncStatus: syncStatusSchema.optional(),
});

// Inspection Unit schemas
const createInspectionUnitSchema = z.object({
  inspectionId: z.number(),
  label: z.string(),
  sequenceIndex: z.number().optional(),
  status: z.string().optional(),
  localId: z.string().optional(),
  syncStatus: syncStatusSchema.optional(),
});

const updateInspectionUnitSchema = z.object({
  id: z.number(),
  label: z.string().optional(),
  status: z.string().optional(),
  syncStatus: syncStatusSchema.optional(),
});

// Inspection Finding schemas
const createInspectionFindingSchema = z.object({
  inspectionUnitId: z.number(),
  defectType: z.string().optional(),
  severity: z.string().optional(),
  notes: z.string().optional(),
  positionDescriptor: z.string().optional(),
  heightMeters: z.number().optional().nullable(),
  localId: z.string().optional(),
  syncStatus: syncStatusSchema.optional(),
});

const updateInspectionFindingSchema = z.object({
  id: z.number(),
  defectType: z.string().optional(),
  severity: z.string().optional(),
  notes: z.string().optional(),
  positionDescriptor: z.string().optional(),
  heightMeters: z.number().optional().nullable(),
  syncStatus: syncStatusSchema.optional(),
});

// Inspection Media schemas
const createInspectionMediaSchema = z.object({
  inspectionFindingId: z.number(),
  originalS3Key: z.string().optional(),
  annotatedS3Key: z.string().optional().nullable(),
  localOriginalPath: z.string().optional(),
  localAnnotatedPath: z.string().optional(),
  takenAt: z.date().optional(),
  syncStatus: syncStatusSchema.optional(),
});

const updateInspectionMediaSchema = z.object({
  id: z.number(),
  originalS3Key: z.string().optional(),
  annotatedS3Key: z.string().optional().nullable(),
  localOriginalPath: z.string().optional(),
  localAnnotatedPath: z.string().optional(),
  syncStatus: syncStatusSchema.optional(),
});

// =============================================================================
// TEMPLATES ROUTER
// =============================================================================

const templatesRouter = router({
  list: protectedProcedure.query(async () => {
    return await db.getAllInspectionTemplates();
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await db.getInspectionTemplateById(input.id);
    }),

  create: protectedProcedure
    .input(createInspectionTemplateSchema)
    .mutation(async ({ input }) => {
      const result = await db.createInspectionTemplate(input);
      return { success: true, id: result[0].id };
    }),

  update: protectedProcedure
    .input(updateInspectionTemplateSchema)
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      await db.updateInspectionTemplate(id, updates);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteInspectionTemplate(input.id);
      return { success: true };
    }),
});

// =============================================================================
// INSPECTIONS ROUTER
// =============================================================================

const inspectionsRouter = router({
  listByProject: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      return await db.getInspectionsByProjectId(input.projectId);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await db.getInspectionById(input.id);
    }),

  create: protectedProcedure
    .input(createInspectionSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await db.createInspection({
        ...input,
        createdByUserId: ctx.user.id,
        startedAt: input.startedAt || null,
        completedAt: input.completedAt || null,
        templateId: input.templateId || null,
        syncStatus: input.syncStatus || "pending",
      });
      return { success: true, id: result[0].id };
    }),

  update: protectedProcedure
    .input(updateInspectionSchema)
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      await db.updateInspection(id, {
        ...updates,
        startedAt: updates.startedAt ?? undefined,
        completedAt: updates.completedAt ?? undefined,
        templateId: updates.templateId ?? undefined,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteInspection(input.id);
      return { success: true };
    }),
});

// =============================================================================
// UNITS ROUTER
// =============================================================================

const unitsRouter = router({
  listByInspection: protectedProcedure
    .input(z.object({ inspectionId: z.number() }))
    .query(async ({ input }) => {
      return await db.getInspectionUnitsByInspectionId(input.inspectionId);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await db.getInspectionUnitById(input.id);
    }),

  getNextSequenceIndex: protectedProcedure
    .input(z.object({ inspectionId: z.number() }))
    .query(async ({ input }) => {
      return await db.getNextSequenceIndexForInspection(input.inspectionId);
    }),

  create: protectedProcedure
    .input(createInspectionUnitSchema)
    .mutation(async ({ input }) => {
      // Auto-calculate sequenceIndex if not provided
      let sequenceIndex = input.sequenceIndex;
      if (sequenceIndex === undefined) {
        sequenceIndex = await db.getNextSequenceIndexForInspection(input.inspectionId);
      }

      const result = await db.createInspectionUnit({
        ...input,
        sequenceIndex,
        syncStatus: input.syncStatus || "pending",
      });
      return { success: true, id: result[0].id };
    }),

  update: protectedProcedure
    .input(updateInspectionUnitSchema)
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      await db.updateInspectionUnit(id, updates);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteInspectionUnit(input.id);
      return { success: true };
    }),
});

// =============================================================================
// FINDINGS ROUTER
// =============================================================================

const findingsRouter = router({
  listByUnit: protectedProcedure
    .input(z.object({ unitId: z.number() }))
    .query(async ({ input }) => {
      return await db.getInspectionFindingsByUnitId(input.unitId);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await db.getInspectionFindingById(input.id);
    }),

  create: protectedProcedure
    .input(createInspectionFindingSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await db.createInspectionFinding({
        ...input,
        createdByUserId: ctx.user.id,
        heightMeters: input.heightMeters || null,
        syncStatus: input.syncStatus || "pending",
      });
      return { success: true, id: result[0].id };
    }),

  update: protectedProcedure
    .input(updateInspectionFindingSchema)
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      await db.updateInspectionFinding(id, {
        ...updates,
        heightMeters: updates.heightMeters ?? undefined,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteInspectionFinding(input.id);
      return { success: true };
    }),
});

// =============================================================================
// MEDIA ROUTER
// =============================================================================

const mediaRouter = router({
  listByFinding: protectedProcedure
    .input(z.object({ findingId: z.number() }))
    .query(async ({ input }) => {
      return await db.getInspectionMediaByFindingId(input.findingId);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await db.getInspectionMediaById(input.id);
    }),

  create: protectedProcedure
    .input(createInspectionMediaSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await db.createInspectionMedia({
        ...input,
        takenByUserId: ctx.user.id,
        takenAt: input.takenAt || new Date(),
        syncStatus: input.syncStatus || "pending",
      });
      return { success: true, id: result[0].id };
    }),

  update: protectedProcedure
    .input(updateInspectionMediaSchema)
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      await db.updateInspectionMedia(id, updates);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteInspectionMedia(input.id);
      return { success: true };
    }),
});

// =============================================================================
// MAIN INSPECTION ROUTER
// =============================================================================

export const inspectionRouter = router({
  templates: templatesRouter,
  inspections: inspectionsRouter,
  units: unitsRouter,
  findings: findingsRouter,
  media: mediaRouter,
});

