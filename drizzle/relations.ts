import { relations } from "drizzle-orm";
import { 
  users, 
  projects, 
  projectJobs, 
  fileMetadata,
  // Legacy tables
  jobs,
  tasks,
  images,
  reports,
  comments,
  contacts,
  jobContacts,
  invoices,
  notes,
  locations,
  jobDates,
} from "./schema";

// =============================================================================
// NEW PROJECT-BASED RELATIONS
// =============================================================================

/**
 * Projects relations:
 * - createdBy → users (many-to-one)
 * - jobs → projectJobs (one-to-many)
 * - files → fileMetadata (one-to-many)
 */
export const projectsRelations = relations(projects, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [projects.createdBy],
    references: [users.id],
  }),
  clientContact: one(contacts, {
    fields: [projects.clientId],
    references: [contacts.id],
  }),
  jobs: many(projectJobs),
  files: many(fileMetadata),
}));

/**
 * Project Jobs relations:
 * - projectId → projects (many-to-one)
 * - files → fileMetadata (one-to-many)
 */
export const projectJobsRelations = relations(projectJobs, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectJobs.projectId],
    references: [projects.id],
  }),
  files: many(fileMetadata),
}));

/**
 * File Metadata relations:
 * - projectId → projects (many-to-one)
 * - jobId → projectJobs (many-to-one, optional)
 * - uploadedBy → users (many-to-one)
 */
export const fileMetadataRelations = relations(fileMetadata, ({ one }) => ({
  project: one(projects, {
    fields: [fileMetadata.projectId],
    references: [projects.id],
  }),
  job: one(projectJobs, {
    fields: [fileMetadata.jobId],
    references: [projectJobs.id],
  }),
  uploadedByUser: one(users, {
    fields: [fileMetadata.uploadedBy],
    references: [users.id],
  }),
}));

// =============================================================================
// USER RELATIONS (includes both new and legacy)
// =============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  // New structure
  projects: many(projects),
  uploadedFiles: many(fileMetadata),
  // Legacy structure  
  legacyJobs: many(jobs),
  legacyTasks: many(tasks),
  images: many(images),
  reports: many(reports),
  comments: many(comments),
  contacts: many(contacts),
  invoices: many(invoices),
  notes: many(notes),
  locations: many(locations),
}));

// =============================================================================
// LEGACY TABLE RELATIONS (kept for backward compatibility)
// =============================================================================

export const legacyJobsRelations = relations(jobs, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [jobs.createdBy],
    references: [users.id],
  }),
  contact: one(contacts, {
    fields: [jobs.contactId],
    references: [contacts.id],
  }),
  tasks: many(tasks),
  images: many(images),
  reports: many(reports),
  comments: many(comments),
  invoices: many(invoices),
  notes: many(notes),
  locations: many(locations),
  jobDates: many(jobDates),
  jobContacts: many(jobContacts),
}));

export const legacyTasksRelations = relations(tasks, ({ one, many }) => ({
  job: one(jobs, {
    fields: [tasks.jobId],
    references: [jobs.id],
  }),
  createdByUser: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
  }),
  assignedToUser: one(users, {
    fields: [tasks.assignedTo],
    references: [users.id],
  }),
  images: many(images),
  comments: many(comments),
}));

export const imagesRelations = relations(images, ({ one }) => ({
  job: one(jobs, {
    fields: [images.jobId],
    references: [jobs.id],
  }),
  task: one(tasks, {
    fields: [images.taskId],
    references: [tasks.id],
  }),
  uploadedByUser: one(users, {
    fields: [images.uploadedBy],
    references: [users.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  job: one(jobs, {
    fields: [reports.jobId],
    references: [jobs.id],
  }),
  createdByUser: one(users, {
    fields: [reports.createdBy],
    references: [users.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  job: one(jobs, {
    fields: [comments.jobId],
    references: [jobs.id],
  }),
  task: one(tasks, {
    fields: [comments.taskId],
    references: [tasks.id],
  }),
  createdByUser: one(users, {
    fields: [comments.createdBy],
    references: [users.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [contacts.createdBy],
    references: [users.id],
  }),
  jobContacts: many(jobContacts),
  invoices: many(invoices),
  notes: many(notes),
  locations: many(locations),
}));

export const jobContactsRelations = relations(jobContacts, ({ one }) => ({
  job: one(jobs, {
    fields: [jobContacts.jobId],
    references: [jobs.id],
  }),
  contact: one(contacts, {
    fields: [jobContacts.contactId],
    references: [contacts.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  job: one(jobs, {
    fields: [invoices.jobId],
    references: [jobs.id],
  }),
  contact: one(contacts, {
    fields: [invoices.contactId],
    references: [contacts.id],
  }),
  uploadedByUser: one(users, {
    fields: [invoices.uploadedBy],
    references: [users.id],
  }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  job: one(jobs, {
    fields: [notes.jobId],
    references: [jobs.id],
  }),
  contact: one(contacts, {
    fields: [notes.contactId],
    references: [contacts.id],
  }),
  createdByUser: one(users, {
    fields: [notes.createdBy],
    references: [users.id],
  }),
}));

export const locationsRelations = relations(locations, ({ one }) => ({
  job: one(jobs, {
    fields: [locations.jobId],
    references: [jobs.id],
  }),
  contact: one(contacts, {
    fields: [locations.contactId],
    references: [contacts.id],
  }),
  createdByUser: one(users, {
    fields: [locations.createdBy],
    references: [users.id],
  }),
}));

export const jobDatesRelations = relations(jobDates, ({ one }) => ({
  job: one(jobs, {
    fields: [jobDates.jobId],
    references: [jobs.id],
  }),
}));
