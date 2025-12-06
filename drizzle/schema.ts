import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json, index } from "drizzle-orm/mysql-core";

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

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
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
// NEW PROJECT-BASED STRUCTURE
// =============================================================================
// These tables implement the new Projects → Jobs hierarchy.
// The existing `jobs` and `tasks` tables are kept for backward compatibility
// and will be migrated via the backfill script (Task 5).
//
// Naming note: `project_jobs` is used instead of `jobs` to avoid MySQL table
// name conflict with the legacy `jobs` table. After migration is complete,
// the legacy table can be dropped and this table renamed if desired.
// =============================================================================

/**
 * Projects table - top-level entity representing client projects/engagements.
 * 
 * Primary key: Auto-increment integer (consistent with existing tables)
 * 
 * Indexes:
 * - status: For filtering projects by status
 * - createdBy: For listing user's own projects
 */
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
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
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("projects_status_idx").on(table.status),
  index("projects_createdBy_idx").on(table.createdBy),
  index("projects_clientId_idx").on(table.clientId),
]);

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * Project Jobs table - work items nested under projects.
 * 
 * Named `project_jobs` to avoid conflict with legacy `jobs` table.
 * Can be renamed to `jobs` after legacy migration is complete.
 * 
 * Indexes:
 * - projectId: For listing jobs within a project
 * - status: For filtering by status
 * - (projectId, status): Composite for efficient project+status queries
 */
export const projectJobs = mysqlTable("project_jobs", {
  id: int("id").autoincrement().primaryKey(),
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
 * 
 * S3 key pattern: projects/{projectId}/jobs/{jobId}/{timestamp}-{uuid}-{originalFileName}
 * If jobId is null, uses: projects/{projectId}/_project/{timestamp}-{uuid}-{originalFileName}
 * 
 * Indexes:
 * - projectId: For listing project files
 * - jobId: For listing job files  
 * - (projectId, jobId): Composite for efficient queries
 * - uploadedBy: For listing user's uploads
 */
export const fileMetadata = mysqlTable("file_metadata", {
  id: int("id").autoincrement().primaryKey(),
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
 * Jobs table - represents construction projects
 * @deprecated This is the legacy jobs table. New code should use `projects` table.
 * Will be migrated via backfill script and eventually dropped.
 */
export const jobs = mysqlTable("jobs", {
  id: int("id").autoincrement().primaryKey(),
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

/**
 * JobDates table - stores individual dates for jobs when dateMode is 'individual'
 */
export const jobDates = mysqlTable("jobDates", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("jobId").notNull().references(() => jobs.id),
  date: timestamp("date").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type JobDate = typeof jobDates.$inferSelect;
export type InsertJobDate = typeof jobDates.$inferInsert;

export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

/**
 * Tasks table - represents individual tasks within jobs
 * @deprecated This is the legacy tasks table. New code should use `projectJobs` table.
 * Will be migrated via backfill script and eventually dropped.
 */
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
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
  id: int("id").autoincrement().primaryKey(),
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
  id: int("id").autoincrement().primaryKey(),
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
  id: int("id").autoincrement().primaryKey(),
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
 * Contacts table - stores client/contact information
 */
export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  address: text("address"),
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
  notes: text("notes"),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

/**
 * Job-Contact relationship table
 */
export const jobContacts = mysqlTable("jobContacts", {
  id: int("id").autoincrement().primaryKey(),
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
  id: int("id").autoincrement().primaryKey(),
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
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  tags: varchar("tags", { length: 500 }),
  jobId: int("jobId").references(() => jobs.id),
  contactId: int("contactId").references(() => contacts.id),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Note = typeof notes.$inferSelect;
export type InsertNote = typeof notes.$inferInsert;

/**
 * Locations table - stores map locations/markers
 */
export const locations = mysqlTable("locations", {
  id: int("id").autoincrement().primaryKey(),
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
