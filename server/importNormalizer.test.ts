import { describe, expect, it } from "vitest";
import { normalizeExportPayload } from "../shared/importNormalizer";

describe("normalizeExportPayload", () => {
  it("returns data unchanged when already normalized", () => {
    const payload = {
      version: "1.0",
      exportedAt: "2025-11-30T19:34:34.917Z",
      jobs: [
        {
          title: "Existing Job",
          status: "active",
        },
      ],
      contacts: [
        {
          name: "Contact",
        },
      ],
    };

    expect(normalizeExportPayload(payload)).toEqual(payload);
  });

  it("normalizes legacy exports", () => {
    const legacyPayload = {
      exportDate: "2025-11-30T19:34:34.917Z",
      data: {
        jobs: [
          {
            id: 1,
            title: "Legacy Job",
            status: "active",
            dateMode: "individual",
            startDate: "2025-11-01T00:00:00.000Z",
            endDate: "2025-11-02T00:00:00.000Z",
          },
          {
            id: 2,
            title: "",
            status: "unknown",
          },
        ],
        tasks: [
          {
            jobId: 1,
            title: "Legacy Task",
            status: "todo",
            priority: "high",
            dueDate: "2025-12-01T00:00:00.000Z",
          },
        ],
        comments: [
          { jobId: 1, content: "Looks good" },
          { jobId: 1, content: null },
        ],
        reports: [
          { jobId: 1, title: "Weekly Report", type: "weekly" },
        ],
        jobDates: [
          { jobId: 1, date: "2025-11-05T00:00:00.000Z" },
        ],
        contacts: [
          {
            name: "Legacy Contact",
            email: "legacy@example.com",
          },
        ],
        notes: [
          {
            title: "Legacy Note",
            content: "Some note text",
          },
        ],
        locations: [
          {
            name: "Custom Location",
            latitude: "52.5",
            longitude: "13.4",
            type: "custom",
          },
          {
            name: "Job Location",
            latitude: "10",
            longitude: "11",
            type: "job",
          },
          {
            name: "Missing Coords",
            latitude: null,
            longitude: null,
            type: "custom",
          },
        ],
      },
    };

    const normalized = normalizeExportPayload(legacyPayload);

    expect(normalized.version).toBe("legacy-1.0");
    expect(normalized.exportedAt).toBe("2025-11-30T19:34:34.917Z");
    expect(normalized.jobs).toHaveLength(2);
    expect(normalized.jobs?.[0].title).toBe("Legacy Job");
    expect(normalized.jobs?.[0].status).toBe("active");
    expect(normalized.jobs?.[0].dateMode).toBe("individual");
    expect(normalized.jobs?.[0].tasks).toHaveLength(1);
    expect(normalized.jobs?.[0].tasks?.[0].title).toBe("Legacy Task");
    expect(normalized.jobs?.[0].comments).toHaveLength(1);
    expect(normalized.jobs?.[0].comments?.[0].content).toBe("Looks good");
    expect(normalized.jobs?.[0].reports).toHaveLength(1);
    expect(normalized.jobs?.[0].reports?.[0].type).toBe("weekly");
    expect(normalized.jobs?.[0].individualDates).toEqual(["2025-11-05T00:00:00.000Z"]);
    expect(normalized.jobs?.[1].status).toBe("planning");
    expect(normalized.jobs?.[1].title).toBe("Untitled Job");
    expect(normalized.contacts).toHaveLength(1);
    expect(normalized.notes).toHaveLength(1);
    expect(normalized.locations).toHaveLength(1);
    expect(normalized.locations?.[0].name).toBe("Custom Location");
  });

  it("throws for unsupported structures", () => {
    expect(() => normalizeExportPayload({})).toThrowError("Invalid export file format");
  });
});
