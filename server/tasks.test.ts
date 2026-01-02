import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
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

describe("tasks router", () => {
  it("should create a new task", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // First create a job to attach the task to
    const jobResult = await caller.jobs.create({
      title: "Test Job for Tasks",
      status: "active",
    });

    // Create a task
    const result = await caller.tasks.create({
      jobId: jobResult.id,
      title: "Install electrical wiring",
      description: "Complete electrical installation in main building",
      status: "todo",
      priority: "high",
    });

    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
  });

  it("should list tasks by job id", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a job
    const jobResult = await caller.jobs.create({
      title: "Job with Tasks",
      status: "active",
    });

    // Create multiple tasks
    await caller.tasks.create({
      jobId: jobResult.id,
      title: "Task 1",
      status: "todo",
      priority: "medium",
    });

    await caller.tasks.create({
      jobId: jobResult.id,
      title: "Task 2",
      status: "in_progress",
      priority: "high",
    });

    // List tasks
    const tasks = await caller.tasks.listByJob({ jobId: jobResult.id });

    expect(Array.isArray(tasks)).toBe(true);
    expect(tasks.length).toBeGreaterThanOrEqual(2);
  });

  it("should update task status", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create job and task
    const jobResult = await caller.jobs.create({
      title: "Job for Status Update",
      status: "active",
    });

    const taskResult = await caller.tasks.create({
      jobId: jobResult.id,
      title: "Task to Update",
      status: "todo",
      priority: "medium",
    });

    // Update task status
    const updateResult = await caller.tasks.update({
      id: taskResult.id,
      status: "completed",
    });

    expect(updateResult.success).toBe(true);

    // Verify update
    const updatedTask = await caller.tasks.getById({ id: taskResult.id });
    expect(updatedTask?.status).toBe("completed");
  });

  it("should handle task priorities correctly", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const jobResult = await caller.jobs.create({
      title: "Priority Test Job",
      status: "active",
    });

    const priorities: Array<"low" | "medium" | "high" | "urgent"> = ["low", "medium", "high", "urgent"];

    for (const priority of priorities) {
      const result = await caller.tasks.create({
        jobId: jobResult.id,
        title: `${priority} priority task`,
        status: "todo",
        priority,
      });

      expect(result.success).toBe(true);

      const task = await caller.tasks.getById({ id: result.id });
      expect(task?.priority).toBe(priority);
    }
  });
});
