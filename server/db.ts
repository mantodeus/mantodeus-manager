import { eq, desc, and, or, sql, isNull, isNotNull, inArray, ne } from "drizzle-orm";
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
  sharedDocuments, companySettings, projectCheckins, userPreferences,
  type InsertSharedDocument, type InsertCompanySettings, type InsertProjectCheckin,
  type UserPreferences, type InsertUserPreferences,
  // Inspection types
  inspections, inspectionTemplates, inspectionUnits, inspectionFindings, inspectionMedia,
  type InsertInspection, type InsertInspectionTemplate, type InsertInspectionUnit,
  type InsertInspectionFinding, type InsertInspectionMedia,
  type Inspection, type InspectionTemplate, type InspectionUnit, type InspectionFinding, type InspectionMedia,
  // Expense types
  expenses, expenseFiles,
  type InsertExpense, type InsertExpenseFile,
  type Expense, type ExpenseFile,
  // Legacy types (kept for backward compatibility)
  jobs, tasks, images, reports, comments, contacts, invoices, invoiceItems, notes, noteFiles, locations, 
  InsertJob, InsertTask, InsertImage, InsertReport, InsertComment, InsertContact, 
  InsertInvoice, InsertInvoiceItem, InsertNote, InsertNoteFile, jobContacts, jobDates, InsertJobDate,
  type Invoice, type InvoiceItem, type NoteFile
} from "../drizzle/schema";
import { ENV } from './_core/env';
// Schema guards removed from hot path - initialized once at server startup
// import { ensureContactsSchema, ensureFileMetadataSchema, ensureImagesSchema, ensureNotesSchema, ensureProjectsSchema } from "./_core/schemaGuards";

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
let _invoiceSchemaReady = false;

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
      
      // Create MySQL connection pool with proper configuration
      // mysql2.createPool accepts connection string directly and pool options as second param
      _pool = mysql.createPool(process.env.DATABASE_URL, {
        connectionLimit: 10,
        connectTimeout: 10000, // 10 seconds
        acquireTimeout: 10000, // 10 seconds
        timeout: 10000, // 10 seconds
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
      });
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
  
  return requireDbConnection();
}

async function ensureInvoiceSchema(db: any) {
  if (_invoiceSchemaReady) return;
  const isDuplicateColumnError = (error: any) =>
    error?.code === "ER_DUP_FIELDNAME" || error?.cause?.code === "ER_DUP_FIELDNAME";
  const isDuplicateIndexError = (error: any) =>
    error?.code === "ER_DUP_KEYNAME" || error?.cause?.code === "ER_DUP_KEYNAME";
  const executeStatement = async (statement: string, ignoreError: (error: any) => boolean) => {
    try {
      await db.execute(sql.raw(statement));
    } catch (error: any) {
      if (ignoreError(error)) return;
      throw error;
    }
  };

  try {
    await executeStatement(
      "ALTER TABLE `invoices` ADD COLUMN `sentAt` DATETIME NULL AFTER `dueDate`",
      isDuplicateColumnError
    );
    await executeStatement(
      "ALTER TABLE `invoices` ADD COLUMN `paidAt` DATETIME NULL AFTER `sentAt`",
      isDuplicateColumnError
    );

    try {
    await db.execute(sql`
      ALTER TABLE invoices
        ADD COLUMN IF NOT EXISTS invoiceYear INT NOT NULL DEFAULT 0 AFTER invoiceNumber,
        ADD COLUMN IF NOT EXISTS invoiceCounter INT NOT NULL DEFAULT 0 AFTER invoiceYear,
        ADD COLUMN IF NOT EXISTS issueDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER status,
        ADD COLUMN IF NOT EXISTS servicePeriodStart DATETIME NULL AFTER notes,
        ADD COLUMN IF NOT EXISTS servicePeriodEnd DATETIME NULL AFTER servicePeriodStart,
        ADD COLUMN IF NOT EXISTS referenceNumber VARCHAR(100) NULL AFTER servicePeriodEnd,
        ADD COLUMN IF NOT EXISTS partialInvoice BOOLEAN NOT NULL DEFAULT 0 AFTER referenceNumber,
        ADD COLUMN IF NOT EXISTS clientId INT NULL AFTER userId,
        ADD COLUMN IF NOT EXISTS contactId INT NULL AFTER clientId,
        ADD COLUMN IF NOT EXISTS jobId INT NULL AFTER contactId,
        ADD COLUMN IF NOT EXISTS pdfFileKey VARCHAR(500) NULL AFTER total,
        ADD COLUMN IF NOT EXISTS filename VARCHAR(255) NULL AFTER pdfFileKey,
        ADD COLUMN IF NOT EXISTS fileKey VARCHAR(500) NULL AFTER filename,
        ADD COLUMN IF NOT EXISTS fileSize INT NULL AFTER fileKey,
        ADD COLUMN IF NOT EXISTS mimeType VARCHAR(100) NULL AFTER fileSize,
        ADD COLUMN IF NOT EXISTS uploadDate DATETIME NULL AFTER mimeType,
        ADD COLUMN IF NOT EXISTS uploadedBy INT NULL AFTER uploadDate,
        ADD COLUMN IF NOT EXISTS archivedAt DATETIME NULL AFTER updatedAt,
        ADD COLUMN IF NOT EXISTS trashedAt DATETIME NULL AFTER archivedAt
    `);
    } catch (error) {
      console.warn("[Database] Invoice schema legacy alter skipped:", error);
    }

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoiceId INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        category VARCHAR(120) NULL,
        quantity DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        unitPrice DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
        lineTotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT invoice_items_invoiceId_fkey FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
      )
    `);

    await executeStatement(
      "CREATE UNIQUE INDEX `invoice_number_per_user` ON `invoices` (`userId`, `invoiceNumber`)",
      isDuplicateIndexError
    );
    await executeStatement(
      "CREATE INDEX `invoices_archivedAt_idx` ON `invoices` (`archivedAt`)",
      isDuplicateIndexError
    );
    await executeStatement(
      "CREATE INDEX `invoices_trashedAt_idx` ON `invoices` (`trashedAt`)",
      isDuplicateIndexError
    );
    await executeStatement(
      "CREATE INDEX `invoices_sentAt_idx` ON `invoices` (`sentAt`)",
      isDuplicateIndexError
    );
    await executeStatement(
      "CREATE INDEX `invoices_paidAt_idx` ON `invoices` (`paidAt`)",
      isDuplicateIndexError
    );
    _invoiceSchemaReady = true;
  } catch (error) {
    console.error("[Database] Failed to ensure invoice schema:", error);
  }
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

/**
 * Resolve the local database userId (INT) from a User object.
 * 
 * This ensures we always use the INT id for database queries, never the Supabase UUID.
 * This is a defensive helper to prevent identity mismatches at the auth → domain boundary.
 * 
 * @param user - User object from context (must have id: number)
 * @returns The INT userId for database queries
 * @throws Error if user is null or id is missing/invalid
 */
export function getUserIdFromUser(user: { id: number } | null): number {
  console.error(`[getUserIdFromUser] DEBUG - user:`, {
    hasUser: !!user,
    userId: user?.id,
    userIdType: typeof user?.id,
    userKeys: user ? Object.keys(user) : [],
  });
  
  if (!user) {
    const error = new Error("User is required but was null");
    console.error(`[getUserIdFromUser] ERROR:`, error.message);
    throw error;
  }
  if (typeof user.id !== "number" || user.id <= 0) {
    const error = new Error(`Invalid userId: expected positive integer, got ${user.id} (type: ${typeof user.id})`);
    console.error(`[getUserIdFromUser] ERROR:`, error.message);
    throw error;
  }
  console.error(`[getUserIdFromUser] SUCCESS - returning userId: ${user.id}`);
  return user.id;
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
  
  // Extract insertId from Drizzle result
  const insertId = Array.isArray(result) ? result[0]?.insertId : (result as any).insertId;
  if (!insertId) {
    throw new Error("Failed to create image: no insert ID returned");
  }
  
  // Return in format expected by callers: [{ id: insertId }]
  return [{ id: Number(insertId) }];
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

// Get user by ID
export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
  }).from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}


// ===== CONTACTS QUERIES =====

export async function getContactsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
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
  
  const result = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createContact(data: InsertContact) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  try {
    const result = await db.insert(contacts).values(data);
    console.log("[Database] createContact raw result:", JSON.stringify(result, null, 2));
    console.log("[Database] createContact result type:", typeof result, Array.isArray(result));
    
    // MySQL2 returns result as [ResultSetHeader] where ResultSetHeader has insertId
    // But Drizzle might wrap it differently - check both structures
    let insertId: number | undefined;
    
    if (Array.isArray(result) && result[0]) {
      insertId = (result[0] as any)?.insertId;
    } else if (result && typeof result === 'object' && 'insertId' in result) {
      insertId = (result as any).insertId;
    } else if (result && typeof result === 'object' && '0' in result) {
      insertId = (result as any)[0]?.insertId;
    }
    
    console.log("[Database] createContact extracted insertId:", insertId);
    
    if (!insertId || insertId === 0) {
      console.error("[Database] createContact: No valid insertId returned", {
        result,
        resultType: typeof result,
        isArray: Array.isArray(result),
        resultKeys: result && typeof result === 'object' ? Object.keys(result) : 'N/A'
      });
      throw new Error("Failed to get insert ID from database");
    }
    
    console.log("[Database] createContact success, returning id:", insertId);
    return [{ id: insertId }];
  } catch (error) {
    console.error("[Database] createContact error:", error);
    if (error instanceof Error) {
      console.error("[Database] createContact error stack:", error.stack);
    }
    throw error;
  }
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

export async function getArchivedContactsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
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
  
  return db
    .update(contacts)
    .set({ archivedAt: new Date() })
    .where(and(eq(contacts.id, id), isNull(contacts.archivedAt), isNull(contacts.trashedAt)));
}

export async function restoreArchivedContact(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db
    .update(contacts)
    .set({ archivedAt: null })
    .where(and(eq(contacts.id, id), isNotNull(contacts.archivedAt), isNull(contacts.trashedAt)));
}

export async function moveContactToTrash(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db
    .update(contacts)
    .set({ trashedAt: new Date() })
    .where(and(eq(contacts.id, id), isNull(contacts.trashedAt)));
}

export async function restoreContactFromTrash(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
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
  // Legacy function - use getInvoicesByUserId instead
  return getInvoicesByUserId(userId);
}

export type InvoiceWithItems = Invoice & { items: InvoiceItem[] };

export async function getInvoicesByJob(jobId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invoices).where(eq(invoices.jobId!, jobId));
}

export async function getInvoicesByContact(contactId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invoices).where(eq(invoices.clientId, contactId));
}

async function attachInvoiceItems(invoiceList: Invoice[]): Promise<InvoiceWithItems[]> {
  if (invoiceList.length === 0) return [] as InvoiceWithItems[];
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const invoiceIds = invoiceList.map((invoice) => invoice.id);
  const rows = await db.select().from(invoiceItems).where(inArray(invoiceItems.invoiceId, invoiceIds));
  const grouped = new Map<number, InsertInvoiceItem[]>();
  rows.forEach((item) => {
    const list = grouped.get(item.invoiceId) ?? [];
    list.push(item);
    grouped.set(item.invoiceId, list);
  });

  return invoiceList.map((invoice) => ({
    ...invoice,
    items: grouped.get(invoice.id) ?? [],
  }));
}

export async function getInvoiceById(invoiceId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureInvoiceSchema(db);

  const result = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!result || result.length === 0) return null;

  const [withItems] = await attachInvoiceItems(result as any);
  return withItems ?? null;
}

export async function getInvoiceNumbersByIds(ids: number[]) {
  if (!ids.length) return new Map<number, string>();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureInvoiceSchema(db);

  const rows = await db
    .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })
    .from(invoices)
    .where(inArray(invoices.id, ids));

  const map = new Map<number, string>();
  for (const row of rows) {
    map.set(Number(row.id), row.invoiceNumber);
  }
  return map;
}

export async function getInvoiceSummariesByIds(ids: number[]) {
  if (!ids.length) return new Map<number, { invoiceNumber: string; sentAt: Date | null }>();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureInvoiceSchema(db);

  const rows = await db
    .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, sentAt: invoices.sentAt })
    .from(invoices)
    .where(inArray(invoices.id, ids));

  const map = new Map<number, { invoiceNumber: string; sentAt: Date | null }>();
  for (const row of rows) {
    map.set(Number(row.id), { invoiceNumber: row.invoiceNumber, sentAt: row.sentAt ?? null });
  }
  return map;
}

export async function getCancellationInvoiceByOriginalId(originalId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureInvoiceSchema(db);

  const rows = await db
    .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, sentAt: invoices.sentAt })
    .from(invoices)
    .where(and(eq(invoices.cancelledInvoiceId, originalId), eq(invoices.type, "cancellation")))
    .limit(1);

  return rows[0] ?? null;
}

export async function getCancellationInvoiceMapByOriginalIds(originalIds: number[]) {
  if (!originalIds.length) return new Map<number, number>();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureInvoiceSchema(db);

  const rows = await db
    .select({ id: invoices.id, cancelledInvoiceId: invoices.cancelledInvoiceId })
    .from(invoices)
    .where(and(inArray(invoices.cancelledInvoiceId, originalIds), eq(invoices.type, "cancellation")));

  const map = new Map<number, number>();
  for (const row of rows) {
    if (row.cancelledInvoiceId != null) {
      map.set(Number(row.cancelledInvoiceId), Number(row.id));
    }
  }
  return map;
}

export async function getInvoicesByUserId(userId: number) {
  console.error('[TRACE] getInvoicesByUserId START - userId:', userId, 'type:', typeof userId);
  
  console.error('[TRACE] getInvoicesByUserId - calling getDb()');
  const db = await getDb();
  console.error('[TRACE] getInvoicesByUserId - getDb() returned:', !!db);
  
  if (!db) {
    console.error('[TRACE] getInvoicesByUserId - ERROR: Database not available');
    throw new Error("Database not available");
  }
  
  console.error('[TRACE] getInvoicesByUserId - calling ensureInvoiceSchema');
  await ensureInvoiceSchema(db);
  console.error('[TRACE] getInvoicesByUserId - ensureInvoiceSchema completed');
  
  // FORENSIC LOGGING: Verify runtime database identity
  try {
    const dbInfoResult = await db.execute(sql`
      SELECT 
        DATABASE()      AS databaseName,
        @@hostname      AS host,
        @@port          AS port,
        USER()          AS dbUser
    `);
    // Drizzle execute returns [rows, fields] format from mysql2
    const dbInfo = Array.isArray(dbInfoResult) && dbInfoResult[0] ? dbInfoResult[0] : dbInfoResult;
    const dbInfoRow = Array.isArray(dbInfo) ? dbInfo[0] : dbInfo;
    console.error('[DB RUNTIME INFO]', JSON.stringify(dbInfoRow, null, 2));
  } catch (dbInfoError) {
    console.error('[DB RUNTIME INFO] Failed to query database info:', dbInfoError);
  }
  
  // Log sanitized DATABASE_URL
  console.error(
    '[DB ENV]',
    process.env.DATABASE_URL?.replace(/:\/\/.*@/, '://***@') || 'DATABASE_URL not set'
  );
  
  // Diagnostic logging to help identify visibility issues
  console.log(`[Invoices] getInvoicesByUserId called with userId: ${userId} (type: ${typeof userId})`);
  
  console.error('[TRACE] getInvoicesByUserId - about to execute SELECT query');
  let invoiceRows;
  try {
    invoiceRows = await db
      .select()
      .from(invoices)
      .where(and(
        eq(invoices.userId, userId),
        isNull(invoices.archivedAt),
        isNull(invoices.trashedAt),
        // Exclude invoices that need review
        or(isNull(invoices.needsReview), eq(invoices.needsReview, false))
      ))
      .orderBy(desc(invoices.issueDate), desc(invoices.createdAt));
    console.error('[TRACE] getInvoicesByUserId - SELECT query completed successfully, rows:', invoiceRows.length);
  } catch (queryError: any) {
    console.error('[TRACE] getInvoicesByUserId - SELECT query FAILED');
    console.error('[TRACE] getInvoicesByUserId - error type:', queryError?.constructor?.name || typeof queryError);
    console.error('[TRACE] getInvoicesByUserId - error message:', queryError?.message);
    console.error('[TRACE] getInvoicesByUserId - error code:', queryError?.code);
    console.error('[TRACE] getInvoicesByUserId - error errno:', queryError?.errno);
    console.error('[TRACE] getInvoicesByUserId - error sqlState:', queryError?.sqlState);
    console.error('[TRACE] getInvoicesByUserId - error sqlMessage:', queryError?.sqlMessage);
    console.error('[TRACE] getInvoicesByUserId - error sql:', queryError?.sql);
    
    // Extract underlying MySQL error from cause property
    if (queryError?.cause) {
      console.error('[TRACE] getInvoicesByUserId - error.cause exists:', typeof queryError.cause);
      console.error('[TRACE] getInvoicesByUserId - error.cause type:', queryError.cause?.constructor?.name);
      console.error('[TRACE] getInvoicesByUserId - error.cause message:', queryError.cause?.message);
      console.error('[TRACE] getInvoicesByUserId - error.cause code:', queryError.cause?.code);
      console.error('[TRACE] getInvoicesByUserId - error.cause errno:', queryError.cause?.errno);
      console.error('[TRACE] getInvoicesByUserId - error.cause sqlState:', queryError.cause?.sqlState);
      console.error('[TRACE] getInvoicesByUserId - error.cause sqlMessage:', queryError.cause?.sqlMessage);
    }
    
    // Try to extract all error properties recursively
    const errorProps: any = {};
    const extractErrorProps = (err: any, depth = 0): any => {
      if (!err || depth > 3) return {};
      const props: any = {};
      for (const key of Object.getOwnPropertyNames(err)) {
        try {
          const value = err[key];
          if (typeof value !== 'function' && typeof value !== 'object') {
            props[key] = value;
          } else if (key === 'cause' && value) {
            props.cause = extractErrorProps(value, depth + 1);
          }
        } catch (e) {
          // Ignore property access errors
        }
      }
      return props;
    };
    
    const allErrorProps = extractErrorProps(queryError);
    console.error('[TRACE] getInvoicesByUserId - all error properties:', JSON.stringify(allErrorProps, null, 2));
    console.error('[TRACE] getInvoicesByUserId - error stack:', queryError?.stack);
    throw queryError;
  }

  console.log(`[Invoices] Found ${invoiceRows.length} invoices for userId ${userId}`);
  if (invoiceRows.length > 0) {
    console.log(`[Invoices] Invoice numbers: ${invoiceRows.map(i => i.invoiceNumber).join(', ')}`);
  }
  
  // Also check if RE-2025-0001 exists with different userId (diagnostic only)
  try {
    const re20250001 = await db
      .select({ 
        id: invoices.id, 
        invoiceNumber: invoices.invoiceNumber, 
        userId: invoices.userId, 
        archivedAt: invoices.archivedAt, 
        trashedAt: invoices.trashedAt 
      })
      .from(invoices)
      .where(eq(invoices.invoiceNumber, 'RE-2025-0001'))
      .limit(1);
    
    if (re20250001.length > 0) {
      const invoice = re20250001[0];
      console.log(`[Invoices] RE-2025-0001 exists: userId=${invoice.userId}, archivedAt=${invoice.archivedAt}, trashedAt=${invoice.trashedAt}`);
      if (invoice.userId !== userId) {
        console.warn(`[Invoices] ⚠️ RE-2025-0001 belongs to userId ${invoice.userId}, but query is for userId ${userId}`);
      }
    }
  } catch (diagError) {
    // Don't fail the main query if diagnostic check fails
    console.warn(`[Invoices] Diagnostic check failed:`, diagError);
  }

  return attachInvoiceItems(invoiceRows as any);
}

export async function getArchivedInvoicesByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureInvoiceSchema(db);
  const invoiceRows = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.userId, userId), isNotNull(invoices.archivedAt), isNull(invoices.trashedAt)))
    .orderBy(desc(invoices.createdAt));

  return attachInvoiceItems(invoiceRows as any);
}

export async function getTrashedInvoicesByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureInvoiceSchema(db);
  const invoiceRows = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.userId, userId), isNotNull(invoices.trashedAt)))
    .orderBy(desc(invoices.createdAt));

  return attachInvoiceItems(invoiceRows as any);
}

async function getHighestInvoiceCounter(userId: number, invoiceYear: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    // Only count invoices that are NOT trashed (trashed draft invoices should release their numbers)
    // OR invoices that are open/paid (even if trashed, these numbers must be preserved)
    const result = await db
      .select({ maxCounter: sql<number>`COALESCE(MAX(${invoices.invoiceCounter}), 0)`.as("maxCounter") })
      .from(invoices)
      .where(
        and(
          eq(invoices.userId, userId),
          eq(invoices.invoiceYear, invoiceYear),
          or(
            isNull(invoices.trashedAt), // Not trashed at all
            ne(invoices.status, "draft")  // OR open/paid (preserved even if trashed)
          )
        )
      )
      .limit(1);
    return result[0]?.maxCounter ?? 0;
  } catch (error) {
    console.error("[getHighestInvoiceCounter] Error:", error);
    // Fallback: if query fails, return 0 (no invoices exist yet)
    return 0;
  }
}

export async function ensureUniqueInvoiceNumber(userId: number, invoiceNumber: string, currentInvoiceId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Check ALL invoices (including trashed/archived) to ensure uniqueness
  let whereClause = and(eq(invoices.userId, userId), eq(invoices.invoiceNumber, invoiceNumber));
  if (currentInvoiceId) {
    whereClause = and(whereClause, ne(invoices.id, currentInvoiceId));
  }

  const existing = await db.select({ id: invoices.id }).from(invoices).where(whereClause).limit(1);
  if (existing.length > 0) {
    throw new Error("This invoice number already exists. Invoice numbers must be unique.");
  }
}

type ParsedInvoiceNumber = {
  prefix: string;
  numeric: string;
  suffix: string;
  value: number;
  padding: number;
};

function parseInvoiceNumber(value: string): ParsedInvoiceNumber | null {
  if (!value) return null;
  const match = value.match(/^(.*)(\d+)(\D*)$/);
  if (!match) return null;
  const [, prefix, numeric, suffix] = match;
  const parsed = Number(numeric);
  if (!Number.isFinite(parsed)) return null;
  return {
    prefix,
    numeric,
    suffix,
    value: parsed,
    padding: numeric.length,
  };
}

function formatInvoiceNumber(parsed: ParsedInvoiceNumber, nextValue: number, padding?: number) {
  const padded = String(nextValue).padStart(padding ?? parsed.padding, "0");
  return `${parsed.prefix}${padded}${parsed.suffix}`;
}

async function getRecentInvoiceNumbersByUserId(userId: number, limit = 1000) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Check ALL invoices (including trashed/archived) to find the highest number
  // This ensures we never reuse a number that exists in the database
  return await db
    .select({ invoiceNumber: invoices.invoiceNumber })
    .from(invoices)
    .where(eq(invoices.userId, userId))
    .orderBy(desc(invoices.createdAt), desc(invoices.id))
    .limit(limit);
}

function buildDefaultInvoiceSeed(issueDate: Date, fallbackPrefix?: string | null) {
  const year = issueDate.getFullYear();
  const safePrefix = fallbackPrefix?.trim() || "RE";
  return `${safePrefix}-${year}-0001`;
}

export async function generateInvoiceNumber(
  userId: number,
  issueDate: Date,
  formatSeed?: string | null,
  fallbackPrefix?: string | null
) {
  const invoiceYear = issueDate.getFullYear();
  const seedValue = formatSeed?.trim();
  const effectiveSeed = seedValue && seedValue.length > 0 ? seedValue : buildDefaultInvoiceSeed(issueDate, fallbackPrefix);
  const seedParsed = parseInvoiceNumber(effectiveSeed);
  if (!seedParsed) {
    throw new Error("Invoice number format must include a numeric sequence.");
  }

  // Get ALL invoices for this user to find the highest number
  // This ensures we never reuse a number that exists in the database (ANY status)
  const allInvoices = await getRecentInvoiceNumbersByUserId(userId);
  
  // Filter invoices for the same year and matching format
  const yearInvoices = allInvoices.filter((row) => {
    const parsed = parseInvoiceNumber(row.invoiceNumber);
    if (!parsed) return false;
    
    // Check if this invoice matches the expected format
    if (seedValue) {
      // If format seed is provided, match prefix and suffix exactly
      return parsed.prefix === seedParsed.prefix && parsed.suffix === seedParsed.suffix;
    } else {
      // If no format seed, match any invoice with the same prefix pattern
      return parsed.prefix === seedParsed.prefix;
    }
  });

  // Find the highest number among matching invoices
  let maxValue = 0;
  let maxParsed: ParsedInvoiceNumber | null = null;
  
  for (const row of yearInvoices) {
    const parsed = parseInvoiceNumber(row.invoiceNumber);
    if (!parsed) continue;
    if (parsed.value > maxValue) {
      maxValue = parsed.value;
      maxParsed = parsed;
    }
  }

  // If no matching invoices found, use the seed as starting point
  if (!maxParsed) {
    return {
      invoiceNumber: effectiveSeed,
      invoiceCounter: seedParsed.value,
      invoiceYear,
    };
  }

  // Increment from the highest found number
  const nextCounter = maxParsed.value + 1;
  const padding = seedValue ? seedParsed.padding : maxParsed.padding;
  const invoiceNumber = formatInvoiceNumber(maxParsed, nextCounter, padding);
  return { invoiceNumber, invoiceCounter: nextCounter, invoiceYear };
}

export async function createInvoice(data: Omit<InsertInvoice, "id"> & { items?: Array<Omit<InsertInvoiceItem, "invoiceId">> }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureInvoiceSchema(db);

  const issueDate = data.issueDate ? new Date(data.issueDate) : new Date();
  const invoiceType = data.type ?? "standard";
  const cancelledInvoiceId = data.cancelledInvoiceId ?? null;
  
  // HARD ASSERTION: Invoice status must always be 'draft' on creation
  // Backend decides lifecycle state - no UI dependency, no silent corruption
  // If caller tries to set a different status, reject it
  if (data.status && data.status !== "draft") {
    throw new Error(`Invoice status must be 'draft' on creation. Received: ${data.status}`);
  }
  if (invoiceType === "cancellation" && !cancelledInvoiceId) {
    throw new Error("Cancellation invoices must reference an original invoice.");
  }
  if (invoiceType !== "cancellation" && cancelledInvoiceId) {
    throw new Error("Only cancellation invoices may reference an original invoice.");
  }
  
  // Prepare invoice data (excluding items which go in a separate table)
  const invoiceData: Omit<InsertInvoice, "id" | "createdAt" | "updatedAt"> = {
    contactId: data.contactId ?? data.clientId ?? null,
    clientId: data.clientId ?? data.contactId ?? null,
    jobId: data.jobId ?? null,
    invoiceNumber: data.invoiceNumber ?? "",
    invoiceCounter: data.invoiceCounter ?? 0,
    invoiceYear: data.invoiceYear ?? issueDate.getFullYear(),
    status: "draft", // ALWAYS 'draft' - backend enforces this, never null/empty
    type: invoiceType,
    cancelledInvoiceId,
    issueDate,
    dueDate: data.dueDate ?? null,
    sentAt: (data as any).sentAt ?? null,
    paidAt: (data as any).paidAt ?? null,
    notes: data.notes ?? null,
    servicePeriodStart: data.servicePeriodStart ?? null,
    servicePeriodEnd: data.servicePeriodEnd ?? null,
    referenceNumber: data.referenceNumber ?? null,
    partialInvoice: data.partialInvoice ?? false,
    subtotal: data.subtotal ?? "0.00",
    vatAmount: data.vatAmount ?? "0.00",
    total: data.total ?? "0.00",
    pdfFileKey: data.pdfFileKey ?? null,
    filename: data.filename ?? null,
    fileKey: data.fileKey ?? null,
    fileSize: data.fileSize ?? null,
    mimeType: data.mimeType ?? null,
    uploadDate: data.uploadDate ?? null,
    uploadedBy: data.uploadedBy ?? null,
    uploadedAt: data.uploadedAt ?? null,
    source: data.source ?? "created",
    needsReview: data.needsReview ?? false,
    originalPdfS3Key: data.originalPdfS3Key ?? null,
    userId: data.userId,
    // Explicitly set timestamp fields - allow passed values to override defaults
    sentAt: data.sentAt ?? null,
    paidAt: data.paidAt ?? null,
    archivedAt: data.archivedAt ?? null,
    trashedAt: data.trashedAt ?? null,
  };

  if (!invoiceData.invoiceNumber || invoiceData.invoiceNumber.trim() === "" || !invoiceData.invoiceCounter || invoiceData.invoiceCounter === 0) {
    const settings = await getCompanySettingsByUserId(invoiceData.userId);
    const { invoiceNumber, invoiceCounter, invoiceYear } = await generateInvoiceNumber(
      invoiceData.userId,
      issueDate,
      settings?.invoiceNumberFormat ?? null,
      settings?.invoicePrefix ?? "RE"
    );
    invoiceData.invoiceNumber = invoiceData.invoiceNumber && invoiceData.invoiceNumber.trim() !== "" ? invoiceData.invoiceNumber : invoiceNumber;
    invoiceData.invoiceCounter = invoiceData.invoiceCounter && invoiceData.invoiceCounter > 0 ? invoiceData.invoiceCounter : invoiceCounter;
    invoiceData.invoiceYear = invoiceData.invoiceYear || invoiceYear;
  }

  // FINAL ASSERTION: Status must be 'draft' before insert
  // This turns silent corruption into a loud failure
  if (!invoiceData.status || invoiceData.status !== "draft") {
    throw new Error("Invoice status must be 'draft' before insert. This is a critical data integrity violation.");
  }

  const result = await db.insert(invoices).values(invoiceData);
  const insertId = Array.isArray(result) ? result[0]?.insertId : (result as any).insertId;
  if (!insertId) {
    throw new Error("Failed to create invoice: no insert ID returned");
  }

  const itemsToInsert = (data.items || []).map((item) => ({
    ...item,
    invoiceId: Number(insertId),
  }));
  if (itemsToInsert.length > 0) {
    await db.insert(invoiceItems).values(itemsToInsert);
  }

  const created = await getInvoiceById(Number(insertId));
  if (!created) throw new Error("Failed to retrieve created invoice");
  return created;
}

export async function createCancellationInvoice(userId: number, invoiceId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureInvoiceSchema(db);

  const issueDate = new Date();
  const settings = await getCompanySettingsByUserId(userId);
  const { invoiceNumber, invoiceCounter, invoiceYear } = await generateInvoiceNumber(
    userId,
    issueDate,
    settings?.invoiceNumberFormat ?? null,
    settings?.invoicePrefix ?? "RE"
  );

  return db.transaction(async (tx: any) => {
    const [original] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
    if (!original) {
      throw new Error("Invoice not found");
    }
    if (original.userId !== userId) {
      throw new Error("You don't have access to this invoice");
    }
    if (original.type === "cancellation") {
      throw new Error("Cancellation invoices cannot be cancelled.");
    }
    if (original.status !== "open" && original.status !== "paid") {
      throw new Error("Only open or paid invoices can be cancelled.");
    }

    const existing = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.cancelledInvoiceId, invoiceId))
      .limit(1);
    if (existing.length > 0) {
      throw new Error("A cancellation invoice already exists for this invoice.");
    }

    const items = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
    const negateMoney = (value: unknown) => {
      const num = Number(value ?? 0);
      const negated = Number.isFinite(num) ? -1 * num : 0;
      return negated.toFixed(2);
    };

    const insertResult = await tx.insert(invoices).values({
      userId: original.userId,
      clientId: original.clientId ?? null,
      contactId: original.contactId ?? null,
      jobId: original.jobId ?? null,
      invoiceNumber,
      invoiceCounter,
      invoiceYear,
      status: "draft",
      type: "cancellation",
      cancelledInvoiceId: original.id,
      issueDate,
      dueDate: issueDate,
      notes: original.notes ?? null,
      servicePeriodStart: original.servicePeriodStart ?? null,
      servicePeriodEnd: original.servicePeriodEnd ?? null,
      referenceNumber: original.referenceNumber ?? null,
      partialInvoice: original.partialInvoice ?? false,
      subtotal: negateMoney(original.subtotal),
      vatAmount: negateMoney(original.vatAmount),
      total: negateMoney(original.total),
      pdfFileKey: null,
      filename: null,
      fileKey: null,
      fileSize: null,
      mimeType: null,
      uploadDate: null,
      uploadedBy: null,
      sentAt: null,
      paidAt: null,
      archivedAt: null,
      trashedAt: null,
    });

    const insertId = Array.isArray(insertResult) ? insertResult[0]?.insertId : (insertResult as any).insertId;
    if (!insertId) {
      throw new Error("Failed to create cancellation invoice");
    }

    const itemsToInsert = items.map((item: InvoiceItem) => ({
      invoiceId: Number(insertId),
      name: item.name,
      description: item.description ?? null,
      category: item.category ?? null,
      quantity: negateMoney(item.quantity),
      unitPrice: Number(item.unitPrice ?? 0).toFixed(2),
      currency: item.currency ?? "EUR",
      lineTotal: negateMoney(item.lineTotal),
    }));

    if (itemsToInsert.length > 0) {
      await tx.insert(invoiceItems).values(itemsToInsert);
    }

    return Number(insertId);
  });
}

export async function updateInvoice(id: number, data: Partial<InsertInvoice> & { items?: Array<Omit<InsertInvoiceItem, "invoiceId">> }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureInvoiceSchema(db);

  if ("cancelledInvoiceId" in data || "type" in data) {
    throw new Error("Invoice cancellation metadata cannot be edited.");
  }

  const { items, ...invoiceData } = data;
  const updates = {
    ...invoiceData,
    contactId: invoiceData.contactId ?? invoiceData.clientId,
    clientId: invoiceData.clientId ?? invoiceData.contactId,
  };
  await db.update(invoices).set(updates).where(eq(invoices.id, id));

  if (items) {
    await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    if (items.length > 0) {
      const itemsToInsert = items.map((item) => ({
        ...item,
        invoiceId: id,
      }));
      await db.insert(invoiceItems).values(itemsToInsert);
    }
  }

  return getInvoiceById(id);
}

export async function deleteInvoice(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
  return db.delete(invoices).where(eq(invoices.id, id));
}

export async function archiveInvoice(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureInvoiceSchema(db);
  return db
    .update(invoices)
    .set({ archivedAt: new Date(), trashedAt: null })
    .where(eq(invoices.id, id));
}

export async function moveInvoiceToTrash(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureInvoiceSchema(db);
  return db
    .update(invoices)
    .set({ trashedAt: new Date() })
    .where(and(eq(invoices.id, id), isNull(invoices.trashedAt)));
}

export async function restoreInvoice(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureInvoiceSchema(db);
  return db
    .update(invoices)
    .set({ archivedAt: null, trashedAt: null })
    .where(eq(invoices.id, id));
}

export async function issueInvoice(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureInvoiceSchema(db);

  // Draft → Open with sentAt timestamp
  return db
    .update(invoices)
    .set({ status: 'open', sentAt: new Date(), paidAt: null })
    .where(eq(invoices.id, id));
}

export async function markInvoiceAsPaid(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureInvoiceSchema(db);

  return db
    .update(invoices)
    .set({ status: 'paid', paidAt: new Date() })
    .where(eq(invoices.id, id));
}

export async function revertInvoiceStatus(id: number, targetStatus: 'draft' | 'open') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureInvoiceSchema(db);

  // Update status field and clear corresponding timestamps
  if (targetStatus === 'draft') {
    // Reverting to draft: clear both sentAt and paidAt
    return db
      .update(invoices)
      .set({ status: targetStatus, sentAt: null, paidAt: null })
      .where(eq(invoices.id, id));
  } else if (targetStatus === 'open') {
    // Reverting to open (from paid): clear paidAt, keep sentAt
    return db
      .update(invoices)
      .set({ status: targetStatus, paidAt: null })
      .where(eq(invoices.id, id));
  }
}

// ===== INVOICE ITEMS QUERIES =====

export async function getInvoiceItemsByInvoiceId(invoiceId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId))
    .orderBy(invoiceItems.id);
}

export async function createInvoiceItem(data: InsertInvoiceItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(invoiceItems).values(data);
  const insertId = Array.isArray(result) ? result[0]?.insertId : (result as any).insertId;
  if (!insertId) {
    throw new Error("Failed to create invoice item: no insert ID returned");
  }
  const [item] = await db.select().from(invoiceItems).where(eq(invoiceItems.id, Number(insertId))).limit(1);
  if (!item) {
    throw new Error("Failed to retrieve created invoice item");
  }
  return item;
}

export async function updateInvoiceItem(id: number, data: Partial<InsertInvoiceItem>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(invoiceItems).set(data).where(eq(invoiceItems.id, id));
  const [item] = await db.select().from(invoiceItems).where(eq(invoiceItems.id, id)).limit(1);
  return item || null;
}

export async function deleteInvoiceItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(invoiceItems).where(eq(invoiceItems.id, id));
}

export async function deleteInvoiceItemsByInvoiceId(invoiceId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
}


/**
 * Check if an invoice number is unique for a user (excluding the current invoice)
 */
export async function isInvoiceNumberUnique(
  userId: number,
  invoiceNumber: string,
  excludeInvoiceId?: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [
    eq(invoices.userId, userId),
    eq(invoices.invoiceNumber, invoiceNumber),
  ];

  if (excludeInvoiceId !== undefined) {
    conditions.push(sql`${invoices.id} != ${excludeInvoiceId}` as any);
  }

  const existing = await db.select().from(invoices)
    .where(and(...conditions))
    .limit(1);

  return existing.length === 0;
}

// =============================================================================
// EXPENSES QUERIES
// =============================================================================

// Accounting fields that trigger status reset to needs_review
const ACCOUNTING_FIELDS = [
  'supplierName',
  'expenseDate',
  'grossAmountCents',
  'currency',
  'vatMode',
  'vatRate',
  'vatAmountCents',
  'businessUsePct',
  'category',
] as const;

export async function createExpense(data: InsertExpense) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(expenses).values(data);
  const insertId = Array.isArray(result) ? result[0]?.insertId : (result as any).insertId;
  if (!insertId) {
    throw new Error("Failed to create expense: no insert ID returned");
  }
  
  const created = await getExpenseById(Number(insertId));
  if (!created) throw new Error("Failed to retrieve created expense");
  return created;
}

export async function getExpenseById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const query = sql`SELECT * FROM expenses WHERE id = ${id} LIMIT 1`;
  const result = await db.execute(query);
  const rows = Array.isArray(result) ? result[0] : result;
  const list = Array.isArray(rows) ? rows : [];

  if (list.length === 0) {
    return null;
  }

  const row = list[0] as Expense & Partial<{
    paymentStatus: "paid" | "unpaid";
    paymentDate: Date | null;
    paymentMethod: "cash" | "bank_transfer" | "card" | "online" | null;
    confidenceScore: number | null;
    confidenceReason: string | null;
  }>;

  // Always include files (even if empty)
  const files = await getExpenseFilesByExpenseId(id);

  return {
    ...row,
    paymentStatus: row.paymentStatus ?? "unpaid",
    paymentDate: row.paymentDate ?? null,
    paymentMethod: row.paymentMethod ?? null,
    confidenceScore: row.confidenceScore ?? null,
    confidenceReason: row.confidenceReason ?? null,
    files,
  };
}

export async function listExpensesByUser(
  userId: number,
  statusFilter?: "needs_review" | "in_order" | "void",
  includeVoid = false
) {
  const db = await getDb();
  if (!db) return [];

  const VOID_STATUS: Expense["status"] = "void";

  const baseWhere = eq(expenses.createdBy, userId);

  if (statusFilter !== undefined) {
    return await db
      .select()
      .from(expenses)
      .where(and(baseWhere, eq(expenses.status, statusFilter)))
      .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt));
  }

  if (includeVoid) {
    return await db
      .select()
      .from(expenses)
      .where(baseWhere)
      .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt));
  }

  return await db
    .select()
    .from(expenses)
    .where(and(baseWhere, ne(expenses.status, VOID_STATUS)))
    .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt));
}

export async function getExpenseFileCountsByExpenseIds(
  expenseIds: number[]
): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  if (expenseIds.length === 0) return counts;

  const db = await getDb();
  if (!db) return counts;

  try {
    const rows = await db
      .select({
        expenseId: expenseFiles.expenseId,
        count: sql<number>`count(*)`,
      })
      .from(expenseFiles)
      .where(inArray(expenseFiles.expenseId, expenseIds))
      .groupBy(expenseFiles.expenseId);

    rows.forEach((row) => {
      counts.set(Number(row.expenseId), Number(row.count));
    });
  } catch (error) {
    console.error("[Expenses] Failed to load receipt counts:", error);
  }

  return counts;
}

export async function updateExpense(id: number, updates: Partial<InsertExpense>, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getExpenseById(id);
  if (!existing) {
    throw new Error("Expense not found");
  }
  
  // Detect if any accounting fields changed
  const accountingFieldChanged = ACCOUNTING_FIELDS.some(
    (field) => field in updates && updates[field as keyof typeof updates] !== existing[field]
  );
  
  const updateData: Partial<InsertExpense> = {
    ...updates,
    updatedByUserId: userId,
  };
  
  // If accounting fields changed, reset to needs_review and clear review fields
  if (accountingFieldChanged && existing.status === 'in_order') {
    updateData.status = 'needs_review';
    updateData.reviewedByUserId = null;
    updateData.reviewedAt = null;
  }
  
  await db.update(expenses).set(updateData).where(eq(expenses.id, id));
  
  return await getExpenseById(id);
}

export async function setExpenseStatus(
  id: number,
  status: 'needs_review' | 'in_order' | 'void',
  userId: number,
  voidReason?: 'duplicate' | 'personal' | 'mistake' | 'wrong_document' | 'other',
  voidNote?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getExpenseById(id);
  if (!existing) {
    throw new Error("Expense not found");
  }
  
  // Hard rule: void only if in_order + reason
  if (status === 'void' && existing.status !== 'in_order') {
    throw new Error("Can only void expenses that are in_order");
  }
  
  if (status === 'void' && !voidReason) {
    throw new Error("voidReason is required when voiding an expense");
  }
  
  const updateData: Partial<InsertExpense> = {
    status,
    updatedByUserId: userId,
  };
  
  if (status === 'in_order') {
    updateData.reviewedByUserId = userId;
    updateData.reviewedAt = new Date();
    // Clear void fields if transitioning from void
    if (existing.status === 'void') {
      updateData.voidedByUserId = null;
      updateData.voidedAt = null;
      updateData.voidReason = null;
      updateData.voidNote = null;
    }
  } else if (status === 'void') {
    updateData.voidedByUserId = userId;
    updateData.voidedAt = new Date();
    updateData.voidReason = voidReason!;
    updateData.voidNote = voidNote || null;
    // Clear review fields
    updateData.reviewedByUserId = null;
    updateData.reviewedAt = null;
  } else if (status === 'needs_review') {
    // Clear review fields when resetting to needs_review
    updateData.reviewedByUserId = null;
    updateData.reviewedAt = null;
  }
  
  await db.update(expenses).set(updateData).where(eq(expenses.id, id));
  
  return await getExpenseById(id);
}

export async function deleteExpense(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getExpenseById(id);
  if (!existing) {
    throw new Error("Expense not found");
  }
  
  // Hard rule: delete only if needs_review
  if (existing.status !== 'needs_review') {
    throw new Error("Can only delete expenses with status 'needs_review'");
  }
  
  return await db.delete(expenses).where(eq(expenses.id, id));
}

export async function addExpenseFile(data: InsertExpenseFile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(expenseFiles).values(data);
  const insertId = Array.isArray(result) ? result[0]?.insertId : (result as any).insertId;
  if (!insertId) {
    throw new Error("Failed to create expense file: no insert ID returned");
  }
  
  const [file] = await db.select().from(expenseFiles).where(eq(expenseFiles.id, Number(insertId))).limit(1);
  if (!file) {
    throw new Error("Failed to retrieve created expense file");
  }
  return file;
}

export async function deleteExpenseFile(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Return file before delete for S3 cleanup
  const file = await db.select().from(expenseFiles).where(eq(expenseFiles.id, id)).limit(1);
  
  await db.delete(expenseFiles).where(eq(expenseFiles.id, id));
  
  return file.length > 0 ? file[0] : null;
}

export async function getExpenseFileById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(expenseFiles).where(eq(expenseFiles.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getExpenseFilesByExpenseId(expenseId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(expenseFiles)
    .where(eq(expenseFiles.expenseId, expenseId))
    .orderBy(desc(expenseFiles.createdAt));
}

// ===== NOTES QUERIES =====

/**
 * Helper to select note columns safely (handles missing clientCreationKey column)
 */
const selectNoteColumns = {
  id: notes.id,
  title: notes.title,
  content: notes.content,
  tags: notes.tags,
  jobId: notes.jobId,
  contactId: notes.contactId,
  archivedAt: notes.archivedAt,
  trashedAt: notes.trashedAt,
  createdBy: notes.createdBy,
  createdAt: notes.createdAt,
  updatedAt: notes.updatedAt,
};

/**
 * Wrapper for note queries that handles missing clientCreationKey column
 */
async function safeNoteQuery<T>(queryFn: () => Promise<T>): Promise<T> {
  try {
    return await queryFn();
  } catch (error: any) {
    // Handle case where clientCreationKey column doesn't exist yet
    if (error?.message?.includes("clientCreationKey") || 
        error?.message?.includes("Unknown column") ||
        error?.code === "ER_BAD_FIELD_ERROR") {
      console.log("[Database] clientCreationKey column not found, using explicit column selection (migration not run yet)");
      throw new Error("RETRY_WITH_EXPLICIT_COLUMNS");
    }
    throw error;
  }
}

export async function getNotesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const results = await safeNoteQuery(async () => {
      return db
        .select()
        .from(notes)
        .where(and(
          eq(notes.createdBy, userId),
          isNull(notes.archivedAt),
          isNull(notes.trashedAt)
        ))
        .orderBy(desc(notes.updatedAt));
    });
    const fileCounts = await getNoteFileCountsByNoteIds(results.map((note) => note.id));
    return results.map((note) => ({
      ...note,
      fileCount: fileCounts.get(note.id) ?? 0,
    }));
  } catch (error: any) {
    if (error?.message === "RETRY_WITH_EXPLICIT_COLUMNS") {
      const results = await db
        .select(selectNoteColumns)
        .from(notes)
        .where(and(
          eq(notes.createdBy, userId),
          isNull(notes.archivedAt),
          isNull(notes.trashedAt)
        ))
        .orderBy(desc(notes.updatedAt));
      const fileCounts = await getNoteFileCountsByNoteIds(results.map((note) => note.id));
      return results.map((note) => ({
        ...note,
        fileCount: fileCounts.get(note.id) ?? 0,
      }));
    }
    throw error;
  }
}

export async function getNotesByJob(jobId: number) {
  const db = await getDb();
  if (!db) return [];
  
  try {
    return await safeNoteQuery(async () => {
      return db
        .select()
        .from(notes)
        .where(and(
          eq(notes.jobId, jobId),
          isNull(notes.archivedAt),
          isNull(notes.trashedAt)
        ))
        .orderBy(desc(notes.updatedAt));
    });
  } catch (error: any) {
    if (error?.message === "RETRY_WITH_EXPLICIT_COLUMNS") {
      return db
        .select(selectNoteColumns)
        .from(notes)
        .where(and(
          eq(notes.jobId, jobId),
          isNull(notes.archivedAt),
          isNull(notes.trashedAt)
        ))
        .orderBy(desc(notes.updatedAt));
    }
    throw error;
  }
}

export async function getNotesByContact(contactId: number) {
  const db = await getDb();
  if (!db) return [];
  
  try {
    return await safeNoteQuery(async () => {
      return db
        .select()
        .from(notes)
        .where(and(
          eq(notes.contactId, contactId),
          isNull(notes.archivedAt),
          isNull(notes.trashedAt)
        ))
        .orderBy(desc(notes.updatedAt));
    });
  } catch (error: any) {
    if (error?.message === "RETRY_WITH_EXPLICIT_COLUMNS") {
      return db
        .select(selectNoteColumns)
        .from(notes)
        .where(and(
          eq(notes.contactId, contactId),
          isNull(notes.archivedAt),
          isNull(notes.trashedAt)
        ))
        .orderBy(desc(notes.updatedAt));
    }
    throw error;
  }
}

export async function getNoteById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  try {
    return await safeNoteQuery(async () => {
      const result = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
      return result.length > 0 ? result[0] : undefined;
    });
  } catch (error: any) {
    if (error?.message === "RETRY_WITH_EXPLICIT_COLUMNS") {
      const result = await db
        .select(selectNoteColumns)
        .from(notes)
        .where(eq(notes.id, id))
        .limit(1);
      return result.length > 0 ? result[0] : undefined;
    }
    throw error;
  }
}

/**
 * Get note by client creation key and user ID (for idempotent creation)
 * Returns undefined if column doesn't exist yet (backward compatibility)
 */
export async function getNoteByClientCreationKey(clientCreationKey: string, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  try {
    const result = await db
      .select()
      .from(notes)
      .where(and(
        eq(notes.clientCreationKey, clientCreationKey),
        eq(notes.createdBy, userId)
      ))
      .limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error: any) {
    // Handle case where clientCreationKey column doesn't exist yet (before migration)
    if (error?.message?.includes("clientCreationKey") || 
        error?.message?.includes("Unknown column") ||
        error?.code === "ER_BAD_FIELD_ERROR") {
      console.log("[Database] clientCreationKey column not found, skipping idempotency check (migration not run yet)");
      return undefined; // Column doesn't exist, skip idempotency check
    }
    // Re-throw other errors
    throw error;
  }
}

export async function createNote(data: InsertNote) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  try {
    return db.insert(notes).values(data);
  } catch (error: any) {
    // Handle case where clientCreationKey column doesn't exist yet
    // Remove clientCreationKey from data and retry
    if (error?.message?.includes("clientCreationKey") || 
        error?.message?.includes("Unknown column") ||
        error?.code === "ER_BAD_FIELD_ERROR") {
      console.log("[Database] clientCreationKey column not found, creating note without it (migration not run yet)");
      const { clientCreationKey, ...dataWithoutKey } = data;
      return db.insert(notes).values(dataWithoutKey);
    }
    // Re-throw other errors
    throw error;
  }
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

export async function getArchivedNotesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  try {
    return await safeNoteQuery(async () => {
      return db
        .select()
        .from(notes)
        .where(and(
          eq(notes.createdBy, userId),
          isNotNull(notes.archivedAt),
          isNull(notes.trashedAt)
        ))
        .orderBy(desc(notes.archivedAt), desc(notes.updatedAt));
    });
  } catch (error: any) {
    if (error?.message === "RETRY_WITH_EXPLICIT_COLUMNS") {
      return db
        .select(selectNoteColumns)
        .from(notes)
        .where(and(
          eq(notes.createdBy, userId),
          isNotNull(notes.archivedAt),
          isNull(notes.trashedAt)
        ))
        .orderBy(desc(notes.archivedAt), desc(notes.updatedAt));
    }
    throw error;
  }
}

export async function getTrashedNotesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  try {
    return await safeNoteQuery(async () => {
      return db
        .select()
        .from(notes)
        .where(and(
          eq(notes.createdBy, userId),
          isNotNull(notes.trashedAt)
        ))
        .orderBy(desc(notes.trashedAt), desc(notes.updatedAt));
    });
  } catch (error: any) {
    if (error?.message === "RETRY_WITH_EXPLICIT_COLUMNS") {
      return db
        .select(selectNoteColumns)
        .from(notes)
        .where(and(
          eq(notes.createdBy, userId),
          isNotNull(notes.trashedAt)
        ))
        .orderBy(desc(notes.trashedAt), desc(notes.updatedAt));
    }
    throw error;
  }
}

export async function archiveNote(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db
    .update(notes)
    .set({ archivedAt: new Date() })
    .where(and(eq(notes.id, id), isNull(notes.archivedAt), isNull(notes.trashedAt)));
}

export async function restoreArchivedNote(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db
    .update(notes)
    .set({ archivedAt: null })
    .where(and(eq(notes.id, id), isNotNull(notes.archivedAt), isNull(notes.trashedAt)));
}

export async function moveNoteToTrash(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db
    .update(notes)
    .set({ trashedAt: new Date() })
    .where(and(eq(notes.id, id), isNull(notes.trashedAt)));
}

export async function restoreNoteFromTrash(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db
    .update(notes)
    .set({ trashedAt: null })
    .where(and(eq(notes.id, id), isNotNull(notes.trashedAt)));
}

// ===== NOTE FILES QUERIES =====

export async function getNoteFilesByNoteId(noteId: number) {
  const db = await getDb();
  if (!db) return [];
  
  try {
    return await db
      .select()
      .from(noteFiles)
      .where(eq(noteFiles.noteId, noteId))
      .orderBy(desc(noteFiles.createdAt));
  } catch (error: any) {
    // Table might not exist yet if migration hasn't been run
    if (error?.message?.includes("doesn't exist") || error?.code === "ER_NO_SUCH_TABLE") {
      console.warn("note_files table does not exist yet. Run migrations to create it.");
      return [];
    }
    throw error;
  }
}

export async function getNoteFileCountsByNoteIds(
  noteIds: number[]
): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  if (noteIds.length === 0) return counts;

  const db = await getDb();
  if (!db) return counts;

  try {
    const rows = await db
      .select({
        noteId: noteFiles.noteId,
        count: sql<number>`count(*)`,
      })
      .from(noteFiles)
      .where(inArray(noteFiles.noteId, noteIds))
      .groupBy(noteFiles.noteId);

    rows.forEach((row) => {
      counts.set(Number(row.noteId), Number(row.count));
    });
  } catch (error: any) {
    if (error?.message?.includes("doesn't exist") || error?.code === "ER_NO_SUCH_TABLE") {
      return counts;
    }
    console.error("[Notes] Failed to load attachment counts:", error);
  }

  return counts;
}

export async function createNoteFile(data: InsertNoteFile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.insert(noteFiles).values(data);
}

export async function deleteNoteFile(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.delete(noteFiles).where(eq(noteFiles.id, id));
}

export async function getNoteFileById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(noteFiles).where(eq(noteFiles.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
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
  
  try {
    const result = await db.insert(projects).values(project);
    console.log("[Database] createProject raw result:", JSON.stringify(result, null, 2));
    console.log("[Database] createProject result type:", typeof result, Array.isArray(result));
    console.log("[Database] createProject result[0]:", result?.[0]);
    
    // MySQL2 returns result as [ResultSetHeader] where ResultSetHeader has insertId
    // But Drizzle might wrap it differently - check both structures
    let insertId: number | undefined;
    
    if (Array.isArray(result) && result[0]) {
      insertId = (result[0] as any)?.insertId;
    } else if (result && typeof result === 'object' && 'insertId' in result) {
      insertId = (result as any).insertId;
    } else if (result && typeof result === 'object' && '0' in result) {
      insertId = (result as any)[0]?.insertId;
    }
    
    console.log("[Database] createProject extracted insertId:", insertId);
    
    if (!insertId || insertId === 0) {
      console.error("[Database] createProject: No valid insertId returned", {
        result,
        resultType: typeof result,
        isArray: Array.isArray(result),
        resultKeys: result && typeof result === 'object' ? Object.keys(result) : 'N/A'
      });
      throw new Error("Failed to get insert ID from database");
    }
    
    console.log("[Database] createProject success, returning id:", insertId);
    return [{ id: insertId }];
  } catch (error) {
    console.error("[Database] createProject error:", error);
    if (error instanceof Error) {
      console.error("[Database] createProject error stack:", error.stack);
    }
    throw error;
  }
}

export async function getProjectById(projectId: number): Promise<ProjectWithClient | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
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
  
  return await db.update(projects).set(updates).where(eq(projects.id, projectId));
}

export async function deleteProject(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Note: ON DELETE CASCADE will automatically delete related project_jobs and file_metadata
  return await db.delete(projects).where(eq(projects.id, projectId));
}

export async function archiveProject(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

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
  
  try {
    const result = await db.insert(projectJobs).values(job);
    // MySQL2 returns result as [ResultSetHeader] where ResultSetHeader has insertId
    const insertId = (result as any)[0]?.insertId;
    if (!insertId) {
      console.error("[Database] createProjectJob: No insertId returned", result);
      throw new Error("Failed to get insert ID from database");
    }
    return [{ id: insertId }];
  } catch (error) {
    console.error("[Database] createProjectJob error:", error);
    throw error;
  }
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
    
    // Extract insertId from Drizzle result (similar to createExpense pattern)
    const insertId = Array.isArray(result) ? result[0]?.insertId : (result as any).insertId;
    if (!insertId) {
      throw new Error("Failed to create file metadata: no insert ID returned");
    }
    
    // Return in format expected by callers: [{ id: insertId }]
    return [{ id: Number(insertId) }];
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

function buildCompanyAddress(settings: {
  streetName?: string | null;
  streetNumber?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
}): string | null {
  const streetParts = [settings.streetName, settings.streetNumber].filter(Boolean);
  const cityParts = [settings.postalCode, settings.city].filter(Boolean);
  const addressParts = [streetParts.join(" "), cityParts.join(" "), settings.country].filter(Boolean);
  return addressParts.length ? addressParts.join("\n") : null;
}

export async function getCompanySettingsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(companySettings)
    .where(eq(companySettings.userId, userId))
    .limit(1);

  if (result.length === 0) return null;
  const settings = result[0];
  if (!settings.address) {
    const formattedAddress = buildCompanyAddress(settings);
    if (formattedAddress) {
      return { ...settings, address: formattedAddress };
    }
  }
  return settings;
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

/**
 * Atomically increment the invoice number for a user.
 * 
 * CRITICAL: This function MUST use an atomic database operation to prevent race conditions.
 * Under concurrent requests, multiple processes could read the same value, increment it,
 * and write back duplicates. By using UPDATE ... SET nextInvoiceNumber = nextInvoiceNumber + 1,
 * the database ensures the increment happens atomically at the DB level.
 */
export async function incrementInvoiceNumber(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Verify settings exist first
  const settings = await getCompanySettingsByUserId(userId);
  if (!settings) throw new Error("Company settings not found");
  
  // Atomic increment: UPDATE with SET column = column + 1 is atomic at the database level
  // This prevents race conditions where multiple concurrent requests could read the same
  // value and both increment it, resulting in duplicate invoice numbers.
  // The increment happens in a single atomic operation at the database level.
  await db.execute(
    sql`UPDATE company_settings SET nextInvoiceNumber = nextInvoiceNumber + 1 WHERE userId = ${userId}`
  );
  
  // Read back the updated value to return it
  // Note: Even if another request increments between our UPDATE and this SELECT,
  // the atomic UPDATE ensures no duplicates. This SELECT just retrieves the current value.
  const updated = await getCompanySettingsByUserId(userId);
  if (!updated) throw new Error("Company settings not found after update");
  
  return updated.nextInvoiceNumber;
}

// =============================================================================
// USER PREFERENCES FUNCTIONS
// =============================================================================

export async function getUserPreferencesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    let result = await db.select().from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    // If not exists, create with defaults (German/EU defaults)
    if (result.length === 0) {
      await db.insert(userPreferences).values({
        userId,
        dateFormat: "DD.MM.YYYY",
        timeFormat: "24h",
        timezone: "Europe/Berlin",
        language: "en",
        currency: "EUR",
        notificationsEnabled: true,
      });

      result = await db.select().from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);
    }

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    // Table might not exist yet - return null and let the UI handle it
    console.warn("[Database] user_preferences table may not exist yet:", error);
    return null;
  }
}

export async function createUserPreferences(data: InsertUserPreferences) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(userPreferences).values(data);
}

export async function updateUserPreferences(userId: number, data: Partial<InsertUserPreferences>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const defaults = {
    dateFormat: "DD.MM.YYYY",
    timeFormat: "24h",
    timezone: "Europe/Berlin",
    language: "en",
    currency: "EUR",
    notificationsEnabled: true,
  };

  const normalizeString = (value: string | undefined) => {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  };

  const normalizedInput: Partial<InsertUserPreferences> = {
    dateFormat: normalizeString(data.dateFormat),
    timeFormat: data.timeFormat,
    timezone: normalizeString(data.timezone),
    language: normalizeString(data.language),
    currency: normalizeString(data.currency),
    notificationsEnabled: data.notificationsEnabled,
  };

  const existing = await getUserPreferencesByUserId(userId);
  const base = existing ?? defaults;
  const updated: InsertUserPreferences = {
    userId,
    dateFormat: (normalizedInput.dateFormat as string | undefined) ?? base.dateFormat ?? defaults.dateFormat,
    timeFormat: (normalizedInput.timeFormat as string | undefined) ?? base.timeFormat ?? defaults.timeFormat,
    timezone: (normalizedInput.timezone as string | undefined) ?? base.timezone ?? defaults.timezone,
    language: (normalizedInput.language as string | undefined) ?? base.language ?? defaults.language,
    currency: (normalizedInput.currency as string | undefined) ?? base.currency ?? defaults.currency,
    notificationsEnabled: normalizedInput.notificationsEnabled ?? base.notificationsEnabled ?? defaults.notificationsEnabled,
  };

  if (!existing) {
    return await db.insert(userPreferences).values(updated);
  }

  return await db.update(userPreferences)
    .set(updated)
    .where(eq(userPreferences.userId, userId));
}

// =============================================================================
// LOGO FUNCTIONS
// =============================================================================

export async function uploadCompanyLogo(userId: number, s3Key: string, url: string, width: number, height: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(companySettings)
    .set({
      logoS3Key: s3Key,
      logoUrl: url,
      logoWidth: width,
      logoHeight: height,
    })
    .where(eq(companySettings.userId, userId));
}

export async function deleteCompanyLogo(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(companySettings)
    .set({
      logoS3Key: null,
      logoUrl: null,
      logoWidth: null,
      logoHeight: null,
    })
    .where(eq(companySettings.userId, userId));
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

// =============================================================================
// INSPECTION MODULE FUNCTIONS
// =============================================================================

// Inspection Templates
export async function getAllInspectionTemplates() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(inspectionTemplates).orderBy(desc(inspectionTemplates.createdAt));
}

export async function getInspectionTemplateById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(inspectionTemplates).where(eq(inspectionTemplates.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createInspectionTemplate(data: InsertInspectionTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(inspectionTemplates).values(data);
}

export async function updateInspectionTemplate(id: number, data: Partial<InsertInspectionTemplate>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(inspectionTemplates).set(data).where(eq(inspectionTemplates.id, id));
}

export async function deleteInspectionTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.delete(inspectionTemplates).where(eq(inspectionTemplates.id, id));
}

// Inspections
export async function getInspectionsByProjectId(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(inspections)
    .where(eq(inspections.projectId, projectId))
    .orderBy(desc(inspections.createdAt));
}

export async function getInspectionById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(inspections).where(eq(inspections.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createInspection(data: InsertInspection) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(inspections).values(data);
}

export async function updateInspection(id: number, data: Partial<InsertInspection>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(inspections).set(data).where(eq(inspections.id, id));
}

export async function deleteInspection(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.delete(inspections).where(eq(inspections.id, id));
}

// Inspection Units
export async function getInspectionUnitsByInspectionId(inspectionId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(inspectionUnits)
    .where(eq(inspectionUnits.inspectionId, inspectionId))
    .orderBy(inspectionUnits.sequenceIndex);
}

export async function getInspectionUnitById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(inspectionUnits).where(eq(inspectionUnits.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getNextSequenceIndexForInspection(inspectionId: number) {
  const db = await getDb();
  if (!db) return 1;
  const result = await db.select({ max: sql<number>`MAX(${inspectionUnits.sequenceIndex})` })
    .from(inspectionUnits)
    .where(eq(inspectionUnits.inspectionId, inspectionId));
  const maxIndex = result[0]?.max ?? 0;
  return maxIndex + 1;
}

export async function createInspectionUnit(data: InsertInspectionUnit) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(inspectionUnits).values(data);
}

export async function updateInspectionUnit(id: number, data: Partial<InsertInspectionUnit>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(inspectionUnits).set(data).where(eq(inspectionUnits.id, id));
}

export async function deleteInspectionUnit(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.delete(inspectionUnits).where(eq(inspectionUnits.id, id));
}

// Inspection Findings
export async function getInspectionFindingsByUnitId(unitId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(inspectionFindings)
    .where(eq(inspectionFindings.inspectionUnitId, unitId))
    .orderBy(inspectionFindings.createdAt); // Ascending order for PDF (oldest first)
}

export async function getInspectionFindingById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(inspectionFindings).where(eq(inspectionFindings.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createInspectionFinding(data: InsertInspectionFinding) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(inspectionFindings).values(data);
}

export async function updateInspectionFinding(id: number, data: Partial<InsertInspectionFinding>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(inspectionFindings).set(data).where(eq(inspectionFindings.id, id));
}

export async function deleteInspectionFinding(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.delete(inspectionFindings).where(eq(inspectionFindings.id, id));
}

// Inspection Media
export async function getInspectionMediaByFindingId(findingId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(inspectionMedia)
    .where(eq(inspectionMedia.inspectionFindingId, findingId))
    .orderBy(desc(inspectionMedia.takenAt));
}

export async function getInspectionMediaById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(inspectionMedia).where(eq(inspectionMedia.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createInspectionMedia(data: InsertInspectionMedia) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(inspectionMedia).values(data);
}

export async function updateInspectionMedia(id: number, data: Partial<InsertInspectionMedia>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(inspectionMedia).set(data).where(eq(inspectionMedia.id, id));
}

export async function deleteInspectionMedia(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.delete(inspectionMedia).where(eq(inspectionMedia.id, id));
}
