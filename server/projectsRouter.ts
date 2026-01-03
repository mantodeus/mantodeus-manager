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

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

// Project status enum
const projectStatusSchema = z.enum(["planned", "active", "completed", "archived"]);

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

const updateJobSchema = z.object({
  id: z.number(),
  projectId: z.number(), // Required for access control verification
  title: z.string().min(1).optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  assignedUsers: z.array(z.number()).optional(),
  status: jobStatusSchema.optional(),
  startTime: z.date().optional(),
  endTime: z.date().optional(),
});

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
      message: `You don't have permission to ${action} this project`,
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
      
      return { success: true, id: result[0].id };
    }),

  /**
   * Update an existing job
   */
  update: protectedProcedure
    .input(updateJobSchema)
    .mutation(async ({ input, ctx }) => {
      await requireJobAccess(ctx.user, input.projectId, input.id, "update");
      
      const { id, projectId, ...updates } = input;
      
      // Convert optional fields
      const updateData: Parameters<typeof db.updateProjectJob>[1] = {};
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.category !== undefined) updateData.category = updates.category || null;
      if (updates.description !== undefined) updateData.description = updates.description || null;
      if (updates.assignedUsers !== undefined) updateData.assignedUsers = updates.assignedUsers || null;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.startTime !== undefined) updateData.startTime = updates.startTime || null;
      if (updates.endTime !== undefined) updateData.endTime = updates.endTime || null;
      
      await db.updateProjectJob(id, updateData);
      return { success: true };
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
   * List archived projects for the current user
   */
  listArchived: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "admin") {
      return await db.getAllArchivedProjects();
    }
    return await db.getArchivedProjectsByUser(ctx.user.id);
  }),

  /**
   * List trashed projects for the current user
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
      try {
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
        
        if (!result || !result[0] || !result[0].id) {
          console.error("[Projects] createProject returned invalid result:", result);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create project: invalid response from database",
          });
        }
        
        return { success: true, id: result[0].id };
      } catch (error) {
        console.error("[Projects] createProject error:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to create project",
        });
      }
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
      return { success: true };
    }),

  /**
   * Archive a project (soft delete)
   * Sets archivedAt timestamp
   */
  archive: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await requireProjectAccess(ctx.user, input.id, "archive");
      await db.archiveProject(input.id);
      return { success: true };
    }),

  /**
   * Archive a project (alias for archive - used by Projects.tsx)
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
   */
  restoreArchivedProject: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await requireProjectAccess(ctx.user, input.projectId, "restore");
      await db.restoreArchivedProject(input.projectId);
      return { success: true };
    }),

  /**
   * Move a project to trash (soft delete)
   */
  moveProjectToTrash: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await requireProjectAccess(ctx.user, input.projectId, "delete");
      await db.moveProjectToTrash(input.projectId);
      return { success: true };
    }),

  /**
   * Restore a project from trash
   */
  restoreProjectFromTrash: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await requireProjectAccess(ctx.user, input.projectId, "restore");
      await db.restoreProjectFromTrash(input.projectId);
      return { success: true };
    }),

  /**
   * Permanently delete a project and all related data
   * Use with caution - this will cascade delete jobs and files
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await requireProjectAccess(ctx.user, input.id, "delete");
      await db.deleteProject(input.id);
      return { success: true };
    }),

  /**
   * Permanently delete a project (only from trash)
   */
  deleteProjectPermanently: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const project = await requireProjectAccess(ctx.user, input.projectId, "delete");
      
      // Only allow permanent deletion from trash
      if (!project.trashedAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Permanent delete is only allowed from Rubbish",
        });
      }
      
      await db.deleteProject(input.projectId);
      return { success: true };
    }),

  /**
   * Duplicate a project with all its jobs
   */
  duplicate: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await requireProjectAccess(ctx.user, input.projectId, "duplicate");
      return await db.duplicateProject(input.projectId, ctx.user.id);
    }),

  /**
   * Nested jobs router
   * Accessed as: projects.jobs.list, projects.jobs.create, etc.
   */
  jobs: jobsRouter,

  /**
   * Check in to a project (start work)
   */
  checkIn: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireProjectAccess(ctx.user, input.projectId, "view");
      
      // Check if user already has an active check-in
      const activeCheckin = await db.getActiveCheckin(input.projectId, ctx.user.id);
      if (activeCheckin) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You are already checked in to this project",
        });
      }
      
      await db.createProjectCheckin({
        projectId: input.projectId,
        userId: ctx.user.id,
        checkInTime: new Date(),
        checkOutTime: null,
        latitude: input.latitude ? String(input.latitude) : null,
        longitude: input.longitude ? String(input.longitude) : null,
        notes: null,
      });
      
      return { success: true };
    }),

  /**
   * Check out from a project (end work)
   */
  checkOut: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireProjectAccess(ctx.user, input.projectId, "view");
      
      // Find active check-in
      const activeCheckin = await db.getActiveCheckin(input.projectId, ctx.user.id);
      if (!activeCheckin) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You are not checked in to this project",
        });
      }
      
      await db.updateProjectCheckin(activeCheckin.id, {
        checkOutTime: new Date(),
        notes: input.notes || null,
      });
      
      return { success: true };
    }),

  /**
   * Get check-in history for a project
   */
  getCheckins: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireProjectAccess(ctx.user, input.projectId, "view");
      return await db.getProjectCheckinsByProjectId(input.projectId);
    }),

  /**
   * Get active check-in status for current user
   */
  getActiveCheckin: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireProjectAccess(ctx.user, input.projectId, "view");
      return await db.getActiveCheckin(input.projectId, ctx.user.id);
    }),

  /**
   * Nested files router
   * Accessed as: projects.files.presignUpload, projects.files.register, etc.
   */
  files: projectFilesRouter,
});
