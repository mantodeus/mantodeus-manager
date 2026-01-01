const JOB_STATUSES = ["planning", "active", "on_hold", "completed", "cancelled"] as const;
const TASK_STATUSES = ["todo", "in_progress", "review", "completed"] as const;
const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const REPORT_TYPES = ["daily", "weekly", "task_summary", "progress", "custom"] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type ReportType = (typeof REPORT_TYPES)[number];

export interface NormalizedTask {
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
}

export interface NormalizedComment {
  content: string;
}

export interface NormalizedReport {
  title: string;
  type: ReportType;
  content?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface NormalizedJob {
  title: string;
  description?: string | null;
  location?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  status: JobStatus;
  dateMode?: "range" | "individual";
  startDate?: string | null;
  endDate?: string | null;
  contactId?: number | null;
  tasks?: NormalizedTask[];
  comments?: NormalizedComment[];
  reports?: NormalizedReport[];
  individualDates?: string[];
}

export interface NormalizedContact {
  name: string;
  clientName?: string | null;
  type?: "business" | "private";
  contactPerson?: string | null;
  streetName?: string | null;
  streetNumber?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  vatStatus?: "subject_to_vat" | "not_subject_to_vat";
  vatNumber?: string | null;
  taxNumber?: string | null;
  leitwegId?: string | null;
  email?: string | null;
  phone?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  notes?: string | null;
}

export interface NormalizedNote {
  title: string;
  content?: string | null;
  tags?: string | null;
}

export interface NormalizedLocation {
  name: string;
  latitude: string;
  longitude: string;
  address?: string | null;
  type: "job" | "contact" | "custom";
}

export interface NormalizedExportPayload {
  version: string;
  exportedAt: string;
  jobs?: NormalizedJob[];
  contacts?: NormalizedContact[];
  notes?: NormalizedNote[];
  locations?: NormalizedLocation[];
}

type LegacyJob = {
  id?: number;
  title?: string;
  description?: string | null;
  location?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  status?: string | null;
  dateMode?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

type LegacyTask = {
  jobId?: number | null;
  title?: string;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  dueDate?: string | null;
};

type LegacyComment = {
  jobId?: number | null;
  content?: string | null;
};

type LegacyReport = {
  jobId?: number | null;
  title?: string;
  type?: string | null;
  content?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

type LegacyJobDate = {
  jobId?: number | null;
  date?: string | null;
};

type LegacyContact = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  notes?: string | null;
};

type LegacyNote = {
  title?: string | null;
  content?: string | null;
  tags?: string | null;
};

type LegacyLocation = {
  name?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  address?: string | null;
  type?: string | null;
};

type LegacyPayload = {
  exportDate?: string;
  data?: {
    jobs?: LegacyJob[];
    tasks?: LegacyTask[];
    contacts?: LegacyContact[];
    notes?: LegacyNote[];
    locations?: LegacyLocation[];
    comments?: LegacyComment[];
    reports?: LegacyReport[];
    jobDates?: LegacyJobDate[];
  };
};

const isNormalizedPayload = (input: unknown): input is NormalizedExportPayload => {
  if (!input || typeof input !== "object") {
    return false;
  }

  const candidate = input as Record<string, unknown>;
  return typeof candidate.version === "string" && typeof candidate.exportedAt === "string";
};

const isLegacyPayload = (input: unknown): input is LegacyPayload => {
  if (!input || typeof input !== "object") {
    return false;
  }
  const candidate = input as Record<string, unknown>;
  const dataSection = candidate.data;
  if (!dataSection || typeof dataSection !== "object") {
    return false;
  }
  if (typeof candidate.exportDate === "string") {
    return true;
  }

  const section = dataSection as Record<string, unknown>;
  return (
    Array.isArray(section.jobs) ||
    Array.isArray(section.contacts) ||
    Array.isArray(section.notes) ||
    Array.isArray(section.locations)
  );
};

export const normalizeExportPayload = (input: unknown): NormalizedExportPayload => {
  if (isNormalizedPayload(input)) {
    return input;
  }

  if (isLegacyPayload(input)) {
    return transformLegacyPayload(input);
  }

  throw new Error("Invalid export file format");
};

const transformLegacyPayload = (payload: LegacyPayload): NormalizedExportPayload => {
  const legacy = payload.data ?? {};

  const tasksByJobId = groupByJobId(legacy.tasks);
  const commentsByJobId = groupByJobId(legacy.comments);
  const reportsByJobId = groupByJobId(legacy.reports);
  const datesByJobId = groupByJobId(legacy.jobDates);

  const jobs = (legacy.jobs ?? [])
    .map((job): NormalizedJob => {
      const jobId = job.id ?? 0;
      const individualDates = compactStrings(datesByJobId.get(jobId));
      const jobTasks = (tasksByJobId.get(jobId) ?? []).map(normalizeTask);
      const jobComments = (commentsByJobId.get(jobId) ?? [])
        .map(normalizeComment)
        .filter(isNotNull);
      const jobReports = (reportsByJobId.get(jobId) ?? []).map(normalizeReport);

      return {
        title: sanitizeRequiredString(job.title, "Untitled Job"),
        description: sanitizeNullableString(job.description),
        location: sanitizeNullableString(job.location),
        latitude: sanitizeNullableString(job.latitude),
        longitude: sanitizeNullableString(job.longitude),
        status: coerceJobStatus(job.status),
        dateMode: toDateMode(job.dateMode),
        startDate: coerceDate(job.startDate),
        endDate: coerceDate(job.endDate),
        tasks: jobTasks.length > 0 ? jobTasks : undefined,
        comments: jobComments.length > 0 ? jobComments : undefined,
        reports: jobReports.length > 0 ? jobReports : undefined,
        individualDates: individualDates.length > 0 ? individualDates : undefined,
      };
    })
    .filter(Boolean);

  const contacts = (legacy.contacts ?? [])
    .map((contact): NormalizedContact => {
      const name = sanitizeRequiredString(contact.name, "Imported contact");
      return {
        name,
        clientName: name,
        type: "business",
        vatStatus: "not_subject_to_vat",
        email: sanitizeNullableString(contact.email),
        phone: sanitizeNullableString(contact.phone),
        phoneNumber: sanitizeNullableString(contact.phone),
        address: sanitizeNullableString(contact.address),
        latitude: sanitizeNullableString(contact.latitude),
        longitude: sanitizeNullableString(contact.longitude),
        notes: sanitizeNullableString(contact.notes),
      };
    })
    .filter(Boolean);

  const notes = (legacy.notes ?? [])
    .map((note): NormalizedNote => ({
      title: sanitizeRequiredString(note.title, "Imported note"),
      content: sanitizeNullableString(note.content),
      tags: sanitizeNullableString(note.tags),
    }))
    .filter(Boolean);

  const locations = (legacy.locations ?? [])
    .filter(location => location.type === "custom")
    .map((location): NormalizedLocation | null => {
      const latitude = sanitizeNullableString(location.latitude);
      const longitude = sanitizeNullableString(location.longitude);
      if (!latitude || !longitude) {
        return null;
      }

      return {
        name: sanitizeRequiredString(location.name, "Imported location"),
        latitude,
        longitude,
        address: sanitizeNullableString(location.address),
        type: "custom",
      };
    })
    .filter(isNotNull);

  return {
    version: "legacy-1.0",
    exportedAt: payload.exportDate ?? new Date().toISOString(),
    jobs: jobs.length > 0 ? jobs : undefined,
    contacts: contacts.length > 0 ? contacts : undefined,
    notes: notes.length > 0 ? notes : undefined,
    locations: locations.length > 0 ? locations : undefined,
  };
};

const normalizeTask = (task: LegacyTask): NormalizedTask => ({
  title: sanitizeRequiredString(task.title, "Imported task"),
  description: sanitizeNullableString(task.description),
  status: coerceTaskStatus(task.status),
  priority: coerceTaskPriority(task.priority),
  dueDate: coerceDate(task.dueDate),
});

const normalizeComment = (comment: LegacyComment): NormalizedComment | null => {
  const content = sanitizeNullableString(comment.content);
  if (!content) {
    return null;
  }
  return { content };
};

const normalizeReport = (report: LegacyReport): NormalizedReport => ({
  title: sanitizeRequiredString(report.title, "Imported report"),
  type: coerceReportType(report.type),
  content: sanitizeNullableString(report.content),
  startDate: coerceDate(report.startDate),
  endDate: coerceDate(report.endDate),
});

const groupByJobId = <T extends { jobId?: number | null }>(
  entries?: T[],
): Map<number, T[]> => {
  const map = new Map<number, T[]>();
  for (const entry of entries ?? []) {
    if (!entry || entry.jobId == null) {
      continue;
    }
    const bucket = map.get(entry.jobId) ?? [];
    bucket.push(entry);
    map.set(entry.jobId, bucket);
  }
  return map;
};

const compactStrings = (entries?: LegacyJobDate[]): string[] => {
  if (!entries) {
    return [];
  }
  return entries
    .map(entry => coerceDate(entry.date))
    .filter(isNotNull);
};

const sanitizeNullableString = (value: unknown): string | null => {
  if (value == null) {
    return null;
  }
  const str = String(value).trim();
  return str.length ? str : null;
};

const sanitizeRequiredString = (value: unknown, fallback: string): string => {
  const sanitized = sanitizeNullableString(value);
  return sanitized ?? fallback;
};

const coerceJobStatus = (value: unknown): JobStatus => {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  return JOB_STATUSES.includes(normalized as JobStatus) ? (normalized as JobStatus) : "planning";
};

const coerceTaskStatus = (value: unknown): TaskStatus => {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  return TASK_STATUSES.includes(normalized as TaskStatus)
    ? (normalized as TaskStatus)
    : "todo";
};

const coerceTaskPriority = (value: unknown): TaskPriority => {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  return TASK_PRIORITIES.includes(normalized as TaskPriority)
    ? (normalized as TaskPriority)
    : "medium";
};

const coerceReportType = (value: unknown): ReportType => {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  return REPORT_TYPES.includes(normalized as ReportType)
    ? (normalized as ReportType)
    : "custom";
};

const toDateMode = (value: unknown): "range" | "individual" => {
  return value === "individual" ? "individual" : "range";
};

const coerceDate = (value: unknown): string | null => {
  if (value == null) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString();
  }

  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? null : date.toISOString();
  }

  if (typeof value === "string") {
    return Number.isNaN(Date.parse(value)) ? null : value;
  }

  const timestamp = Date.parse(String(value));
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
};

const isNotNull = <T>(value: T | null | undefined): value is T => value != null;

