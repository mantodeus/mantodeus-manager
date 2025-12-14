/**
 * Projects Router - tRPC procedures for Projects → Jobs hierarchy
 * 
 * Access Control (ownership-based):
 * - Project creator has full access to their projects and nested jobs
 * - Admin users have full access to all projects
 * - Regular users can only access their own projects
 * 
 * Note: Full RBAC with project_members table deferred to future iteration.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { projectFilesRouter } from "./projectFilesRouter";
import type { TrpcContext } from "./_core/context";
import { deleteMultipleFromStorage } from "./storage";

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

// Project status enum
const projectStatusSchema = z.enum(["planned", "active", "completed"]);

// Job status enum
const jobStatusSchema = z.enum(["pending", "in_progress", "done", "cancelled"]);

// Geo coordinates schema
const geoSchema = z.object({
  lat: z.number(),
  lng: z.number(),
}).nullable().optional();

// Project input schemas
const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  client: z.string().optional(),
  clientId: z.number().int().positive().optional().nullable(),
  description: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  address: z.string().optional(),
  geo: geoSchema,
  scheduledDates: z.array(z.date()).optional(),
  status: projectStatusSchema.default("planned"),
});

const updateProjectSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  client: z.string().optional(),
  clientId: z.number().int().positive().optional().nullable(),
  description: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  address: z.string().optional(),
  geo: geoSchema,
  scheduledDates: z.array(z.date()).optional(),
  status: projectStatusSchema.optional(),
});

function normalizeDateList(dates?: Date[]) {
  if (!dates || dates.length === 0) {
    return {
      serialized: null as string[] | null,
      first: undefined as Date | undefined,
      last: undefined as Date | undefined,
    };
  }

  const normalized = [...dates]
    .map((date) => {
      const copy = new Date(date);
      copy.setUTCHours(0, 0, 0, 0);
      return copy;
    })
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    serialized: normalized.map((date) => date.toISOString()),
    first: normalized[0],
    last: normalized[normalized.length - 1],
  };
}

// Job input schemas
const createJobSchema = z.object({
  projectId: z.number(),
  title: z.string().min(1, "Job title is required"),
  category: z.string().optional(),
  description: z.string().optional(),
  assignedUsers: z.array(z.number()).optional(),
  status: jobStatusSchema.default("pending"),
  startTime: z.date().optional(),
  endTime: z.date().optional(),
});

const updateJobSchema = z.union([
  z.object({
    id: z.number(),
    projectId: z.number(), // Required for access control verification
    title: z.string().min(1).optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    assignedUsers: z.array(z.number()).optional(),
    status: jobStatusSchema.optional(),
    startTime: z.date().optional(),
    endTime: z.date().optional(),
  }),
  // Backwards/forwards compatibility with callers that use `jobId`
  z.object({
    jobId: z.number(),
    projectId: z.number(),
    title: z.string().min(1).optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    assignedUsers: z.array(z.number()).optional(),
    status: jobStatusSchema.optional(),
    startTime: z.date().optional(),
    endTime: z.date().optional(),
  }),
]);

// =============================================================================
// ACCESS CONTROL HELPERS
// =============================================================================

/**
 * Check if user can access a project.
 * - Admin users can access all projects
 * - Regular users can only access projects they created
 */
async function canAccessProject(
  user: NonNullable<TrpcContext["user"]>,
  projectId: number
): Promise<{ allowed: boolean; project: Awaited<ReturnType<typeof db.getProjectById>> }> {
  const project = await db.getProjectById(projectId);
  
  if (!project) {
    return { allowed: false, project: null };
  }
  
  // Admin can access all projects
  if (user.role === "admin") {
    return { allowed: true, project };
  }
  
  // Regular user can only access their own projects
  return { allowed: project.createdBy === user.id, project };
}

/**
 * Verify project access and throw if unauthorized
 */
async function requireProjectAccess(
  user: NonNullable<TrpcContext["user"]>,
  projectId: number,
  action: string = "access"
): Promise<NonNullable<Awaited<ReturnType<typeof db.getProjectById>>>> {
  const { allowed, project } = await canAccessProject(user, projectId);
  
  if (!project) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Project with id ${projectId} not found`,
    });
  }
  
  if (!allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Forbidden: You don't have permission to ${action} this project`,
    });
  }
  
  return project;
}

/**
 * Verify job belongs to project and user has access
 */
async function requireJobAccess(
  user: NonNullable<TrpcContext["user"]>,
  projectId: number,
  jobId: number,
  action: string = "access"
): Promise<NonNullable<Awaited<ReturnType<typeof db.getProjectJobById>>>> {
  // First verify project access
  await requireProjectAccess(user, projectId, action);
  
  // Then verify job exists and belongs to the project
  const job = await db.getProjectJobById(jobId);
  
  if (!job) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Job with id ${jobId} not found`,
    });
  }
  
  if (job.projectId !== projectId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Job ${jobId} does not belong to project ${projectId}`,
    });
  }
  
  return job;
}

// =============================================================================
// JOBS ROUTER (nested under projects)
// =============================================================================

const jobsRouter = router({
  /**
   * List all jobs for a project
   */
  list: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireProjectAccess(ctx.user, input.projectId, "view jobs in");
      return await db.getProjectJobsByProjectId(input.projectId);
    }),

  /**
   * Get a specific job by ID
   */
  get: protectedProcedure
    .input(z.object({ projectId: z.number(), jobId: z.number() }))
    .query(async ({ input, ctx }) => {
      return await requireJobAccess(ctx.user, input.projectId, input.jobId, "view");
    }),

  /**
   * Create a new job under a project
   */
  create: protectedProcedure
    .input(createJobSchema)
    .mutation(async ({ input, ctx }) => {
      await requireProjectAccess(ctx.user, input.projectId, "add jobs to");
      
      const result = await db.createProjectJob({
        projectId: input.projectId,
        title: input.title,
        category: input.category || null,
        description: input.description || null,
        assignedUsers: input.assignedUsers || null,
        status: input.status,
        startTime: input.startTime || null,
        endTime: input.endTime || null,
      });
      
      const created = await db.getProjectJobById(result[0].insertId);
      return { success: true, ...(created ?? { id: result[0].insertId, projectId: input.projectId }) };
    }),

  /**
   * Update an existing job
   */
  update: protectedProcedure
    .input(updateJobSchema)
    .mutation(async ({ input, ctx }) => {
      const jobId = "jobId" in input ? input.jobId : input.id;
      await requireJobAccess(ctx.user, input.projectId, jobId, "update");
      
      const projectId = input.projectId;
      const updates = { ...(input as Record<string, unknown>) } as typeof input;
      // Remove identifiers so we can build updateData cleanly.
      // (Handles both shapes: id/projectId and jobId/projectId.)
      delete (updates as { id?: number }).id;
      delete (updates as { jobId?: number }).jobId;
      delete (updates as { projectId?: number }).projectId;
      
      // Convert optional fields
      const updateData: Parameters<typeof db.updateProjectJob>[1] = {};
      if ("title" in updates && updates.title !== undefined) updateData.title = updates.title as string;
      if ("category" in updates && updates.category !== undefined) updateData.category = (updates.category as string) || null;
      if ("description" in updates && updates.description !== undefined) updateData.description = (updates.description as string) || null;
      if ("assignedUsers" in updates && updates.assignedUsers !== undefined) updateData.assignedUsers = (updates.assignedUsers as number[]) || null;
      if ("status" in updates && updates.status !== undefined) updateData.status = updates.status as (typeof jobStatusSchema)["_type"];
      if ("startTime" in updates && updates.startTime !== undefined) updateData.startTime = (updates.startTime as Date) || null;
      if ("endTime" in updates && updates.endTime !== undefined) updateData.endTime = (updates.endTime as Date) || null;
      
      await db.updateProjectJob(jobId, updateData);
      const updated = await db.getProjectJobById(jobId);
      return { success: true, ...(updated ?? { id: jobId, projectId }) };
    }),

  /**
   * Delete a job
   */
  delete: protectedProcedure
    .input(z.object({ projectId: z.number(), jobId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await requireJobAccess(ctx.user, input.projectId, input.jobId, "delete");
      await db.deleteProjectJob(input.jobId);
      return { success: true };
    }),
});

// =============================================================================
// PROJECTS ROUTER
// =============================================================================

export const projectsRouter = router({
  /**
   * List all projects for the current user
   * - Admin sees all projects
   * - Regular users see only their own
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "admin") {
      return await db.getAllProjects();
    }
    return await db.getProjectsByUser(ctx.user.id);
  }),

  /**
   * List archived projects (explicit query)
   */
  listArchived: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "admin") {
      return await db.getAllArchivedProjects();
    }
    return await db.getArchivedProjectsByUser(ctx.user.id);
  }),

  /**
   * List trashed projects (explicit query)
   */
  listTrashed: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "admin") {
      return await db.getAllTrashedProjects();
    }
    return await db.getTrashedProjectsByUser(ctx.user.id);
  }),

  /**
   * Get a specific project by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      return await requireProjectAccess(ctx.user, input.id, "view");
    }),

  /**
   * Create a new project
   */
  create: protectedProcedure
    .input(createProjectSchema)
    .mutation(async ({ input, ctx }) => {
      const { serialized: scheduledDates, first, last } = normalizeDateList(input.scheduledDates);
      const startDate = input.startDate ?? first ?? null;
      const endDate = input.endDate ?? last ?? null;

      const result = await db.createProject({
        name: input.name,
        client: input.client?.trim() || null,
        clientId: input.clientId ?? null,
        description: input.description || null,
        startDate,
        endDate,
        address: input.address || null,
        geo: input.geo || null,
        scheduledDates,
        status: input.status,
        createdBy: ctx.user.id,
      });

      const created = await db.getProjectById(result[0].insertId);
      return { success: true, ...(created ?? { id: result[0].insertId }) };
    }),

  /**
   * Update an existing project
   */
  update: protectedProcedure
    .input(updateProjectSchema)
    .mutation(async ({ input, ctx }) => {
      await requireProjectAccess(ctx.user, input.id, "update");
      
      const { id, ...updates } = input;
      
      // Convert optional fields
      const updateData: Parameters<typeof db.updateProject>[1] = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.client !== undefined) updateData.client = updates.client?.trim() || null;
      if (updates.clientId !== undefined) updateData.clientId = updates.clientId ?? null;
      if (updates.description !== undefined) updateData.description = updates.description || null;
      if (updates.startDate !== undefined) updateData.startDate = updates.startDate || null;
      if (updates.endDate !== undefined) updateData.endDate = updates.endDate || null;
      if (updates.address !== undefined) updateData.address = updates.address || null;
      if (updates.geo !== undefined) updateData.geo = updates.geo || null;
      if (updates.scheduledDates !== undefined) {
        const { serialized, first, last } = normalizeDateList(updates.scheduledDates);
        updateData.scheduledDates = serialized;

        if (updates.startDate === undefined) {
          updateData.startDate = first ?? null;
        }
        if (updates.endDate === undefined) {
          updateData.endDate = last ?? null;
        }
      }
      if (updates.status !== undefined) updateData.status = updates.status;
      
      await db.updateProject(id, updateData);
      const updated = await db.getProjectById(id);
      return { success: true, ...(updated ?? { id }) };
    }),

  /**
   * Archive a project
   * Sets archivedAt = now
   */
  archiveProject: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await requireProjectAccess(ctx.user, input.projectId, "archive");
      await db.archiveProject(input.projectId);
      return { success: true };
    }),

  /**
   * Restore an archived project
   * Sets archivedAt = null
   */
  restoreArchivedProject: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await requireProjectAccess(ctx.user, input.projectId, "restore");
      await db.restoreArchivedProject(input.projectId);
      return { success: true };
    }),

  /**
   * Move a project to Rubbish (internally: Trash)
   * Sets trashedAt = now
   */
  moveProjectToTrash: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await requireProjectAccess(ctx.user, input.projectId, "delete");
      await db.moveProjectToTrash(input.projectId);
      return { success: true };
    }),

  /**
   * Restore a project from Rubbish (internally: Trash)
   * Sets trashedAt = null
   */
  restoreProjectFromTrash: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const project = await requireProjectAccess(ctx.user, input.projectId, "restore from Rubbish");
      if (!project.trashedAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Project is not in Rubbish",
        });
      }
      await db.restoreProjectFromTrash(input.projectId);
      return { success: true };
    }),

  /**
   * Permanently delete a project and all related data.
   * Only allowed if the project is in Trash (trashedAt IS NOT NULL).
   * Also deletes associated S3/object storage assets referenced by file metadata.
   *
   * Irreversible.
   */
  deleteProjectPermanently: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const project = await requireProjectAccess(ctx.user, input.projectId, "permanently delete");
      if (!project.trashedAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Permanent delete is only allowed from Rubbish",
        });
      }

      // Collect all storage keys before deleting DB records.
      const files = await db.getFilesByProjectId(input.projectId);
      const keys = new Set<string>();
      for (const file of files) {
        if (file.s3Key) keys.add(file.s3Key);
        const variants = file.imageMetadata?.variants;
        if (variants?.thumb?.key) keys.add(variants.thumb.key);
        if (variants?.preview?.key) keys.add(variants.preview.key);
        if (variants?.full?.key) keys.add(variants.full.key);
      }

      // Delete objects first; if this fails, keep DB data so user can retry.
      if (keys.size > 0) {
        await deleteMultipleFromStorage(Array.from(keys));
      }

      // Cascade deletes: project_jobs, file_metadata, etc.
      await db.deleteProject(input.projectId);
      return { success: true };
    }),

  /**
   * Nested jobs router
   * Accessed as: projects.jobs.list, projects.jobs.create, etc.
   */
  jobs: jobsRouter,

  /**
   * Nested files router
   * Accessed as: projects.files.presignUpload, projects.files.register, etc.
   */
  files: projectFilesRouter,
});
