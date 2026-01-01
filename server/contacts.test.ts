import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
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

  return ctx;
}

describe("contacts", () => {
  it("should list contacts for user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.contacts.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should create a contact", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.contacts.create({
      clientName: "John Doe",
      type: "private",
      streetName: "Main St",
      streetNumber: "123",
      postalCode: "12345",
      city: "Metropolis",
      country: "Germany",
      vatStatus: "not_subject_to_vat",
      email: "john@example.com",
      phoneNumber: "+1234567890",
    });

    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
  });

  it("should fail to create contact without client name", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.contacts.create({
        clientName: "",
        type: "business",
        streetName: "Main St",
        streetNumber: "123",
        postalCode: "12345",
        city: "Metropolis",
        country: "Germany",
        vatStatus: "not_subject_to_vat",
        email: "john@example.com",
      });
      expect.fail("Should have thrown error");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});

describe("invoices", () => {
  it("should list invoices for user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.invoices.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should create an invoice", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.invoices.create({
      filename: "invoice.pdf",
      fileKey: "invoices/invoice.pdf",
      fileSize: 1024,
      mimeType: "application/pdf",
    });

    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
  });

  it("should fail to create invoice without filename", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.invoices.create({
        filename: "",
        fileKey: "invoices/invoice.pdf",
      });
      expect.fail("Should have thrown error");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
