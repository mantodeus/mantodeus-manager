// MySQL schema for Mantodeus Manager
import { mysqlTable, mysqlEnum, int, text, timestamp, varchar, boolean, json, decimal, index, unique } from "drizzle-orm/mysql-core";

// =============================================================================
// Shared Image Metadata Types
// =============================================================================

export type ImageVariantRecord = {
  /** S3 object key for this variant */
  key: string;
  /** Non-signed URL (mainly useful for debugging) */
  url: string;
  width: number;
  height: number;
  /** File size in bytes */
  size: number;
};

export type StoredImageMetadata = {
  /** project_<projectId>_<timestamp> */
  baseName: string;
  mimeType: string;
  variants: {
    thumb: ImageVariantRecord;
    preview: ImageVariantRecord;
    full: ImageVariantRecord;
  };
  createdAt: string;
};

// =============================================================================
// CORE TABLES
// =============================================================================

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  /** Supabase user ID (UUID) returned from Supabase Auth. Unique per user. */
  supabaseId: varchar("supabaseId", { length: 36 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// =============================================================================
// PROJECT-BASED STRUCTURE
// =============================================================================

/**
 * Projects table - top-level entity representing client projects/engagements.
 */
export const projects = mysqlTable("projects", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  client: varchar("client", { length: 255 }),
  clientId: int("clientId").references(() => contacts.id, { onDelete: "set null" }),
  description: text("description"),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  address: text("address"),
  /** Geographic coordinates stored as JSON: { lat: number, lng: number } */
  geo: json("geo").$type<{ lat: number; lng: number } | null>(),
  /** Optional list of explicitly selected schedule dates */
  scheduledDates: json("scheduledDates").$type<string[] | null>(),
  status: mysqlEnum("status", ["planned", "active", "completed", "archived"]).default("planned").notNull(),
  /** Timestamp when project was archived (null if active) */
  archivedAt: timestamp("archivedAt"),
  /** Timestamp when project was moved to trash (null if not trashed) */
  trashedAt: timestamp("trashedAt"),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("projects_status_idx").on(table.status),
  index("projects_createdBy_idx").on(table.createdBy),
  index("projects_clientId_idx").on(table.clientId),
  index("projects_archivedAt_idx").on(table.archivedAt),
  index("projects_trashedAt_idx").on(table.trashedAt),
]);

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * Project Jobs table - work items nested under projects.
 */
export const projectJobs = mysqlTable("project_jobs", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }),
  description: text("description"),
  /** Array of user IDs assigned to this job. Stored as JSON for simplicity. */
  assignedUsers: json("assignedUsers").$type<number[]>(),
  status: mysqlEnum("status", ["pending", "in_progress", "done", "cancelled"]).default("pending").notNull(),
  startTime: timestamp("startTime"),
  endTime: timestamp("endTime"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("project_jobs_projectId_idx").on(table.projectId),
  index("project_jobs_status_idx").on(table.status),
  index("project_jobs_projectId_status_idx").on(table.projectId, table.status),
]);

export type ProjectJob = typeof projectJobs.$inferSelect;
export type InsertProjectJob = typeof projectJobs.$inferInsert;

/**
 * File Metadata table - tracks files uploaded to S3 for projects/jobs.
 */
export const fileMetadata = mysqlTable("file_metadata", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
  /** Nullable - if null, file belongs to project level, not a specific job */
  jobId: int("jobId").references(() => projectJobs.id, { onDelete: "cascade" }),
  s3Key: varchar("s3Key", { length: 500 }).notNull(),
  originalName: varchar("originalName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  /** File size in bytes - useful for display and validation */
  fileSize: int("fileSize"),
  uploadedBy: int("uploadedBy").notNull().references(() => users.id),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  /** Optional responsive image metadata when the file is an image */
  imageMetadata: json("imageMetadata").$type<StoredImageMetadata | null>(),
  /** Tags for photos: ["safety", "defect", "anchor", "quote", "before", "after"] */
  tags: json("tags").$type<string[] | null>(),
  /** Timestamp when file was moved to trash (null if not trashed) */
  trashedAt: timestamp("trashedAt"),
}, (table) => [
  index("file_metadata_projectId_idx").on(table.projectId),
  index("file_metadata_jobId_idx").on(table.jobId),
  index("file_metadata_projectId_jobId_idx").on(table.projectId, table.jobId),
  index("file_metadata_uploadedBy_idx").on(table.uploadedBy),
  index("file_metadata_trashedAt_idx").on(table.trashedAt),
]);

export type FileMetadata = typeof fileMetadata.$inferSelect;
export type InsertFileMetadata = typeof fileMetadata.$inferInsert;

// =============================================================================
// LEGACY TABLES (kept for backward compatibility)
// =============================================================================

/**
 * Contacts table - stores client/contact information
 */
export const contacts = mysqlTable("contacts", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  address: text("address"),
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
  notes: text("notes"),
  /** Timestamp when contact was archived (null if active) */
  archivedAt: timestamp("archivedAt"),
  /** Timestamp when contact was moved to trash (null if not trashed) */
  trashedAt: timestamp("trashedAt"),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("contacts_createdBy_idx").on(table.createdBy),
  index("contacts_archivedAt_idx").on(table.archivedAt),
  index("contacts_trashedAt_idx").on(table.trashedAt),
]);

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

/**
 * Jobs table - represents construction projects
 * @deprecated This is the legacy jobs table. New code should use `projects` table.
 */
export const jobs = mysqlTable("jobs", {
  id: int("id").primaryKey().autoincrement(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 500 }),
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
  status: mysqlEnum("status", ["planning", "active", "on_hold", "completed", "cancelled"]).default("planning").notNull(),
  dateMode: mysqlEnum("dateMode", ["range", "individual"]).default("range").notNull(),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  contactId: int("contactId").references(() => contacts.id),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

/**
 * JobDates table - stores individual dates for jobs when dateMode is 'individual'
 */
export const jobDates = mysqlTable("jobDates", {
  id: int("id").primaryKey().autoincrement(),
  jobId: int("jobId").notNull().references(() => jobs.id),
  date: timestamp("date").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type JobDate = typeof jobDates.$inferSelect;
export type InsertJobDate = typeof jobDates.$inferInsert;

/**
 * Tasks table - represents individual tasks within jobs
 * @deprecated This is the legacy tasks table. New code should use `projectJobs` table.
 */
export const tasks = mysqlTable("tasks", {
  id: int("id").primaryKey().autoincrement(),
  jobId: int("jobId").notNull().references(() => jobs.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["todo", "in_progress", "review", "completed"]).default("todo").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  assignedTo: int("assignedTo").references(() => users.id),
  dueDate: timestamp("dueDate"),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

/**
 * Images table - stores references to uploaded images
 */
export const images = mysqlTable("images", {
  id: int("id").primaryKey().autoincrement(),
  jobId: int("jobId").references(() => jobs.id),
  taskId: int("taskId").references(() => tasks.id),
  projectId: int("projectId").references(() => projects.id, { onDelete: "set null" }),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  url: text("url").notNull(),
  filename: varchar("filename", { length: 255 }),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: int("fileSize"),
  caption: text("caption"),
  uploadedBy: int("uploadedBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** Responsive image metadata for the 3 generated variants */
  imageMetadata: json("imageMetadata").$type<StoredImageMetadata | null>(),
});

export type Image = typeof images.$inferSelect;
export type InsertImage = typeof images.$inferInsert;

/**
 * Reports table - stores generated reports
 */
export const reports = mysqlTable("reports", {
  id: int("id").primaryKey().autoincrement(),
  jobId: int("jobId").notNull().references(() => jobs.id),
  title: varchar("title", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["daily", "weekly", "task_summary", "progress", "custom"]).default("custom").notNull(),
  content: text("content"),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

/**
 * Comments table - for task and job discussions
 */
export const comments = mysqlTable("comments", {
  id: int("id").primaryKey().autoincrement(),
  jobId: int("jobId").references(() => jobs.id),
  taskId: int("taskId").references(() => tasks.id),
  content: text("content").notNull(),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

/**
 * Job-Contact relationship table
 */
export const jobContacts = mysqlTable("jobContacts", {
  id: int("id").primaryKey().autoincrement(),
  jobId: int("jobId").notNull().references(() => jobs.id),
  contactId: int("contactId").notNull().references(() => contacts.id),
  role: varchar("role", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type JobContact = typeof jobContacts.$inferSelect;
export type InsertJobContact = typeof jobContacts.$inferInsert;

/**
 * Invoices table - stores invoice file references
 */
export const invoices = mysqlTable("invoices", {
  id: int("id").primaryKey().autoincrement(),
  filename: varchar("filename", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileSize: int("fileSize"),
  mimeType: varchar("mimeType", { length: 100 }),
  jobId: int("jobId").references(() => jobs.id),
  contactId: int("contactId").references(() => contacts.id),
  uploadDate: timestamp("uploadDate"),
  uploadedBy: int("uploadedBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

/**
 * Notes table - stores user notes
 */
export const notes = mysqlTable("notes", {
  id: int("id").primaryKey().autoincrement(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  tags: varchar("tags", { length: 500 }),
  jobId: int("jobId").references(() => jobs.id),
  contactId: int("contactId").references(() => contacts.id),
  /** Timestamp when note was archived (null if active) */
  archivedAt: timestamp("archivedAt"),
  /** Timestamp when note was moved to trash (null if not trashed) */
  trashedAt: timestamp("trashedAt"),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("notes_createdBy_idx").on(table.createdBy),
  index("notes_jobId_idx").on(table.jobId),
  index("notes_contactId_idx").on(table.contactId),
  index("notes_archivedAt_idx").on(table.archivedAt),
  index("notes_trashedAt_idx").on(table.trashedAt),
]);

export type Note = typeof notes.$inferSelect;
export type InsertNote = typeof notes.$inferInsert;

/**
 * Locations table - stores map locations/markers
 */
export const locations = mysqlTable("locations", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  latitude: varchar("latitude", { length: 20 }).notNull(),
  longitude: varchar("longitude", { length: 20 }).notNull(),
  address: text("address"),
  type: mysqlEnum("type", ["job", "contact", "custom"]).default("custom").notNull(),
  jobId: int("jobId").references(() => jobs.id),
  contactId: int("contactId").references(() => contacts.id),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Location = typeof locations.$inferSelect;
export type InsertLocation = typeof locations.$inferInsert;

// =============================================================================
// PDF & SHARING TABLES
// =============================================================================

/**
 * Shared Documents table - tracks shareable PDF links with expiry
 */
export const sharedDocuments = mysqlTable("shared_documents", {
  id: int("id").primaryKey().autoincrement(),
  documentType: mysqlEnum("documentType", ["project_report", "invoice", "inspection"]).notNull(),
  referenceId: int("referenceId").notNull(),
  s3Key: varchar("s3Key", { length: 500 }).notNull(),
  shareToken: varchar("shareToken", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("shared_documents_shareToken_idx").on(table.shareToken),
  index("shared_documents_expiresAt_idx").on(table.expiresAt),
]);

export type SharedDocument = typeof sharedDocuments.$inferSelect;
export type InsertSharedDocument = typeof sharedDocuments.$inferInsert;

// =============================================================================
// COMPANY SETTINGS TABLE
// =============================================================================

/**
 * Company Settings table - stores company/invoice settings per user
 */
export const companySettings = mysqlTable("company_settings", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  companyName: varchar("companyName", { length: 255 }),
  address: text("address"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  steuernummer: varchar("steuernummer", { length: 50 }),
  ustIdNr: varchar("ustIdNr", { length: 50 }),
  iban: varchar("iban", { length: 34 }),
  bic: varchar("bic", { length: 11 }),
  isKleinunternehmer: boolean("isKleinunternehmer").default(false).notNull(),
  vatRate: decimal("vatRate", { precision: 5, scale: 2 }).default("19.00").notNull(),
  invoicePrefix: varchar("invoicePrefix", { length: 10 }).default("RE").notNull(),
  nextInvoiceNumber: int("nextInvoiceNumber").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = typeof companySettings.$inferInsert;

// =============================================================================
// PROJECT CHECK-INS TABLE
// =============================================================================

/**
 * Project Check-ins table - tracks user check-in/check-out times with geolocation
 */
export const projectCheckins = mysqlTable("project_checkins", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id),
  checkInTime: timestamp("checkInTime").notNull(),
  checkOutTime: timestamp("checkOutTime"),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  notes: text("notes"),
}, (table) => [
  index("project_checkins_projectId_idx").on(table.projectId),
  index("project_checkins_userId_idx").on(table.userId),
  index("project_checkins_checkInTime_idx").on(table.checkInTime),
]);

export type ProjectCheckin = typeof projectCheckins.$inferSelect;
export type InsertProjectCheckin = typeof projectCheckins.$inferInsert;
