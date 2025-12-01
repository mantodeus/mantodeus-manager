/**
 * Integration Tests: Full Project/Job/File Flow
 * 
 * These tests cover the complete end-to-end workflow:
 * createProject → createJob → presign upload → (mock) upload → register file → get presigned preview URL
 * 
 * Note: These tests require a running database connection.
 * In CI, ensure DATABASE_URL is set and migrations are run beforehand.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

// Mock S3 operations for testing
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://test-bucket.s3.amazonaws.com/test-presigned-url"),
}));

// Test user context
const testUser = {
  id: 1,
  email: "integration-test@example.com",
  name: "Integration Tester",
  role: "user" as const,
  supabaseId: "test-supabase-id",
};

function createTestContext(): TrpcContext {
  return {
    user: testUser,
    setCookie: vi.fn(),
    getCookie: vi.fn(),
    clearCookie: vi.fn(),
  };
}

describe("Integration: Project → Job → File Flow", () => {
  let projectId: number;
  let jobId: number;
  let fileId: number;
  let s3Key: string;

  // Skip tests if database is not available
  const skipIfNoDb = async () => {
    const dbInstance = await db.getDb();
    if (!dbInstance) {
      console.log("⚠️ Skipping integration tests: Database not available");
      return true;
    }
    return false;
  };

  describe("Complete workflow", () => {
    it("Step 1: Create a new project", async () => {
      if (await skipIfNoDb()) return;

      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const project = await caller.projects.create({
        name: "Integration Test Project",
        client: "Test Client Inc.",
        description: "A project created for integration testing",
        status: "active",
        address: "123 Test Street",
      });

      expect(project).toBeDefined();
      expect(project.id).toBeGreaterThan(0);
      expect(project.name).toBe("Integration Test Project");
      expect(project.client).toBe("Test Client Inc.");
      expect(project.status).toBe("active");
      expect(project.createdBy).toBe(testUser.id);

      projectId = project.id;
    });

    it("Step 2: Create a job under the project", async () => {
      if (await skipIfNoDb()) return;
      if (!projectId) {
        console.log("Skipping: No project created");
        return;
      }

      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const job = await caller.projects.jobs.create({
        projectId,
        title: "Integration Test Job",
        category: "Testing",
        description: "A job created for integration testing",
        status: "pending",
      });

      expect(job).toBeDefined();
      expect(job.id).toBeGreaterThan(0);
      expect(job.projectId).toBe(projectId);
      expect(job.title).toBe("Integration Test Job");
      expect(job.category).toBe("Testing");
      expect(job.status).toBe("pending");

      jobId = job.id;
    });

    it("Step 3: Get presigned upload URL for file", async () => {
      if (await skipIfNoDb()) return;
      if (!projectId || !jobId) {
        console.log("Skipping: No project or job created");
        return;
      }

      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const presignResult = await caller.projects.files.presignUpload({
        projectId,
        jobId,
        filename: "test-document.pdf",
        contentType: "application/pdf",
      });

      expect(presignResult).toBeDefined();
      expect(presignResult.uploadUrl).toContain("s3.amazonaws.com");
      expect(presignResult.s3Key).toContain(`projects/${projectId}/jobs/${jobId}/`);
      expect(presignResult.s3Key).toContain("test-document.pdf");

      s3Key = presignResult.s3Key;
    });

    it("Step 4: (Mock) Upload to S3", async () => {
      // In a real test, we would upload to S3 here
      // For integration test purposes, we just verify the presigned URL was generated
      if (!s3Key) {
        console.log("Skipping: No S3 key generated");
        return;
      }

      expect(s3Key).toBeDefined();
      expect(s3Key).toContain("projects/");
      console.log("✓ Mock upload successful to:", s3Key);
    });

    it("Step 5: Register file metadata after upload", async () => {
      if (await skipIfNoDb()) return;
      if (!projectId || !jobId || !s3Key) {
        console.log("Skipping: Missing prerequisite data");
        return;
      }

      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const fileMetadata = await caller.projects.files.register({
        projectId,
        jobId,
        s3Key,
        originalName: "test-document.pdf",
        mimeType: "application/pdf",
      });

      expect(fileMetadata).toBeDefined();
      expect(fileMetadata.id).toBeGreaterThan(0);
      expect(fileMetadata.projectId).toBe(projectId);
      expect(fileMetadata.jobId).toBe(jobId);
      expect(fileMetadata.s3Key).toBe(s3Key);
      expect(fileMetadata.originalName).toBe("test-document.pdf");
      expect(fileMetadata.mimeType).toBe("application/pdf");
      expect(fileMetadata.uploadedBy).toBe(testUser.id);

      fileId = fileMetadata.id;
    });

    it("Step 6: Get presigned preview URL for file", async () => {
      if (await skipIfNoDb()) return;
      if (!fileId) {
        console.log("Skipping: No file registered");
        return;
      }

      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const previewResult = await caller.projects.files.getPresignedUrl({
        fileId,
      });

      expect(previewResult).toBeDefined();
      expect(previewResult.url).toContain("s3.amazonaws.com");
      expect(previewResult.expiresIn).toBeDefined();
    });

    it("Step 7: List files by project", async () => {
      if (await skipIfNoDb()) return;
      if (!projectId) {
        console.log("Skipping: No project created");
        return;
      }

      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const files = await caller.projects.files.listByProject({ projectId });

      expect(files).toBeDefined();
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(0);
      
      const ourFile = files.find(f => f.id === fileId);
      expect(ourFile).toBeDefined();
    });

    it("Step 8: List files by job", async () => {
      if (await skipIfNoDb()) return;
      if (!projectId || !jobId) {
        console.log("Skipping: No project or job created");
        return;
      }

      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const files = await caller.projects.files.listByJob({ projectId, jobId });

      expect(files).toBeDefined();
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(0);
      
      const ourFile = files.find(f => f.id === fileId);
      expect(ourFile).toBeDefined();
    });

    it("Step 9: Update job status", async () => {
      if (await skipIfNoDb()) return;
      if (!projectId || !jobId) {
        console.log("Skipping: No project or job created");
        return;
      }

      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const updatedJob = await caller.projects.jobs.update({
        projectId,
        jobId,
        status: "in_progress",
      });

      expect(updatedJob).toBeDefined();
      expect(updatedJob.status).toBe("in_progress");
    });

    it("Step 10: Update project status", async () => {
      if (await skipIfNoDb()) return;
      if (!projectId) {
        console.log("Skipping: No project created");
        return;
      }

      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const updatedProject = await caller.projects.update({
        id: projectId,
        status: "completed",
      });

      expect(updatedProject).toBeDefined();
      expect(updatedProject.status).toBe("completed");
    });

    // Cleanup tests
    it("Cleanup: Delete file", async () => {
      if (await skipIfNoDb()) return;
      if (!projectId || !fileId) {
        console.log("Skipping cleanup: No file to delete");
        return;
      }

      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.projects.files.delete({ projectId, fileId })
      ).resolves.toEqual({ success: true });
    });

    it("Cleanup: Delete job", async () => {
      if (await skipIfNoDb()) return;
      if (!projectId || !jobId) {
        console.log("Skipping cleanup: No job to delete");
        return;
      }

      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.projects.jobs.delete({ projectId, jobId })
      ).resolves.toEqual({ success: true });
    });

    it("Cleanup: Delete project", async () => {
      if (await skipIfNoDb()) return;
      if (!projectId) {
        console.log("Skipping cleanup: No project to delete");
        return;
      }

      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.projects.delete({ id: projectId })
      ).resolves.toEqual({ success: true });
    });
  });
});

describe("Integration: Access Control", () => {
  let projectId: number;

  const skipIfNoDb = async () => {
    const dbInstance = await db.getDb();
    if (!dbInstance) {
      return true;
    }
    return false;
  };

  const otherUser = {
    id: 2,
    email: "other-user@example.com",
    name: "Other User",
    role: "user" as const,
    supabaseId: "other-supabase-id",
  };

  function createOtherUserContext(): TrpcContext {
    return {
      user: otherUser,
      setCookie: vi.fn(),
      getCookie: vi.fn(),
      clearCookie: vi.fn(),
    };
  }

  it("Setup: Create project as test user", async () => {
    if (await skipIfNoDb()) return;

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const project = await caller.projects.create({
      name: "Access Control Test Project",
      status: "active",
    });

    projectId = project.id;
    expect(projectId).toBeGreaterThan(0);
  });

  it("Other user cannot access the project", async () => {
    if (await skipIfNoDb()) return;
    if (!projectId) return;

    const ctx = createOtherUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.projects.getById({ id: projectId })
    ).rejects.toThrow("forbidden");
  });

  it("Other user cannot update the project", async () => {
    if (await skipIfNoDb()) return;
    if (!projectId) return;

    const ctx = createOtherUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.projects.update({ id: projectId, name: "Hacked!" })
    ).rejects.toThrow("forbidden");
  });

  it("Other user cannot create jobs under the project", async () => {
    if (await skipIfNoDb()) return;
    if (!projectId) return;

    const ctx = createOtherUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.projects.jobs.create({
        projectId,
        title: "Unauthorized Job",
      })
    ).rejects.toThrow("forbidden");
  });

  it("Cleanup: Delete project", async () => {
    if (await skipIfNoDb()) return;
    if (!projectId) return;

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await caller.projects.delete({ id: projectId });
  });
});

describe("Integration: Data Validation", () => {
  const skipIfNoDb = async () => {
    const dbInstance = await db.getDb();
    if (!dbInstance) {
      return true;
    }
    return false;
  };

  it("Cannot create project without name", async () => {
    if (await skipIfNoDb()) return;

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      // @ts-expect-error - Testing validation
      caller.projects.create({})
    ).rejects.toThrow();
  });

  it("Cannot create job without title", async () => {
    if (await skipIfNoDb()) return;

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // First create a project
    const project = await caller.projects.create({
      name: "Validation Test Project",
    });

    try {
      await expect(
        // @ts-expect-error - Testing validation
        caller.projects.jobs.create({
          projectId: project.id,
        })
      ).rejects.toThrow();
    } finally {
      // Cleanup
      await caller.projects.delete({ id: project.id });
    }
  });

  it("Cannot upload unsupported file types", async () => {
    if (await skipIfNoDb()) return;

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const project = await caller.projects.create({
      name: "File Type Test Project",
    });

    try {
      await expect(
        caller.projects.files.presignUpload({
          projectId: project.id,
          filename: "malicious.exe",
          contentType: "application/x-msdownload",
        })
      ).rejects.toThrow(/not allowed/i);
    } finally {
      await caller.projects.delete({ id: project.id });
    }
  });
});
