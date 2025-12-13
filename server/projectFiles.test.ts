/**
 * Project Files Router Tests
 * 
 * Tests for S3 file operations:
 * - Presign upload
 * - Register file
 * - Get presigned URL
 * - List files
 * - Delete files
 */

import { describe, expect, it, vi } from "vitest";
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
// PRESIGN UPLOAD TESTS
// =============================================================================

describe("projects.files.presignUpload", () => {
  it("should generate presigned upload URL", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a project first
    const project = await caller.projects.create({
      name: "Project for File Upload",
    });

    // Request presigned URL
    const result = await caller.projects.files.presignUpload({
      projectId: project.id,
      filename: "test-document.pdf",
      contentType: "application/pdf",
    });

    expect(result).toBeDefined();
    expect(result.uploadUrl).toBeDefined();
    expect(result.s3Key).toBeDefined();
    expect(result.s3Key).toContain(`projects/${project.id}/_project/`);
    expect(result.s3Key).toContain("test-document.pdf");
  });

  it("should include jobId in S3 key when provided", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const project = await caller.projects.create({
      name: "Project with Job Files",
    });

    const job = await caller.projects.jobs.create({
      projectId: project.id,
      title: "Job with Files",
    });

    const result = await caller.projects.files.presignUpload({
      projectId: project.id,
      jobId: job.id,
      filename: "job-file.pdf",
      contentType: "application/pdf",
    });

    expect(result.s3Key).toContain(`projects/${project.id}/jobs/${job.id}/`);
  });

  it("should validate MIME type", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const project = await caller.projects.create({
      name: "Project for MIME Test",
    });

    await expect(
      caller.projects.files.presignUpload({
        projectId: project.id,
        filename: "malicious.exe",
        contentType: "application/x-msdownload",
      })
    ).rejects.toThrow("Invalid file type");
  });

  it("should require authentication", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.projects.files.presignUpload({
        projectId: 1,
        filename: "test.pdf",
        contentType: "application/pdf",
      })
    ).rejects.toThrow();
  });

  it("should require project access", async () => {
    const { ctx: ownerCtx } = createAuthContext();
    const { ctx: otherCtx } = createOtherUserContext();

    const ownerCaller = appRouter.createCaller(ownerCtx);
    const otherCaller = appRouter.createCaller(otherCtx);

    const project = await ownerCaller.projects.create({
      name: "Owner's Project",
    });

    await expect(
      otherCaller.projects.files.presignUpload({
        projectId: project.id,
        filename: "unauthorized.pdf",
        contentType: "application/pdf",
      })
    ).rejects.toThrow("permission");
  });
});

// =============================================================================
// REGISTER FILE TESTS
// =============================================================================

describe("projects.files.register", () => {
  it("should register a file in the database", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const project = await caller.projects.create({
      name: "Project for Registration",
    });

    const result = await caller.projects.files.register({
      projectId: project.id,
      s3Key: `projects/${project.id}/_project/123-abc-test.pdf`,
      originalName: "test.pdf",
      mimeType: "application/pdf",
      fileSize: 12345,
    });

    expect(result.success).toBe(true);
    expect(result.file).toBeDefined();
    expect(result.file?.originalName).toBe("test.pdf");
    expect(result.file?.mimeType).toBe("application/pdf");
  });

  it("should be idempotent (registering same file twice returns existing)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const project = await caller.projects.create({
      name: "Project for Idempotency Test",
    });

    const s3Key = `projects/${project.id}/_project/456-def-unique.pdf`;

    // First registration
    const result1 = await caller.projects.files.register({
      projectId: project.id,
      s3Key,
      originalName: "unique.pdf",
      mimeType: "application/pdf",
    });

    expect(result1.alreadyRegistered).toBe(false);

    // Second registration with same key
    const result2 = await caller.projects.files.register({
      projectId: project.id,
      s3Key,
      originalName: "unique.pdf",
      mimeType: "application/pdf",
    });

    expect(result2.alreadyRegistered).toBe(true);
    expect(result2.file?.id).toBe(result1.file?.id);
  });

  it("should validate S3 key belongs to project", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const project = await caller.projects.create({
      name: "Project for Key Validation",
    });

    await expect(
      caller.projects.files.register({
        projectId: project.id,
        s3Key: "projects/99999/_project/wrong-project.pdf",
        originalName: "wrong.pdf",
        mimeType: "application/pdf",
      })
    ).rejects.toThrow("Invalid S3 key format");
  });
});

// =============================================================================
// GET PRESIGNED URL TESTS
// =============================================================================

describe("projects.files.getPresignedUrl", () => {
  it("should get presigned URL by file ID", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const project = await caller.projects.create({
      name: "Project for URL Test",
    });

    // Register a file first
    const registerResult = await caller.projects.files.register({
      projectId: project.id,
      s3Key: `projects/${project.id}/_project/789-ghi-viewable.pdf`,
      originalName: "viewable.pdf",
      mimeType: "application/pdf",
    });

    // Get presigned URL
    const result = await caller.projects.files.getPresignedUrl({
      fileId: registerResult.file!.id,
    });

    expect(result.url).toBeDefined();
    expect(result.expiresIn).toBeDefined();
    expect(result.file).toBeDefined();
  });

  it("should get presigned URL by S3 key", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const project = await caller.projects.create({
      name: "Project for S3 Key Test",
    });

    const s3Key = `projects/${project.id}/_project/abc-123-bykey.pdf`;

    await caller.projects.files.register({
      projectId: project.id,
      s3Key,
      originalName: "bykey.pdf",
      mimeType: "application/pdf",
    });

    const result = await caller.projects.files.getPresignedUrl({
      s3Key,
    });

    expect(result.url).toBeDefined();
    expect(result.file?.s3Key).toBe(s3Key);
  });

  it("should throw NOT_FOUND for non-existent file", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.projects.files.getPresignedUrl({
        fileId: 999999,
      })
    ).rejects.toThrow("not found");
  });

  it("should require project access", async () => {
    const { ctx: ownerCtx } = createAuthContext();
    const { ctx: otherCtx } = createOtherUserContext();

    const ownerCaller = appRouter.createCaller(ownerCtx);
    const otherCaller = appRouter.createCaller(otherCtx);

    const project = await ownerCaller.projects.create({
      name: "Owner's Private Project",
    });

    const registerResult = await ownerCaller.projects.files.register({
      projectId: project.id,
      s3Key: `projects/${project.id}/_project/private.pdf`,
      originalName: "private.pdf",
      mimeType: "application/pdf",
    });

    await expect(
      otherCaller.projects.files.getPresignedUrl({
        fileId: registerResult.file!.id,
      })
    ).rejects.toThrow("permission");
  });
});

// =============================================================================
// LIST FILES TESTS
// =============================================================================

describe("projects.files.listByProject", () => {
  it("should list all files for a project", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const project = await caller.projects.create({
      name: "Project with Files",
    });

    // Register some files
    await caller.projects.files.register({
      projectId: project.id,
      s3Key: `projects/${project.id}/_project/file1.pdf`,
      originalName: "file1.pdf",
      mimeType: "application/pdf",
    });

    await caller.projects.files.register({
      projectId: project.id,
      s3Key: `projects/${project.id}/_project/file2.png`,
      originalName: "file2.pdf",
      mimeType: "application/pdf",
    });

    const files = await caller.projects.files.listByProject({
      projectId: project.id,
    });

    expect(Array.isArray(files)).toBe(true);
    expect(files.length).toBeGreaterThanOrEqual(2);
  });
});

describe("projects.files.listByJob", () => {
  it("should list files for a specific job", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const project = await caller.projects.create({
      name: "Project with Job Files",
    });

    const job = await caller.projects.jobs.create({
      projectId: project.id,
      title: "Job with Files",
    });

    // Register a job file
    await caller.projects.files.register({
      projectId: project.id,
      jobId: job.id,
      s3Key: `projects/${project.id}/jobs/${job.id}/job-file.pdf`,
      originalName: "job-file.pdf",
      mimeType: "application/pdf",
    });

    const files = await caller.projects.files.listByJob({
      projectId: project.id,
      jobId: job.id,
    });

    expect(Array.isArray(files)).toBe(true);
    expect(files.length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// DELETE FILE TESTS
// =============================================================================

describe("projects.files.delete", () => {
  it("should delete a file", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const project = await caller.projects.create({
      name: "Project for Delete Test",
    });

    const registerResult = await caller.projects.files.register({
      projectId: project.id,
      s3Key: `projects/${project.id}/_project/to-delete.pdf`,
      originalName: "to-delete.pdf",
      mimeType: "application/pdf",
    });

    const deleteResult = await caller.projects.files.delete({
      fileId: registerResult.file!.id,
    });

    expect(deleteResult.success).toBe(true);

    // Verify deletion
    await expect(
      caller.projects.files.getPresignedUrl({
        fileId: registerResult.file!.id,
      })
    ).rejects.toThrow("not found");
  });

  it("should require project access to delete", async () => {
    const { ctx: ownerCtx } = createAuthContext();
    const { ctx: otherCtx } = createOtherUserContext();

    const ownerCaller = appRouter.createCaller(ownerCtx);
    const otherCaller = appRouter.createCaller(otherCtx);

    const project = await ownerCaller.projects.create({
      name: "Owner's Project with File",
    });

    const registerResult = await ownerCaller.projects.files.register({
      projectId: project.id,
      s3Key: `projects/${project.id}/_project/protected.pdf`,
      originalName: "protected.pdf",
      mimeType: "application/pdf",
    });

    await expect(
      otherCaller.projects.files.delete({
        fileId: registerResult.file!.id,
      })
    ).rejects.toThrow("permission");
  });
});
