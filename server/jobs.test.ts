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
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("jobs router", () => {
  it("should create a new job", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.jobs.create({
      title: "Test Construction Project",
      description: "A test project for unit testing",
      location: "123 Test Street",
      status: "planning",
    });

    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
  });

  it("should list all jobs", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const jobs = await caller.jobs.list();

    expect(Array.isArray(jobs)).toBe(true);
  });

  it("should get a job by id", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // First create a job
    const createResult = await caller.jobs.create({
      title: "Test Job for Retrieval",
      status: "active",
    });

    // Then retrieve it
    const job = await caller.jobs.getById({ id: createResult.id });

    expect(job).toBeDefined();
    expect(job?.title).toBe("Test Job for Retrieval");
    expect(job?.status).toBe("active");
  });

  it("should update a job", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a job
    const createResult = await caller.jobs.create({
      title: "Job to Update",
      status: "planning",
    });

    // Update it
    const updateResult = await caller.jobs.update({
      id: createResult.id,
      status: "active",
      title: "Updated Job Title",
    });

    expect(updateResult.success).toBe(true);

    // Verify the update
    const updatedJob = await caller.jobs.getById({ id: createResult.id });
    expect(updatedJob?.title).toBe("Updated Job Title");
    expect(updatedJob?.status).toBe("active");
  });

  it("should require authentication for job operations", async () => {
    const unauthenticatedCtx: TrpcContext = {
      user: null,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {
        clearCookie: () => {},
      } as TrpcContext["res"],
    };

    const caller = appRouter.createCaller(unauthenticatedCtx);

    await expect(caller.jobs.list()).rejects.toThrow();
  });
});
