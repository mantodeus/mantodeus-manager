import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, jobs, tasks, images, reports, comments, contacts, invoices, notes, locations, InsertJob, InsertTask, InsertImage, InsertReport, InsertComment, InsertContact, InsertInvoice, InsertNote, InsertLocation, jobContacts, jobDates, InsertJobDate } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
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
    } else if (user.openId === ENV.ownerOpenId) {
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

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
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
  
  const result = await db.insert(images).values(image);
  return result;
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
  return db.select().from(contacts).where(eq(contacts.createdBy, userId));
}

export async function getContactById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createContact(data: InsertContact) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(contacts).values(data);
  return result;
}

export async function updateContact(id: number, data: Partial<InsertContact>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(contacts).set(data).where(eq(contacts.id, id));
}

export async function deleteContact(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(contacts).where(eq(contacts.id, id));
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

export async function deleteInvoice(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(invoices).where(eq(invoices.id, id));
}

// ===== NOTES QUERIES =====

export async function getNotesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notes).where(eq(notes.createdBy, userId));
}

export async function getNotesByJob(jobId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notes).where(eq(notes.jobId, jobId));
}

export async function getNotesByContact(contactId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notes).where(eq(notes.contactId, contactId));
}

export async function getNoteById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createNote(data: InsertNote) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(notes).values(data);
}

export async function updateNote(id: number, data: Partial<InsertNote>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(notes).set(data).where(eq(notes.id, id));
}

export async function deleteNote(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(notes).where(eq(notes.id, id));
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
