/**
 * Projects Router Tests
 * 
 * Tests for the new Projects → Jobs hierarchy including:
 * - Project CRUD operations
 * - Job CRUD operations nested under projects
 * - Access control (ownership-based)
 */

import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

// =============================================================================
// TEST HELPERS
// =============================================================================

function createAuthContext(overrides: Partial<AuthenticatedUser> = {}): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    supabaseId: "test-user-123",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "email",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

function createAdminContext(): { ctx: TrpcContext } {
  return createAuthContext({ id: 999, role: "admin", email: "admin@example.com" });
}

function createOtherUserContext(): { ctx: TrpcContext } {
  return createAuthContext({ id: 2, supabaseId: "other-user-456", email: "other@example.com" });
}

function createUnauthenticatedContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// =============================================================================
// PROJECT TESTS
// =============================================================================

describe("projects router", () => {
  describe("create project", () => {
    it("should create a new project", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.projects.create({
        name: "Test Construction Project",
        description: "A test project for unit testing",
        client: "Test Client Inc",
        status: "planned",
      });

      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
    });

    it("should create a project with all optional fields", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.projects.create({
        name: "Full Project",
        description: "Project with all fields",
        client: "Full Client",
        address: "123 Main St, City",
        geo: { lat: 47.3769, lng: 8.5417 },
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-31"),
        status: "active",
      });

      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
    });

    it("should require authentication", async () => {
      const ctx = createUnauthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.projects.create({ name: "Should Fail" })
      ).rejects.toThrow();
    });

    it("should require project name", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.projects.create({ name: "" })
      ).rejects.toThrow();
    });
  });

  describe("list projects", () => {
    it("should list projects for authenticated user", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const projects = await caller.projects.list();

      expect(Array.isArray(projects)).toBe(true);
    });

    it("should require authentication", async () => {
      const ctx = createUnauthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.projects.list()).rejects.toThrow();
    });
  });

  describe("get project by id", () => {
    it("should get a project by id", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Create a project first
      const createResult = await caller.projects.create({
        name: "Project to Retrieve",
        status: "planned",
      });

      // Then retrieve it
      const project = await caller.projects.getById({ id: createResult.id });

      expect(project).toBeDefined();
      expect(project?.name).toBe("Project to Retrieve");
    });

    it("should throw NOT_FOUND for non-existent project", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.projects.getById({ id: 999999 })
      ).rejects.toThrow("not found");
    });
  });

  describe("update project", () => {
    it("should update a project", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Create a project
      const createResult = await caller.projects.create({
        name: "Project to Update",
        status: "planned",
      });

      // Update it
      const updateResult = await caller.projects.update({
        id: createResult.id,
        name: "Updated Project Name",
        status: "active",
      });

      expect(updateResult.success).toBe(true);

      // Verify the update
      const project = await caller.projects.getById({ id: createResult.id });
      expect(project?.name).toBe("Updated Project Name");
      expect(project?.status).toBe("active");
    });
  });

  describe("archive project", () => {
    it("should archive a project (soft delete)", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Create a project
      const createResult = await caller.projects.create({
        name: "Project to Archive",
        status: "active",
      });

      // Archive it
      const archiveResult = await caller.projects.archive({ id: createResult.id });

      expect(archiveResult.success).toBe(true);

      // Verify the archive
      const project = await caller.projects.getById({ id: createResult.id });
      expect(project?.status).toBe("archived");
    });
  });

  describe("access control", () => {
    it("should prevent access to other user's projects", async () => {
      const { ctx: ownerCtx } = createAuthContext();
      const { ctx: otherCtx } = createOtherUserContext();

      // Create as owner
      const ownerCaller = appRouter.createCaller(ownerCtx);
      const createResult = await ownerCaller.projects.create({
        name: "Owner's Private Project",
      });

      // Try to access as another user
      const otherCaller = appRouter.createCaller(otherCtx);

      await expect(
        otherCaller.projects.getById({ id: createResult.id })
      ).rejects.toThrow("permission");
    });

    it("should allow admin access to any project", async () => {
      const { ctx: ownerCtx } = createAuthContext();
      const { ctx: adminCtx } = createAdminContext();

      // Create as regular user
      const ownerCaller = appRouter.createCaller(ownerCtx);
      const createResult = await ownerCaller.projects.create({
        name: "User's Project",
      });

      // Access as admin should work
      const adminCaller = appRouter.createCaller(adminCtx);
      const project = await adminCaller.projects.getById({ id: createResult.id });

      expect(project?.name).toBe("User's Project");
    });
  });
});

// =============================================================================
// JOBS TESTS
// =============================================================================

describe("projects.jobs router", () => {
  describe("create job", () => {
    it("should create a job under a project", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // First create a project
      const projectResult = await caller.projects.create({
        name: "Project with Jobs",
      });

      // Create a job under it
      const jobResult = await caller.projects.jobs.create({
        projectId: projectResult.id,
        title: "Foundation Work",
        category: "construction",
        status: "pending",
      });

      expect(jobResult.success).toBe(true);
      expect(jobResult.id).toBeDefined();
    });

    it("should create a job with assigned users", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const projectResult = await caller.projects.create({
        name: "Project for Assignment Test",
      });

      const jobResult = await caller.projects.jobs.create({
        projectId: projectResult.id,
        title: "Team Task",
        assignedUsers: [1, 2, 3],
        status: "in_progress",
      });

      expect(jobResult.success).toBe(true);
    });

    it("should require project access to create jobs", async () => {
      const { ctx: ownerCtx } = createAuthContext();
      const { ctx: otherCtx } = createOtherUserContext();

      // Create project as owner
      const ownerCaller = appRouter.createCaller(ownerCtx);
      const projectResult = await ownerCaller.projects.create({
        name: "Owner's Project",
      });

      // Try to create job as other user
      const otherCaller = appRouter.createCaller(otherCtx);

      await expect(
        otherCaller.projects.jobs.create({
          projectId: projectResult.id,
          title: "Unauthorized Job",
        })
      ).rejects.toThrow("permission");
    });
  });

  describe("list jobs", () => {
    it("should list jobs for a project", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Create project with jobs
      const projectResult = await caller.projects.create({
        name: "Project with Multiple Jobs",
      });

      await caller.projects.jobs.create({
        projectId: projectResult.id,
        title: "Job 1",
      });

      await caller.projects.jobs.create({
        projectId: projectResult.id,
        title: "Job 2",
      });

      // List jobs
      const jobs = await caller.projects.jobs.list({
        projectId: projectResult.id,
      });

      expect(Array.isArray(jobs)).toBe(true);
      expect(jobs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("get job", () => {
    it("should get a specific job", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const projectResult = await caller.projects.create({
        name: "Project for Get Test",
      });

      const jobResult = await caller.projects.jobs.create({
        projectId: projectResult.id,
        title: "Specific Job",
        description: "Job description here",
      });

      const job = await caller.projects.jobs.get({
        projectId: projectResult.id,
        jobId: jobResult.id,
      });

      expect(job).toBeDefined();
      expect(job?.title).toBe("Specific Job");
    });

    it("should verify job belongs to project", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Create two projects
      const project1 = await caller.projects.create({ name: "Project 1" });
      const project2 = await caller.projects.create({ name: "Project 2" });

      // Create job in project 1
      const jobResult = await caller.projects.jobs.create({
        projectId: project1.id,
        title: "Job in Project 1",
      });

      // Try to access job with wrong project ID
      await expect(
        caller.projects.jobs.get({
          projectId: project2.id,
          jobId: jobResult.id,
        })
      ).rejects.toThrow("does not belong");
    });
  });

  describe("update job", () => {
    it("should update a job", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const projectResult = await caller.projects.create({
        name: "Project for Update Test",
      });

      const jobResult = await caller.projects.jobs.create({
        projectId: projectResult.id,
        title: "Job to Update",
        status: "pending",
      });

      const updateResult = await caller.projects.jobs.update({
        id: jobResult.id,
        projectId: projectResult.id,
        title: "Updated Job Title",
        status: "in_progress",
      });

      expect(updateResult.success).toBe(true);

      const job = await caller.projects.jobs.get({
        projectId: projectResult.id,
        jobId: jobResult.id,
      });

      expect(job?.title).toBe("Updated Job Title");
      expect(job?.status).toBe("in_progress");
    });
  });

  describe("delete job", () => {
    it("should delete a job", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const projectResult = await caller.projects.create({
        name: "Project for Delete Test",
      });

      const jobResult = await caller.projects.jobs.create({
        projectId: projectResult.id,
        title: "Job to Delete",
      });

      const deleteResult = await caller.projects.jobs.delete({
        projectId: projectResult.id,
        jobId: jobResult.id,
      });

      expect(deleteResult.success).toBe(true);

      // Verify deletion
      await expect(
        caller.projects.jobs.get({
          projectId: projectResult.id,
          jobId: jobResult.id,
        })
      ).rejects.toThrow("not found");
    });
  });
});
