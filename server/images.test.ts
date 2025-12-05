import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

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

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Image Gallery", () => {
  let testJobId: number;
  let testImageId: number;

  beforeEach(async () => {
    // Create a test job
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    const job = await caller.jobs.create({
      title: "Test Job for Images",
      description: "Testing image gallery",
      status: "active",
    });
    testJobId = job.id;
  });

  it("should upload an image to a job", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a small test image (1x1 pixel PNG in base64)
    const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const result = await caller.images.upload({
      jobId: testJobId,
      filename: "test-image.png",
      mimeType: "image/png",
      fileSize: 100,
      base64Data,
      caption: "Test image caption",
    });

    expect(result.success).toBe(true);
    expect(result.image).toBeDefined();
    testImageId = result.image.id;
  });

  it("should list images by job ID", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Upload a test image first
    const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    
    await caller.images.upload({
      jobId: testJobId,
      filename: "test-image-1.png",
      mimeType: "image/png",
      fileSize: 100,
      base64Data,
      caption: "First test image",
    });

    await caller.images.upload({
      jobId: testJobId,
      filename: "test-image-2.png",
      mimeType: "image/png",
      fileSize: 100,
      base64Data,
      caption: "Second test image",
    });

    const images = await caller.images.listByJob({ jobId: testJobId });

    expect(images).toHaveLength(2);
    expect(images[0].filename).toBe("test-image-1.png");
    expect(images[0].caption).toBe("First test image");
    expect(images[1].filename).toBe("test-image-2.png");
    expect(images[1].caption).toBe("Second test image");
  });

  it("should upload image without caption", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const result = await caller.images.upload({
      jobId: testJobId,
      filename: "no-caption.png",
      mimeType: "image/png",
      fileSize: 100,
      base64Data,
    });

    expect(result.success).toBe(true);
    
    const images = await caller.images.listByJob({ jobId: testJobId });
    const uploadedImage = images.find(img => img.filename === "no-caption.png");
    
    expect(uploadedImage).toBeDefined();
    expect(uploadedImage?.caption).toBeNull();
  });

  it("should delete an image", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Upload an image first
    const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    
    const uploadResult = await caller.images.upload({
      jobId: testJobId,
      filename: "to-delete.png",
      mimeType: "image/png",
      fileSize: 100,
      base64Data,
    });

    // Delete the image
    const deleteResult = await caller.images.delete({ id: uploadResult.image.id });
    expect(deleteResult.success).toBe(true);

    // Verify it's deleted
    const images = await caller.images.listByJob({ jobId: testJobId });
    const deletedImage = images.find(img => img.id === uploadResult.image.id);
    expect(deletedImage).toBeUndefined();
  });

  it("should store image metadata correctly", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const result = await caller.images.upload({
      jobId: testJobId,
      filename: "metadata-test.png",
      mimeType: "image/png",
      fileSize: 12345,
      base64Data,
      caption: "Testing metadata",
    });

    const images = await caller.images.listByJob({ jobId: testJobId });
    const uploadedImage = images.find(img => img.id === result.image.id);

    expect(uploadedImage).toBeDefined();
    expect(uploadedImage?.filename).toBe("metadata-test.png");
    expect(uploadedImage?.mimeType).toBe("image/png");
    expect(uploadedImage?.fileSize).toBe(12345);
    expect(uploadedImage?.caption).toBe("Testing metadata");
    expect(uploadedImage?.uploadedBy).toBe(ctx.user.id);
    expect(uploadedImage?.jobId).toBe(testJobId);
    expect(uploadedImage?.createdAt).toBeInstanceOf(Date);
  });

  it("should return empty array for job with no images", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a new job without images
    const job = await caller.jobs.create({
      title: "Job without images",
      status: "planning",
    });

    const images = await caller.images.listByJob({ jobId: job.id });
    expect(images).toHaveLength(0);
  });

  it("should support multiple image formats", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    // Upload PNG
    await caller.images.upload({
      jobId: testJobId,
      filename: "test.png",
      mimeType: "image/png",
      fileSize: 100,
      base64Data,
    });

    // Upload JPEG
    await caller.images.upload({
      jobId: testJobId,
      filename: "test.jpg",
      mimeType: "image/jpeg",
      fileSize: 100,
      base64Data,
    });

    // Upload WebP
    await caller.images.upload({
      jobId: testJobId,
      filename: "test.webp",
      mimeType: "image/webp",
      fileSize: 100,
      base64Data,
    });

    const images = await caller.images.listByJob({ jobId: testJobId });
    
    expect(images).toHaveLength(3);
    expect(images.some(img => img.mimeType === "image/png")).toBe(true);
    expect(images.some(img => img.mimeType === "image/jpeg")).toBe(true);
    expect(images.some(img => img.mimeType === "image/webp")).toBe(true);
  });
});
