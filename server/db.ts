import { eq, desc, and, sql, isNull, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { 
  // User types
  InsertUser, users, 
  // New project-based types
  projects, projectJobs, fileMetadata,
  type Project, type InsertProject, type Contact,
  type ProjectJob, type InsertProjectJob,
  type FileMetadata, type InsertFileMetadata,
  // PDF & Settings types
  sharedDocuments, companySettings, projectCheckins,
  type InsertSharedDocument, type InsertCompanySettings, type InsertProjectCheckin,
  // Legacy types (kept for backward compatibility)
  jobs, tasks, images, reports, comments, contacts, invoices, notes, locations, 
  InsertJob, InsertTask, InsertImage, InsertReport, InsertComment, InsertContact, 
  InsertInvoice, InsertNote, InsertLocation, jobContacts, jobDates, InsertJobDate 
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { ensureContactsSchema, ensureFileMetadataSchema, ensureImagesSchema, ensureNotesSchema, ensureProjectsSchema } from "./_core/schemaGuards";

type ProjectClientContact = Pick<Contact, "id" | "name" | "address" | "latitude" | "longitude">;
export type ProjectWithClient = Project & { clientContact: ProjectClientContact | null };

const clientContactSelection = {
  id: contacts.id,
  name: contacts.name,
  address: contacts.address,
  latitude: contacts.latitude,
  longitude: contacts.longitude,
};

function safeJsonParse(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeStringArray(value: unknown): string[] | null {
  if (value == null) return null;
  const parsed = safeJsonParse(value);
  if (!Array.isArray(parsed)) return null;
  const strings = parsed.filter((item): item is string => typeof item === "string");
  return strings.length ? strings : [];
}

function normalizeProjectGeo(value: unknown): { lat: number; lng: number } | null {
  if (value == null) return null;
  const parsed = safeJsonParse(value);
  if (!parsed || typeof parsed !== "object") return null;
  const maybe = parsed as { lat?: unknown; lng?: unknown };
  if (typeof maybe.lat !== "number" || typeof maybe.lng !== "number") return null;
  return { lat: maybe.lat, lng: maybe.lng };
}

function mapProjectWithClient(row: { project: Project; clientContact: ProjectClientContact | null }): ProjectWithClient {
  // MySQL JSON columns are frequently returned as strings by mysql2.
  // Normalize them here so the API consistently returns typed JS values.
  const projectAny = row.project as unknown as { scheduledDates?: unknown; geo?: unknown };
  const scheduledDates = normalizeStringArray(projectAny.scheduledDates);
  const geo = normalizeProjectGeo(projectAny.geo);

  return {
    ...row.project,
    scheduledDates: scheduledDates ?? null,
    geo: geo ?? null,
    clientContact: row.clientContact,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pool: any = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      console.error("[Database] ❌ DATABASE_URL environment variable is not set!");
      return null;
    }
    
    try {
      console.log("[Database] Connecting to MySQL database...");
      console.log("[Database] DATABASE_URL starts with:", process.env.DATABASE_URL.substring(0, 20) + "...");
      
      // Create MySQL connection pool
      _pool = mysql.createPool(process.env.DATABASE_URL);
      _db = drizzle(_pool);
      console.log("[Database] ✅ Database connection created");
      
      // Test the connection by running a simple query
      try {
        await _db.execute(sql`SELECT 1`);
        console.log("[Database] ✅ Database connection test successful");
      } catch (testError) {
        console.warn("[Database] ⚠️ Database connection test failed, but connection object created:", testError);
      }
    } catch (error) {
      console.error("[Database] ❌ Failed to create database connection:", error);
      if (error instanceof Error) {
        console.error("[Database] Error message:", error.message);
        console.error("[Database] Error stack:", error.stack);
      }
      _db = null;
      _pool = null;
    }
  }
  return _db;
}

async function requireDbConnection() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  return db;
}

async function getFileMetadataDb() {
  await ensureFileMetadataSchema();
  return requireDbConnection();
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.supabaseId) {
    throw new Error("User supabaseId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      supabaseId: user.supabaseId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.supabaseId === ENV.ownerSupabaseId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserBySupabaseId(supabaseId: string) {
  const db = await getDb();
  if (!db) {
    console.error("[Database] ❌ Cannot get user: database not available");
    console.error("[Database] DATABASE_URL is:", process.env.DATABASE_URL ? "set" : "NOT SET");
    throw new Error("Database connection not available");
  }

  try {
    console.log(`[Database] Looking up user with supabaseId: ${supabaseId}`);
    const result = await db.select().from(users).where(eq(users.supabaseId, supabaseId)).limit(1);
    
    if (result.length > 0) {
      console.log(`[Database] ✅ Found user: ${result[0].id}`);
      return result[0];
    } else {
      console.log(`[Database] User not found with supabaseId: ${supabaseId}`);
      return undefined;
    }
  } catch (error) {
    console.error("[Database] ❌ Query failed:", error);
    if (error instanceof Error) {
      console.error("[Database] Error message:", error.message);
      console.error("[Database] Error stack:", error.stack);
    }
    // Re-throw with more context
    throw new Error(`Database query failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Job queries
export async function createJob(job: InsertJob) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(jobs).values(job);
  return result;
}

export async function getJobById(jobId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getAllJobs() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(jobs).orderBy(desc(jobs.createdAt));
}

export async function updateJob(jobId: number, updates: Partial<InsertJob>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.update(jobs).set(updates).where(eq(jobs.id, jobId));
}

export async function deleteJob(jobId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.delete(jobs).where(eq(jobs.id, jobId));
}

// JobDates queries
export async function createJobDate(jobDate: InsertJobDate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(jobDates).values(jobDate);
}

export async function getJobDates(jobId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(jobDates).where(eq(jobDates.jobId, jobId));
}

export async function deleteJobDates(jobId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.delete(jobDates).where(eq(jobDates.jobId, jobId));
}

// Task queries
export async function createTask(task: InsertTask) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(tasks).values(task);
  return result;
}

export async function getTaskById(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getTasksByJobId(jobId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(tasks).where(eq(tasks.jobId, jobId)).orderBy(desc(tasks.createdAt));
}

export async function updateTask(taskId: number, updates: Partial<InsertTask>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.update(tasks).set(updates).where(eq(tasks.id, taskId));
}

export async function deleteTask(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.delete(tasks).where(eq(tasks.id, taskId));
}

// Image queries
export async function createImage(image: InsertImage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureImagesSchema();
  const result = await db.insert(images).values(image);
  return result;
}

export async function getImageById(imageId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(images).where(eq(images.id, imageId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getImagesByJobId(jobId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(images).where(eq(images.jobId, jobId)).orderBy(desc(images.createdAt));
}

export async function getImagesByTaskId(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(images).where(eq(images.taskId, taskId)).orderBy(desc(images.createdAt));
}

export async function deleteImage(imageId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.delete(images).where(eq(images.id, imageId));
}

// Report queries
export async function createReport(report: InsertReport) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(reports).values(report);
  return result;
}

export async function getReportsByJobId(jobId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(reports).where(eq(reports.jobId, jobId)).orderBy(desc(reports.createdAt));
}

export async function deleteReport(reportId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.delete(reports).where(eq(reports.id, reportId));
}

// Comment queries
export async function createComment(comment: InsertComment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(comments).values(comment);
  return result;
}

export async function getCommentsByJobId(jobId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(comments).where(eq(comments.jobId, jobId)).orderBy(desc(comments.createdAt));
}

export async function getCommentsByTaskId(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(comments).where(eq(comments.taskId, taskId)).orderBy(desc(comments.createdAt));
}

export async function deleteComment(commentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.delete(comments).where(eq(comments.id, commentId));
}

// Calendar queries - get jobs and tasks within a date range
export async function getJobsInDateRange(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { and, gte, lte, or, isNull } = await import('drizzle-orm');
  
  // Get jobs that start within the range OR have no start date
  return await db.select().from(jobs)
    .where(
      or(
        and(
          gte(jobs.startDate, startDate),
          lte(jobs.startDate, endDate)
        ),
        isNull(jobs.startDate)
      )
    )
    .orderBy(jobs.startDate);
}

export async function getTasksInDateRange(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { and, gte, lte, or, isNull } = await import('drizzle-orm');
  
  // Get tasks that are due within the range OR have no due date
  return await db.select().from(tasks)
    .where(
      or(
        and(
          gte(tasks.dueDate, startDate),
          lte(tasks.dueDate, endDate)
        ),
        isNull(tasks.dueDate)
      )
    )
    .orderBy(tasks.dueDate);
}

export async function getCalendarEvents(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { and, gte, lte, or, isNull, eq } = await import('drizzle-orm');
  
  // Get individual job dates from jobDates table
  const individualJobDatesPromise = db.select({
    id: jobs.id,
    title: jobs.title,
    date: jobDates.date,
    type: sql<'job'>`'job'`,
    status: jobs.status,
    description: jobs.description,
  }).from(jobDates)
    .innerJoin(jobs, eq(jobDates.jobId, jobs.id))
    .where(
      and(
        gte(jobDates.date, startDate),
        lte(jobDates.date, endDate)
      )
    );
  
  // Get jobs without individual dates (legacy jobs with just start/end dates)
  const jobsPromise = db.select({
    id: jobs.id,
    title: jobs.title,
    date: jobs.startDate,
    type: sql<'job'>`'job'`,
    status: jobs.status,
    description: jobs.description,
  }).from(jobs)
    .where(
      and(
        or(
          and(
            gte(jobs.startDate, startDate),
            lte(jobs.startDate, endDate)
          ),
          isNull(jobs.startDate)
        ),
        // Only include jobs that don't have individual dates
        sql`NOT EXISTS (SELECT 1 FROM ${jobDates} WHERE ${jobDates.jobId} = ${jobs.id})`
      )
    );
  
  const tasksPromise = db.select({
    id: tasks.id,
    title: tasks.title,
    date: tasks.dueDate,
    type: sql<'task'>`'task'`,
    status: tasks.status,
    description: tasks.description,
  }).from(tasks)
    .where(
      or(
        and(
          gte(tasks.dueDate, startDate),
          lte(tasks.dueDate, endDate)
        ),
        isNull(tasks.dueDate)
      )
    );
  
  const [individualJobDates, jobEvents, taskEvents] = await Promise.all([individualJobDatesPromise, jobsPromise, tasksPromise]);
  return [...individualJobDates, ...jobEvents, ...taskEvents].sort((a, b) => {
    const dateA = a.date ? new Date(a.date as unknown as string | number | Date).getTime() : Infinity;
    const dateB = b.date ? new Date(b.date as unknown as string | number | Date).getTime() : Infinity;
    return dateA - dateB;
  });
}

// Get all users for assignment dropdowns
export async function getAllUsers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
  }).from(users).orderBy(users.name);
}


// ===== CONTACTS QUERIES =====

export async function getContactsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  await ensureContactsSchema();
  return db
    .select()
    .from(contacts)
    .where(and(
      eq(contacts.createdBy, userId),
      isNull(contacts.archivedAt),
      isNull(contacts.trashedAt)
    ))
    .orderBy(desc(contacts.updatedAt));
}

export async function getContactById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  await ensureContactsSchema();
  const result = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createContact(data: InsertContact) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureContactsSchema();
  const result = await db.insert(contacts).values(data);
  return result;
}

export async function updateContact(id: number, data: Partial<InsertContact>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureContactsSchema();
  return db.update(contacts).set(data).where(eq(contacts.id, id));
}

export async function deleteContact(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureContactsSchema();
  return db.delete(contacts).where(eq(contacts.id, id));
}

export async function getArchivedContactsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  await ensureContactsSchema();
  return db
    .select()
    .from(contacts)
    .where(and(
      eq(contacts.createdBy, userId),
      isNotNull(contacts.archivedAt),
      isNull(contacts.trashedAt)
    ))
    .orderBy(desc(contacts.archivedAt), desc(contacts.updatedAt));
}

export async function getTrashedContactsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  await ensureContactsSchema();
  return db
    .select()
    .from(contacts)
    .where(and(
      eq(contacts.createdBy, userId),
      isNotNull(contacts.trashedAt)
    ))
    .orderBy(desc(contacts.trashedAt), desc(contacts.updatedAt));
}

export async function archiveContact(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureContactsSchema();
  return db
    .update(contacts)
    .set({ archivedAt: new Date() })
    .where(and(eq(contacts.id, id), isNull(contacts.archivedAt), isNull(contacts.trashedAt)));
}

export async function restoreArchivedContact(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureContactsSchema();
  return db
    .update(contacts)
    .set({ archivedAt: null })
    .where(and(eq(contacts.id, id), isNotNull(contacts.archivedAt), isNull(contacts.trashedAt)));
}

export async function moveContactToTrash(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureContactsSchema();
  return db
    .update(contacts)
    .set({ trashedAt: new Date() })
    .where(and(eq(contacts.id, id), isNull(contacts.trashedAt)));
}

export async function restoreContactFromTrash(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureContactsSchema();
  return db
    .update(contacts)
    .set({ trashedAt: null })
    .where(and(eq(contacts.id, id), isNotNull(contacts.trashedAt)));
}

// ===== JOB-CONTACT RELATIONSHIP QUERIES =====

export async function getJobContacts(jobId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(jobContacts).where(eq(jobContacts.jobId, jobId));
}

export async function linkJobContact(jobId: number, contactId: number, role?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(jobContacts).values({ jobId, contactId, role });
}

export async function unlinkJobContact(jobId: number, contactId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(jobContacts).where(and(eq(jobContacts.jobId, jobId), eq(jobContacts.contactId, contactId)));
}

// ===== INVOICES QUERIES =====

export async function getInvoicesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invoices).where(eq(invoices.uploadedBy, userId));
}

export async function getInvoicesByJob(jobId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invoices).where(eq(invoices.jobId, jobId));
}

export async function getInvoicesByContact(contactId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invoices).where(eq(invoices.contactId, contactId));
}

export async function createInvoice(data: InsertInvoice) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(invoices).values(data);
}

export async function getInvoiceById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function deleteInvoice(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(invoices).where(eq(invoices.id, id));
}

// ===== NOTES QUERIES =====

export async function getNotesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  await ensureNotesSchema();
  return db
    .select()
    .from(notes)
    .where(and(
      eq(notes.createdBy, userId),
      isNull(notes.archivedAt),
      isNull(notes.trashedAt)
    ))
    .orderBy(desc(notes.updatedAt));
}

export async function getNotesByJob(jobId: number) {
  const db = await getDb();
  if (!db) return [];
  await ensureNotesSchema();
  return db
    .select()
    .from(notes)
    .where(and(
      eq(notes.jobId, jobId),
      isNull(notes.archivedAt),
      isNull(notes.trashedAt)
    ))
    .orderBy(desc(notes.updatedAt));
}

export async function getNotesByContact(contactId: number) {
  const db = await getDb();
  if (!db) return [];
  await ensureNotesSchema();
  return db
    .select()
    .from(notes)
    .where(and(
      eq(notes.contactId, contactId),
      isNull(notes.archivedAt),
      isNull(notes.trashedAt)
    ))
    .orderBy(desc(notes.updatedAt));
}

export async function getNoteById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  await ensureNotesSchema();
  const result = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createNote(data: InsertNote) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureNotesSchema();
  return db.insert(notes).values(data);
}

export async function updateNote(id: number, data: Partial<InsertNote>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureNotesSchema();
  return db.update(notes).set(data).where(eq(notes.id, id));
}

export async function deleteNote(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureNotesSchema();
  return db.delete(notes).where(eq(notes.id, id));
}

export async function getArchivedNotesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  await ensureNotesSchema();
  return db
    .select()
    .from(notes)
    .where(and(
      eq(notes.createdBy, userId),
      isNotNull(notes.archivedAt),
      isNull(notes.trashedAt)
    ))
    .orderBy(desc(notes.archivedAt), desc(notes.updatedAt));
}

export async function getTrashedNotesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  await ensureNotesSchema();
  return db
    .select()
    .from(notes)
    .where(and(
      eq(notes.createdBy, userId),
      isNotNull(notes.trashedAt)
    ))
    .orderBy(desc(notes.trashedAt), desc(notes.updatedAt));
}

export async function archiveNote(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureNotesSchema();
  return db
    .update(notes)
    .set({ archivedAt: new Date() })
    .where(and(eq(notes.id, id), isNull(notes.archivedAt), isNull(notes.trashedAt)));
}

export async function restoreArchivedNote(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureNotesSchema();
  return db
    .update(notes)
    .set({ archivedAt: null })
    .where(and(eq(notes.id, id), isNotNull(notes.archivedAt), isNull(notes.trashedAt)));
}

export async function moveNoteToTrash(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureNotesSchema();
  return db
    .update(notes)
    .set({ trashedAt: new Date() })
    .where(and(eq(notes.id, id), isNull(notes.trashedAt)));
}

export async function restoreNoteFromTrash(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureNotesSchema();
  return db
    .update(notes)
    .set({ trashedAt: null })
    .where(and(eq(notes.id, id), isNotNull(notes.trashedAt)));
}

// ===== LOCATIONS QUERIES =====

export async function getLocationsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(locations).where(eq(locations.createdBy, userId));
}

export async function getLocationsByType(type: "job" | "contact" | "custom") {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(locations).where(eq(locations.type, type));
}

export async function getLocationsByJob(jobId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(locations).where(eq(locations.jobId, jobId));
}

export async function getLocationsByContact(contactId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(locations).where(eq(locations.contactId, contactId));
}

export async function createLocation(data: InsertLocation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(locations).values(data);
}

export async function updateLocation(id: number, data: Partial<InsertLocation>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(locations).set(data).where(eq(locations.id, id));
}

export async function deleteLocation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(locations).where(eq(locations.id, id));
}

// ===== EXPORT/IMPORT DATA QUERIES =====

export async function getAllJobsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(jobs).where(eq(jobs.createdBy, userId));
}

export async function getAllTasksByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tasks).where(eq(tasks.createdBy, userId));
}

export async function getAllCommentsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(comments).where(eq(comments.createdBy, userId));
}

export async function getAllReportsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reports).where(eq(reports.createdBy, userId));
}

export async function getAllJobDatesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  // Get job dates for jobs created by this user
  return db.select({
    id: jobDates.id,
    jobId: jobDates.jobId,
    date: jobDates.date,
    createdAt: jobDates.createdAt,
  }).from(jobDates)
    .innerJoin(jobs, eq(jobDates.jobId, jobs.id))
    .where(eq(jobs.createdBy, userId));
}

export async function getAllJobContactsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  // Get job contacts for jobs created by this user
  return db.select({
    id: jobContacts.id,
    jobId: jobContacts.jobId,
    contactId: jobContacts.contactId,
    role: jobContacts.role,
    createdAt: jobContacts.createdAt,
  }).from(jobContacts)
    .innerJoin(jobs, eq(jobContacts.jobId, jobs.id))
    .where(eq(jobs.createdBy, userId));
}

// Bulk insert functions for import
export async function bulkCreateJobs(jobsData: InsertJob[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (jobsData.length === 0) return [];
  
  const results = [];
  for (const job of jobsData) {
    const result = await db.insert(jobs).values(job);
    results.push(result);
  }
  return results;
}

export async function bulkCreateTasks(tasksData: InsertTask[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (tasksData.length === 0) return [];
  
  const results = [];
  for (const task of tasksData) {
    const result = await db.insert(tasks).values(task);
    results.push(result);
  }
  return results;
}

export async function bulkCreateContacts(contactsData: InsertContact[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (contactsData.length === 0) return [];
  
  const results = [];
  for (const contact of contactsData) {
    const result = await db.insert(contacts).values(contact);
    results.push(result);
  }
  return results;
}

export async function bulkCreateNotes(notesData: InsertNote[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (notesData.length === 0) return [];
  
  const results = [];
  for (const note of notesData) {
    const result = await db.insert(notes).values(note);
    results.push(result);
  }
  return results;
}

export async function bulkCreateLocations(locationsData: InsertLocation[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (locationsData.length === 0) return [];
  
  const results = [];
  for (const location of locationsData) {
    const result = await db.insert(locations).values(location);
    results.push(result);
  }
  return results;
}

export async function bulkCreateComments(commentsData: InsertComment[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (commentsData.length === 0) return [];
  
  const results = [];
  for (const comment of commentsData) {
    const result = await db.insert(comments).values(comment);
    results.push(result);
  }
  return results;
}

export async function bulkCreateReports(reportsData: InsertReport[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (reportsData.length === 0) return [];
  
  const results = [];
  for (const report of reportsData) {
    const result = await db.insert(reports).values(report);
    results.push(result);
  }
  return results;
}

export async function bulkCreateJobDates(jobDatesData: InsertJobDate[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (jobDatesData.length === 0) return [];
  
  const results = [];
  for (const jobDate of jobDatesData) {
    const result = await db.insert(jobDates).values(jobDate);
    results.push(result);
  }
  return results;
}

export async function bulkCreateJobContacts(jobContactsData: { jobId: number; contactId: number; role?: string }[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (jobContactsData.length === 0) return [];
  
  const results = [];
  for (const jc of jobContactsData) {
    const result = await db.insert(jobContacts).values(jc);
    results.push(result);
  }
  return results;
}

// =============================================================================
// NEW PROJECT-BASED QUERIES
// =============================================================================
// These functions support the new Projects → Jobs → Files hierarchy.
// Legacy job/task functions above are kept for backward compatibility.

// ===== PROJECTS QUERIES =====

export async function createProject(project: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await ensureProjectsSchema();
  const result = await db.insert(projects).values(project);
  return result;
}

export async function getProjectById(projectId: number): Promise<ProjectWithClient | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await ensureProjectsSchema();
  const result = await db
    .select({
      project: projects,
      clientContact: clientContactSelection,
    })
    .from(projects)
    .leftJoin(contacts, eq(projects.clientId, contacts.id))
    .where(eq(projects.id, projectId))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return mapProjectWithClient(result[0]);
}

export async function getProjectsByUser(userId: number): Promise<ProjectWithClient[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await ensureProjectsSchema();
  const rows = await db
    .select({
      project: projects,
      clientContact: clientContactSelection,
    })
    .from(projects)
    .leftJoin(contacts, eq(projects.clientId, contacts.id))
    .where(and(
      eq(projects.createdBy, userId),
      isNull(projects.archivedAt),
      isNull(projects.trashedAt)
    ))
    .orderBy(desc(projects.createdAt));

  return rows.map(mapProjectWithClient);
}

export async function getAllProjects(): Promise<ProjectWithClient[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await ensureProjectsSchema();
  const rows = await db
    .select({
      project: projects,
      clientContact: clientContactSelection,
    })
    .from(projects)
    .leftJoin(contacts, eq(projects.clientId, contacts.id))
    .where(and(
      isNull(projects.archivedAt),
      isNull(projects.trashedAt)
    ))
    .orderBy(desc(projects.createdAt));

  return rows.map(mapProjectWithClient);
}

export async function getArchivedProjectsByUser(userId: number): Promise<ProjectWithClient[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await ensureProjectsSchema();
  const rows = await db
    .select({
      project: projects,
      clientContact: clientContactSelection,
    })
    .from(projects)
    .leftJoin(contacts, eq(projects.clientId, contacts.id))
    .where(and(
      eq(projects.createdBy, userId),
      isNotNull(projects.archivedAt),
      isNull(projects.trashedAt)
    ))
    .orderBy(desc(projects.archivedAt), desc(projects.updatedAt));

  return rows.map(mapProjectWithClient);
}

export async function getAllArchivedProjects(): Promise<ProjectWithClient[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await ensureProjectsSchema();
  const rows = await db
    .select({
      project: projects,
      clientContact: clientContactSelection,
    })
    .from(projects)
    .leftJoin(contacts, eq(projects.clientId, contacts.id))
    .where(and(
      isNotNull(projects.archivedAt),
      isNull(projects.trashedAt)
    ))
    .orderBy(desc(projects.archivedAt), desc(projects.updatedAt));

  return rows.map(mapProjectWithClient);
}

export async function getTrashedProjectsByUser(userId: number): Promise<ProjectWithClient[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await ensureProjectsSchema();
  const rows = await db
    .select({
      project: projects,
      clientContact: clientContactSelection,
    })
    .from(projects)
    .leftJoin(contacts, eq(projects.clientId, contacts.id))
    .where(and(
      eq(projects.createdBy, userId),
      isNotNull(projects.trashedAt)
    ))
    .orderBy(desc(projects.trashedAt), desc(projects.updatedAt));

  return rows.map(mapProjectWithClient);
}

export async function getAllTrashedProjects(): Promise<ProjectWithClient[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await ensureProjectsSchema();
  const rows = await db
    .select({
      project: projects,
      clientContact: clientContactSelection,
    })
    .from(projects)
    .leftJoin(contacts, eq(projects.clientId, contacts.id))
    .where(isNotNull(projects.trashedAt))
    .orderBy(desc(projects.trashedAt), desc(projects.updatedAt));

  return rows.map(mapProjectWithClient);
}

export async function updateProject(projectId: number, updates: Partial<InsertProject>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await ensureProjectsSchema();
  return await db.update(projects).set(updates).where(eq(projects.id, projectId));
}

export async function deleteProject(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await ensureProjectsSchema();
  // Note: ON DELETE CASCADE will automatically delete related project_jobs and file_metadata
  return await db.delete(projects).where(eq(projects.id, projectId));
}

export async function archiveProject(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await ensureProjectsSchema();
  return await db.update(projects)
    .set({ archivedAt: new Date() })
    .where(and(
      eq(projects.id, projectId),
      isNull(projects.archivedAt),
      isNull(projects.trashedAt)
    ));
}

export async function restoreArchivedProject(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await ensureProjectsSchema();
  return await db.update(projects)
    .set({ archivedAt: null })
    .where(and(
      eq(projects.id, projectId),
      isNotNull(projects.archivedAt),
      isNull(projects.trashedAt)
    ));
}

export async function moveProjectToTrash(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await ensureProjectsSchema();
  return await db.update(projects)
    .set({ trashedAt: new Date() })
    .where(and(
      eq(projects.id, projectId),
      isNull(projects.trashedAt)
    ));
}

export async function restoreProjectFromTrash(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await ensureProjectsSchema();
  return await db.update(projects)
    .set({ trashedAt: null })
    .where(and(
      eq(projects.id, projectId),
      isNotNull(projects.trashedAt)
    ));
}

// ===== PROJECT JOBS QUERIES =====

export async function createProjectJob(job: InsertProjectJob) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(projectJobs).values(job);
  return result;
}

export async function getProjectJobById(jobId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(projectJobs).where(eq(projectJobs.id, jobId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getProjectJobsByProjectId(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(projectJobs)
    .where(eq(projectJobs.projectId, projectId))
    .orderBy(desc(projectJobs.createdAt));
}

export async function updateProjectJob(jobId: number, updates: Partial<InsertProjectJob>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.update(projectJobs).set(updates).where(eq(projectJobs.id, jobId));
}

export async function deleteProjectJob(jobId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Note: ON DELETE CASCADE will automatically delete related file_metadata
  return await db.delete(projectJobs).where(eq(projectJobs.id, jobId));
}

// ===== FILE METADATA QUERIES =====

export async function createFileMetadata(file: InsertFileMetadata) {
  const db = await getFileMetadataDb();
  
  try {
    const result = await db.insert(fileMetadata).values(file);
    return result;
  } catch (error) {
    console.error("[Database] Failed to create file metadata:", error);
    console.error("[Database] File data:", JSON.stringify(file, null, 2));
    throw error;
  }
}

export async function getFileMetadataById(fileId: number) {
  const db = await getFileMetadataDb();
  
  const result = await db.select().from(fileMetadata).where(eq(fileMetadata.id, fileId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getFileMetadataByS3Key(s3Key: string) {
  const db = await getFileMetadataDb();
  
  const result = await db.select().from(fileMetadata).where(eq(fileMetadata.s3Key, s3Key)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getFilesByProjectId(projectId: number) {
  const db = await getFileMetadataDb();
  
  return await db.select().from(fileMetadata)
    .where(eq(fileMetadata.projectId, projectId))
    .orderBy(desc(fileMetadata.uploadedAt));
}

export async function getFilesByJobId(projectId: number, jobId: number) {
  const db = await getFileMetadataDb();
  
  return await db.select().from(fileMetadata)
    .where(and(
      eq(fileMetadata.projectId, projectId),
      eq(fileMetadata.jobId, jobId)
    ))
    .orderBy(desc(fileMetadata.uploadedAt));
}

export async function getActiveFilesByProjectId(projectId: number) {
  const db = await getFileMetadataDb();
  return await db
    .select()
    .from(fileMetadata)
    .where(and(eq(fileMetadata.projectId, projectId), isNull(fileMetadata.trashedAt)))
    .orderBy(desc(fileMetadata.uploadedAt));
}

export async function getTrashedFilesByProjectId(projectId: number) {
  const db = await getFileMetadataDb();
  return await db
    .select()
    .from(fileMetadata)
    .where(and(eq(fileMetadata.projectId, projectId), isNotNull(fileMetadata.trashedAt)))
    .orderBy(desc(fileMetadata.trashedAt), desc(fileMetadata.uploadedAt));
}

export async function getActiveFilesByJobId(projectId: number, jobId: number) {
  const db = await getFileMetadataDb();
  return await db
    .select()
    .from(fileMetadata)
    .where(and(
      eq(fileMetadata.projectId, projectId),
      eq(fileMetadata.jobId, jobId),
      isNull(fileMetadata.trashedAt)
    ))
    .orderBy(desc(fileMetadata.uploadedAt));
}

export async function getTrashedFilesByJobId(projectId: number, jobId: number) {
  const db = await getFileMetadataDb();
  return await db
    .select()
    .from(fileMetadata)
    .where(and(
      eq(fileMetadata.projectId, projectId),
      eq(fileMetadata.jobId, jobId),
      isNotNull(fileMetadata.trashedAt)
    ))
    .orderBy(desc(fileMetadata.trashedAt), desc(fileMetadata.uploadedAt));
}

export async function moveFileMetadataToTrash(fileId: number) {
  const db = await getFileMetadataDb();
  return await db
    .update(fileMetadata)
    .set({ trashedAt: new Date() })
    .where(and(eq(fileMetadata.id, fileId), isNull(fileMetadata.trashedAt)));
}

export async function restoreFileMetadataFromTrash(fileId: number) {
  const db = await getFileMetadataDb();
  return await db
    .update(fileMetadata)
    .set({ trashedAt: null })
    .where(and(eq(fileMetadata.id, fileId), isNotNull(fileMetadata.trashedAt)));
}

export async function deleteFileMetadata(fileId: number) {
  const db = await getFileMetadataDb();
  
  return await db.delete(fileMetadata).where(eq(fileMetadata.id, fileId));
}

export async function deleteFileMetadataByS3Key(s3Key: string) {
  const db = await getFileMetadataDb();
  
  return await db.delete(fileMetadata).where(eq(fileMetadata.s3Key, s3Key));
}

// =============================================================================
// SHARED DOCUMENTS FUNCTIONS
// =============================================================================

export async function createSharedDocument(data: InsertSharedDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(sharedDocuments).values(data);
}

export async function getSharedDocumentByToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(sharedDocuments)
    .where(eq(sharedDocuments.shareToken, token))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function deleteSharedDocument(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.delete(sharedDocuments).where(eq(sharedDocuments.id, id));
}

// =============================================================================
// COMPANY SETTINGS FUNCTIONS
// =============================================================================

export async function getCompanySettingsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(companySettings)
    .where(eq(companySettings.userId, userId))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function createCompanySettings(data: InsertCompanySettings) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(companySettings).values(data);
}

export async function updateCompanySettings(userId: number, data: Partial<InsertCompanySettings>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.update(companySettings)
    .set(data)
    .where(eq(companySettings.userId, userId));
}

export async function incrementInvoiceNumber(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get current settings
  const settings = await getCompanySettingsByUserId(userId);
  if (!settings) throw new Error("Company settings not found");
  
  // Increment and update
  const newNumber = (settings.nextInvoiceNumber || 1) + 1;
  await db.update(companySettings)
    .set({ nextInvoiceNumber: newNumber })
    .where(eq(companySettings.userId, userId));
  
  return newNumber;
}

// =============================================================================
// PROJECT CHECK-INS FUNCTIONS
// =============================================================================

export async function createProjectCheckin(data: InsertProjectCheckin) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(projectCheckins).values(data);
}

export async function getProjectCheckinsByProjectId(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(projectCheckins)
    .where(eq(projectCheckins.projectId, projectId))
    .orderBy(desc(projectCheckins.checkInTime));
}

export async function getProjectCheckinsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(projectCheckins)
    .where(eq(projectCheckins.userId, userId))
    .orderBy(desc(projectCheckins.checkInTime));
}

export async function getActiveCheckin(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(projectCheckins)
    .where(and(
      eq(projectCheckins.projectId, projectId),
      eq(projectCheckins.userId, userId),
      sql`${projectCheckins.checkOutTime} IS NULL`
    ))
    .orderBy(desc(projectCheckins.checkInTime))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function updateProjectCheckin(id: number, data: Partial<InsertProjectCheckin>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.update(projectCheckins)
    .set(data)
    .where(eq(projectCheckins.id, id));
}
