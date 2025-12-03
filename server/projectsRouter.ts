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
  description: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  address: z.string().optional(),
  geo: geoSchema,
  status: projectStatusSchema.default("planned"),
});

const updateProjectSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  client: z.string().optional(),
  description: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  address: z.string().optional(),
  geo: geoSchema,
  status: projectStatusSchema.optional(),
});

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
      
      return { success: true, id: result[0].insertId };
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
      const result = await db.createProject({
        name: input.name,
        client: input.client || null,
        description: input.description || null,
        startDate: input.startDate || null,
        endDate: input.endDate || null,
        address: input.address || null,
        geo: input.geo || null,
        status: input.status,
        createdBy: ctx.user.id,
      });
      
      return { success: true, id: result[0].insertId };
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
      if (updates.client !== undefined) updateData.client = updates.client || null;
      if (updates.description !== undefined) updateData.description = updates.description || null;
      if (updates.startDate !== undefined) updateData.startDate = updates.startDate || null;
      if (updates.endDate !== undefined) updateData.endDate = updates.endDate || null;
      if (updates.address !== undefined) updateData.address = updates.address || null;
      if (updates.geo !== undefined) updateData.geo = updates.geo || null;
      if (updates.status !== undefined) updateData.status = updates.status;
      
      await db.updateProject(id, updateData);
      return { success: true };
    }),

  /**
   * Archive a project (soft delete)
   * Sets status to 'archived' instead of deleting
   */
  archive: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await requireProjectAccess(ctx.user, input.id, "archive");
      await db.archiveProject(input.id);
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
