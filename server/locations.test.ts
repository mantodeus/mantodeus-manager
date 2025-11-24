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

describe("locations operations", () => {
  it("should create a location successfully", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.locations.create({
      name: "Test Location",
      latitude: "46.8182",
      longitude: "8.2275",
      address: "Zurich, Switzerland",
      type: "custom",
    });

    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
  });

  it("should list locations for the authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a location first
    await caller.locations.create({
      name: "Location for List",
      latitude: "47.3769",
      longitude: "8.5417",
      type: "custom",
    });

    const locations = await caller.locations.list();

    expect(Array.isArray(locations)).toBe(true);
    expect(locations.length).toBeGreaterThan(0);
  });

  it("should delete a location successfully", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a location
    const createResult = await caller.locations.create({
      name: "Location to Delete",
      latitude: "46.9480",
      longitude: "7.4474",
      type: "custom",
    });

    // Delete the location
    const deleteResult = await caller.locations.delete({ id: createResult.id });
    expect(deleteResult.success).toBe(true);
  });

  it("should create a job location", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a job first
    const jobResult = await caller.jobs.create({
      title: "Test Job for Location",
      description: "Job for testing location linking",
      status: "planning",
    });

    // Create a location linked to the job
    const locationResult = await caller.locations.create({
      name: "Job Site Location",
      latitude: "47.0502",
      longitude: "8.3093",
      address: "Lucerne, Switzerland",
      type: "job",
      jobId: jobResult.id,
    });

    expect(locationResult.success).toBe(true);

    // Verify by querying locations by job
    const jobLocations = await caller.locations.getByJob({ jobId: jobResult.id });
    expect(Array.isArray(jobLocations)).toBe(true);
    expect(jobLocations.length).toBeGreaterThan(0);
  });

  it("should retrieve locations by type", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create locations of different types
    await caller.locations.create({
      name: "Custom Location 1",
      latitude: "46.0",
      longitude: "8.0",
      type: "custom",
    });

    await caller.locations.create({
      name: "Custom Location 2",
      latitude: "46.1",
      longitude: "8.1",
      type: "custom",
    });

    // Query by type
    const customLocations = await caller.locations.getByType({ type: "custom" });

    expect(Array.isArray(customLocations)).toBe(true);
    expect(customLocations.length).toBeGreaterThanOrEqual(2);
    expect(customLocations.every((loc) => loc.type === "custom")).toBe(true);
  });

  it("should create a contact location", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a contact first
    const contactResult = await caller.contacts.create({
      name: "Test Contact for Location",
      email: "contact@example.com",
      phone: "+41 44 123 4567",
    });

    // Create a location linked to the contact
    const locationResult = await caller.locations.create({
      name: "Contact Office Location",
      latitude: "47.3769",
      longitude: "8.5417",
      address: "Zurich Office",
      type: "contact",
      contactId: contactResult.id,
    });

    expect(locationResult.success).toBe(true);

    // Verify by querying locations by contact
    const contactLocations = await caller.locations.getByContact({ contactId: contactResult.id });
    expect(Array.isArray(contactLocations)).toBe(true);
    expect(contactLocations.length).toBeGreaterThan(0);
  });

  it("should handle locations with precise coordinates", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.locations.create({
      name: "Precise Location",
      latitude: "46.818188",
      longitude: "8.227512",
      address: "Exact coordinates test",
      type: "custom",
    });

    expect(result.success).toBe(true);
  });
});
