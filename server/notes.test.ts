import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return { ctx };
}

describe("notes operations", () => {
  it("should create a note successfully", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.notes.create({
      title: "Test Note",
      content: "This is a test note content",
      tags: "test, important",
    });

    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
  });

  it("should list notes for the authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a note first
    await caller.notes.create({
      title: "Test Note for List",
      content: "Content for listing",
    });

    const notes = await caller.notes.list();

    expect(Array.isArray(notes)).toBe(true);
    expect(notes.length).toBeGreaterThan(0);
  });

  it("should update a note successfully", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a note
    const createResult = await caller.notes.create({
      title: "Original Title",
      content: "Original content",
    });

    // Update the note
    const updateResult = await caller.notes.update({
      id: createResult.id,
      title: "Updated Title",
      content: "Updated content",
    });

    expect(updateResult.success).toBe(true);

    // Verify the update
    const note = await caller.notes.getById({ id: createResult.id });
    expect(note?.title).toBe("Updated Title");
    expect(note?.content).toBe("Updated content");
  });

  it("should delete a note successfully", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a note
    const createResult = await caller.notes.create({
      title: "Note to Delete",
      content: "This will be deleted",
    });

    // Delete the note
    const deleteResult = await caller.notes.delete({ id: createResult.id });
    expect(deleteResult.success).toBe(true);

    // Verify deletion
    const note = await caller.notes.getById({ id: createResult.id });
    expect(note).toBeUndefined();
  });

  it("should create a note linked to a job", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a job first
    const jobResult = await caller.jobs.create({
      title: "Test Job for Note",
      description: "Job for testing note linking",
      status: "planning",
    });

    // Create a note linked to the job
    const noteResult = await caller.notes.create({
      title: "Job-linked Note",
      content: "This note is linked to a job",
      jobId: jobResult.id,
    });

    expect(noteResult.success).toBe(true);

    // Verify the link
    const note = await caller.notes.getById({ id: noteResult.id });
    expect(note?.jobId).toBe(jobResult.id);
  });

  it("should retrieve notes by job", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a job
    const jobResult = await caller.jobs.create({
      title: "Job for Notes Query",
      status: "active",
    });

    // Create notes linked to the job
    await caller.notes.create({
      title: "First Job Note",
      jobId: jobResult.id,
    });

    await caller.notes.create({
      title: "Second Job Note",
      jobId: jobResult.id,
    });

    // Query notes by job
    const jobNotes = await caller.notes.getByJob({ jobId: jobResult.id });

    expect(Array.isArray(jobNotes)).toBe(true);
    expect(jobNotes.length).toBeGreaterThanOrEqual(2);
  });

  it("should handle notes with tags", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.notes.create({
      title: "Tagged Note",
      content: "Note with multiple tags",
      tags: "urgent, follow-up, meeting",
    });

    expect(result.success).toBe(true);

    const note = await caller.notes.getById({ id: result.id });
    expect(note?.tags).toBe("urgent, follow-up, meeting");
  });
});
