import { describe, expect, it } from "vitest";
import { formatProjectSchedule } from "./dateFormat";

describe("formatProjectSchedule", () => {
  it("parses dates provided as a JSON string", () => {
    const isoDate = "2025-01-15T00:00:00.000Z";
    const result = formatProjectSchedule({ dates: JSON.stringify([isoDate]) });

    expect(result.primaryDate?.toISOString()).toBe(isoDate);
    expect(result.label).not.toBe("Not scheduled");
  });

  it("handles serialized date objects", () => {
    const isoDate = "2025-02-20T00:00:00.000Z";
    const result = formatProjectSchedule({ dates: { serialized: [isoDate] } });

    expect(result.primaryDate?.toISOString()).toBe(isoDate);
  });

  it("falls back to start/end dates when serialized input is invalid", () => {
    const isoDate = "2025-03-01T00:00:00.000Z";
    const result = formatProjectSchedule({ dates: "not-json", start: isoDate });

    expect(result.primaryDate?.toISOString()).toBe(isoDate);
    expect(result.label).not.toBe("Not scheduled");
  });
});
