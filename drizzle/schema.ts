// PostgreSQL schema for Mantodeus Manager
import { pgTable, pgEnum, serial, integer, text, timestamp, varchar, boolean, jsonb, numeric, index, unique } from "drizzle-orm/pg-core";

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
// ENUMS
// =============================================================================

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const projectStatusEnum = pgEnum("projectStatus", ["planned", "active", "completed", "archived"]);
export const jobStatusEnum = pgEnum("jobStatus", ["pending", "in_progress", "done", "cancelled"]);
export const legacyJobStatusEnum = pgEnum("legacyJobStatus", ["planning", "active", "on_hold", "completed", "cancelled"]);
export const dateModeEnum = pgEnum("dateMode", ["range", "individual"]);
export const taskStatusEnum = pgEnum("taskStatus", ["todo", "in_progress", "review", "completed"]);
export const priorityEnum = pgEnum("priority", ["low", "medium", "high", "urgent"]);
export const reportTypeEnum = pgEnum("reportType", ["daily", "weekly", "task_summary", "progress", "custom"]);
export const locationTypeEnum = pgEnum("locationType", ["job", "contact", "custom"]);
export const documentTypeEnum = pgEnum("documentType", ["project_report", "invoice", "inspection"]);

// =============================================================================
// CORE TABLES
// =============================================================================

/**
 * Core user table backing auth flow.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  /** Supabase user ID (UUID) returned from Supabase Auth. Unique per user. */
  supabaseId: varchar("supabaseId", { length: 36 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
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
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  client: varchar("client", { length: 255 }),
  clientId: integer("clientId").references(() => contacts.id, { onDelete: "set null" }),
  description: text("description"),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  address: text("address"),
  /** Geographic coordinates stored as JSON: { lat: number, lng: number } */
  geo: jsonb("geo").$type<{ lat: number; lng: number } | null>(),
  /** Optional list of explicitly selected schedule dates */
  scheduledDates: jsonb("scheduledDates").$type<string[] | null>(),
  status: projectStatusEnum("status").default("planned").notNull(),
  createdBy: integer("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("projects_status_idx").on(table.status),
  index("projects_createdBy_idx").on(table.createdBy),
  index("projects_clientId_idx").on(table.clientId),
]);

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * Project Jobs table - work items nested under projects.
 */
export const projectJobs = pgTable("project_jobs", {
  id: serial("id").primaryKey(),
  projectId: integer("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }),
  description: text("description"),
  /** Array of user IDs assigned to this job. Stored as JSON for simplicity. */
  assignedUsers: jsonb("assignedUsers").$type<number[]>(),
  status: jobStatusEnum("status").default("pending").notNull(),
  startTime: timestamp("startTime"),
  endTime: timestamp("endTime"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
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
export const fileMetadata = pgTable("file_metadata", {
  id: serial("id").primaryKey(),
  projectId: integer("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
  /** Nullable - if null, file belongs to project level, not a specific job */
  jobId: integer("jobId").references(() => projectJobs.id, { onDelete: "cascade" }),
  s3Key: varchar("s3Key", { length: 500 }).notNull(),
  originalName: varchar("originalName", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  /** File size in bytes - useful for display and validation */
  fileSize: integer("fileSize"),
  uploadedBy: integer("uploadedBy").notNull().references(() => users.id),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  /** Optional responsive image metadata when the file is an image */
  imageMetadata: jsonb("imageMetadata").$type<StoredImageMetadata | null>(),
  /** Tags for photos: ["safety", "defect", "anchor", "quote", "before", "after"] */
  tags: jsonb("tags").$type<string[] | null>(),
}, (table) => [
  index("file_metadata_projectId_idx").on(table.projectId),
  index("file_metadata_jobId_idx").on(table.jobId),
  index("file_metadata_projectId_jobId_idx").on(table.projectId, table.jobId),
  index("file_metadata_uploadedBy_idx").on(table.uploadedBy),
]);

export type FileMetadata = typeof fileMetadata.$inferSelect;
export type InsertFileMetadata = typeof fileMetadata.$inferInsert;

// =============================================================================
// LEGACY TABLES (kept for backward compatibility)
// =============================================================================

/**
 * Contacts table - stores client/contact information
 */
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  address: text("address"),
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
  notes: text("notes"),
  createdBy: integer("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("contacts_createdBy_idx").on(table.createdBy),
]);

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

/**
 * Jobs table - represents construction projects
 * @deprecated This is the legacy jobs table. New code should use `projects` table.
 */
export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 500 }),
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
  status: legacyJobStatusEnum("status").default("planning").notNull(),
  dateMode: dateModeEnum("dateMode").default("range").notNull(),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  contactId: integer("contactId").references(() => contacts.id),
  createdBy: integer("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

/**
 * JobDates table - stores individual dates for jobs when dateMode is 'individual'
 */
export const jobDates = pgTable("jobDates", {
  id: serial("id").primaryKey(),
  jobId: integer("jobId").notNull().references(() => jobs.id),
  date: timestamp("date").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type JobDate = typeof jobDates.$inferSelect;
export type InsertJobDate = typeof jobDates.$inferInsert;

/**
 * Tasks table - represents individual tasks within jobs
 * @deprecated This is the legacy tasks table. New code should use `projectJobs` table.
 */
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  jobId: integer("jobId").notNull().references(() => jobs.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: taskStatusEnum("status").default("todo").notNull(),
  priority: priorityEnum("priority").default("medium").notNull(),
  assignedTo: integer("assignedTo").references(() => users.id),
  dueDate: timestamp("dueDate"),
  createdBy: integer("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

/**
 * Images table - stores references to uploaded images
 */
export const images = pgTable("images", {
  id: serial("id").primaryKey(),
  jobId: integer("jobId").references(() => jobs.id),
  taskId: integer("taskId").references(() => tasks.id),
  projectId: integer("projectId").references(() => projects.id, { onDelete: "set null" }),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  url: text("url").notNull(),
  filename: varchar("filename", { length: 255 }),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: integer("fileSize"),
  caption: text("caption"),
  uploadedBy: integer("uploadedBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** Responsive image metadata for the 3 generated variants */
  imageMetadata: jsonb("imageMetadata").$type<StoredImageMetadata | null>(),
});

export type Image = typeof images.$inferSelect;
export type InsertImage = typeof images.$inferInsert;

/**
 * Reports table - stores generated reports
 */
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  jobId: integer("jobId").notNull().references(() => jobs.id),
  title: varchar("title", { length: 255 }).notNull(),
  type: reportTypeEnum("type").default("custom").notNull(),
  content: text("content"),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  createdBy: integer("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

/**
 * Comments table - for task and job discussions
 */
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  jobId: integer("jobId").references(() => jobs.id),
  taskId: integer("taskId").references(() => tasks.id),
  content: text("content").notNull(),
  createdBy: integer("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

/**
 * Job-Contact relationship table
 */
export const jobContacts = pgTable("jobContacts", {
  id: serial("id").primaryKey(),
  jobId: integer("jobId").notNull().references(() => jobs.id),
  contactId: integer("contactId").notNull().references(() => contacts.id),
  role: varchar("role", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type JobContact = typeof jobContacts.$inferSelect;
export type InsertJobContact = typeof jobContacts.$inferInsert;

/**
 * Invoices table - stores invoice file references
 */
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  filename: varchar("filename", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileSize: integer("fileSize"),
  mimeType: varchar("mimeType", { length: 100 }),
  jobId: integer("jobId").references(() => jobs.id),
  contactId: integer("contactId").references(() => contacts.id),
  uploadDate: timestamp("uploadDate"),
  uploadedBy: integer("uploadedBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

/**
 * Notes table - stores user notes
 */
export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  tags: varchar("tags", { length: 500 }),
  jobId: integer("jobId").references(() => jobs.id),
  contactId: integer("contactId").references(() => contacts.id),
  createdBy: integer("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("notes_createdBy_idx").on(table.createdBy),
  index("notes_jobId_idx").on(table.jobId),
  index("notes_contactId_idx").on(table.contactId),
]);

export type Note = typeof notes.$inferSelect;
export type InsertNote = typeof notes.$inferInsert;

/**
 * Locations table - stores map locations/markers
 */
export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  latitude: varchar("latitude", { length: 20 }).notNull(),
  longitude: varchar("longitude", { length: 20 }).notNull(),
  address: text("address"),
  type: locationTypeEnum("type").default("custom").notNull(),
  jobId: integer("jobId").references(() => jobs.id),
  contactId: integer("contactId").references(() => contacts.id),
  createdBy: integer("createdBy").notNull().references(() => users.id),
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
export const sharedDocuments = pgTable("shared_documents", {
  id: serial("id").primaryKey(),
  documentType: documentTypeEnum("documentType").notNull(),
  referenceId: integer("referenceId").notNull(),
  s3Key: varchar("s3Key", { length: 500 }).notNull(),
  shareToken: varchar("shareToken", { length: 64 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdBy: integer("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("shared_documents_shareToken_idx").on(table.shareToken),
  index("shared_documents_expiresAt_idx").on(table.expiresAt),
  unique("shared_documents_shareToken_unique").on(table.shareToken),
]);

export type SharedDocument = typeof sharedDocuments.$inferSelect;
export type InsertSharedDocument = typeof sharedDocuments.$inferInsert;

// =============================================================================
// COMPANY SETTINGS TABLE
// =============================================================================

/**
 * Company Settings table - stores company/invoice settings per user
 */
export const companySettings = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyName: varchar("companyName", { length: 255 }),
  address: text("address"),
  steuernummer: varchar("steuernummer", { length: 50 }),
  ustIdNr: varchar("ustIdNr", { length: 50 }),
  iban: varchar("iban", { length: 34 }),
  bic: varchar("bic", { length: 11 }),
  isKleinunternehmer: boolean("isKleinunternehmer").default(false).notNull(),
  vatRate: numeric("vatRate", { precision: 5, scale: 2 }).default("19.00").notNull(),
  invoicePrefix: varchar("invoicePrefix", { length: 10 }).default("RE").notNull(),
  nextInvoiceNumber: integer("nextInvoiceNumber").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  unique("company_settings_userId_unique").on(table.userId),
]);

export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = typeof companySettings.$inferInsert;

// =============================================================================
// PROJECT CHECK-INS TABLE
// =============================================================================

/**
 * Project Check-ins table - tracks user check-in/check-out times with geolocation
 */
export const projectCheckins = pgTable("project_checkins", {
  id: serial("id").primaryKey(),
  projectId: integer("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: integer("userId").notNull().references(() => users.id),
  checkInTime: timestamp("checkInTime").notNull(),
  checkOutTime: timestamp("checkOutTime"),
  latitude: numeric("latitude", { precision: 10, scale: 8 }),
  longitude: numeric("longitude", { precision: 11, scale: 8 }),
  notes: text("notes"),
}, (table) => [
  index("project_checkins_projectId_idx").on(table.projectId),
  index("project_checkins_userId_idx").on(table.userId),
  index("project_checkins_checkInTime_idx").on(table.checkInTime),
]);

export type ProjectCheckin = typeof projectCheckins.$inferSelect;
export type InsertProjectCheckin = typeof projectCheckins.$inferInsert;
