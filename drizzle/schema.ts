import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";

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

/**
 * Jobs table - represents construction projects
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
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  url: text("url").notNull(),
  filename: varchar("filename", { length: 255 }),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: int("fileSize"),
  caption: text("caption"),
  uploadedBy: int("uploadedBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
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
