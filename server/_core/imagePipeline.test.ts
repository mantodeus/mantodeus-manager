import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredImageMetadata } from "../../drizzle/schema";
import { generateSignedVariantUrls, deleteImageVariants } from "./imagePipeline";
import { createPresignedReadUrl, deleteMultipleFromStorage } from "../storage";

vi.mock("../storage", () => {
  return {
    createPresignedReadUrl: vi.fn(async (key: string, expiresIn: number) => `signed://${key}?expires=${expiresIn}`),
    deleteMultipleFromStorage: vi.fn(async () => {}),
    getPublicUrl: vi.fn((key: string) => `public://${key}`),
    storagePut: vi.fn(),
  };
});

const mockCreatePresignedReadUrl = vi.mocked(createPresignedReadUrl);
const mockDeleteMultipleFromStorage = vi.mocked(deleteMultipleFromStorage);

const sampleMetadata: StoredImageMetadata = {
  baseName: "project_1_123",
  mimeType: "image/jpeg",
  createdAt: new Date("2024-01-01T00:00:00.000Z").toISOString(),
  variants: {
    thumb: {
      key: "projects/1/images/thumb_300.jpg",
      url: "public://projects/1/images/thumb_300.jpg",
      width: 300,
      height: 200,
      size: 1024,
    },
    preview: {
      key: "projects/1/images/preview_1200.jpg",
      url: "public://projects/1/images/preview_1200.jpg",
      width: 1200,
      height: 800,
      size: 2048,
    },
    full: {
      key: "projects/1/images/full.jpg",
      url: "public://projects/1/images/full.jpg",
      width: 2000,
      height: 1500,
      size: 4096,
    },
  },
};

describe("imagePipeline metadata helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates signed URLs when metadata is stored as a JSON string", async () => {
    const result = await generateSignedVariantUrls(JSON.stringify(sampleMetadata), 1800);

    expect(result).toEqual({
      thumb: "signed://projects/1/images/thumb_300.jpg?expires=1800",
      preview: "signed://projects/1/images/preview_1200.jpg?expires=1800",
      full: "signed://projects/1/images/full.jpg?expires=1800",
    });
    expect(mockCreatePresignedReadUrl).toHaveBeenCalledTimes(3);
  });

  it("returns null and avoids presign calls when metadata cannot be parsed", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await generateSignedVariantUrls("not-json");

    expect(result).toBeNull();
    expect(mockCreatePresignedReadUrl).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("deletes variant keys when metadata is stored as JSON string", async () => {
    await deleteImageVariants(JSON.stringify(sampleMetadata));

    expect(mockDeleteMultipleFromStorage).toHaveBeenCalledWith([
      "projects/1/images/thumb_300.jpg",
      "projects/1/images/preview_1200.jpg",
      "projects/1/images/full.jpg",
    ]);
  });

  it("skips delete when metadata is invalid", async () => {
    await deleteImageVariants(null);

    expect(mockDeleteMultipleFromStorage).not.toHaveBeenCalled();
  });
});
