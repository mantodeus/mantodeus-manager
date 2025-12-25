Master Execution Plan

Role: Senior full-stack engineer executing a production SaaS roadmap Mode: Deterministic, incremental, migration-safe Stack: Node.js, tRPC, Drizzle ORM, MariaDB, React 19, Vite, Tailwind, S3-compatible storage

GLOBAL RULES (MANDATORY)

Claude must follow these rules at all times:

1. No feature expansion
Build only what is explicitly specified
Do not add "nice to have" features
Do not refactor unrelated code
2. One phase at a time
Do not touch future phases
Complete and verify before moving to next phase
Ship usable states, not placeholders
3. Backend first, frontend second
DB schema → DB functions → routers → UI
Test each layer before proceeding
4. Migrations must be reversible
No destructive schema changes without fallback
Test on development database first
Always backup before migration
5. Follow existing project patterns
Match folder structure, naming, and coding style exactly
Reuse existing utilities where possible
Use established component patterns (ItemActionsMenu, AlertDialog, etc.)
6. Server-side enforcement
Never rely on UI guards alone
All business rules enforced in backend router
Validate permissions, status, and ownership
PHASE EXECUTION ORDER (LOCKED)

Phase 0: Invoice Archive/Bin (Foundation) Phase 1: Settings (Logo + Preferences) Phase 2: Comments Phase 3: Reports (Lite) Phase 4: PDF System Enhancements Phase 5: User Management Phase 6: Time Tracking

Claude must finish and verify one phase before starting the next.

PHASE 0 — INVOICE ARCHIVE/BIN (FOUNDATION)
Objective

Implement safe, compliant invoice lifecycle following archive/bin patterns used by Projects, Contacts, and Notes modules.

Core Rules (Non-Negotiable)
✅ Sent and paid invoices MAY be archived
❌ Sent and paid invoices CANNOT be deleted
✅ Draft invoices MAY be deleted (via Rubbish bin)
⚠️ Sent/paid invoices MAY be reverted (with strong warning), then deletion becomes allowed
🔐 Backend MUST enforce all rules (UI alone is not enough)
Tasks (IN ORDER)
1. Database Schema

File: drizzle/schema.ts

Update invoices table:

archivedAt: timestamp("archivedAt"),
trashedAt: timestamp("trashedAt"),

DO NOT use a visibility enum. Follow existing pattern from projects, contacts, notes tables.

Visibility logic (computed, not stored):

archivedAt === null && trashedAt === null → 'active'
archivedAt !== null && trashedAt === null → 'archived'
trashedAt !== null → 'trashed' (regardless of archivedAt)

Status remains separate:

status: 'draft' | 'sent' | 'paid' (unchanged)

Create migration file in drizzle/migrations/:

Add archivedAt and trashedAt timestamp columns
Add indexes: invoices_archivedAt_idx, invoices_trashedAt_idx
Follow pattern from 0011_invoice_overhaul.sql
2. Backend Database Layer

File: server/db.ts

Add functions:

// List queries (update existing)
export async function getInvoicesByUserId(userId: number) {
  // Filter: WHERE archivedAt IS NULL AND trashedAt IS NULL
}

export async function getArchivedInvoicesByUserId(userId: number) {
  // WHERE archivedAt IS NOT NULL AND trashedAt IS NULL
}

export async function getTrashedInvoicesByUserId(userId: number) {
  // WHERE trashedAt IS NOT NULL
}

// Archive/trash operations
export async function archiveInvoice(id: number) {
  // SET archivedAt = NOW(), trashedAt = NULL
}

export async function moveInvoiceToTrash(id: number) {
  // SET trashedAt = NOW()
}

export async function restoreInvoice(id: number) {
  // SET archivedAt = NULL, trashedAt = NULL
}

export async function revertInvoiceStatus(id: number, targetStatus: 'draft' | 'sent') {
  // Update status field
  // Clear sent/paid timestamps if present
}
3. Backend Router

File: server/invoiceRouter.ts

Update existing list query:

list: protectedProcedure.query(async ({ ctx }) => {
  // Show only active invoices
  // WHERE archivedAt IS NULL AND trashedAt IS NULL
}),

Add new list queries:

listArchived: protectedProcedure.query(async ({ ctx }) => {
  return await db.getArchivedInvoicesByUserId(ctx.user.id);
}),

listTrashed: protectedProcedure.query(async ({ ctx }) => {
  return await db.getTrashedInvoicesByUserId(ctx.user.id);
}),

Replace/modify hard delete:

delete: protectedProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ input, ctx }) => {
    const invoice = await db.getInvoiceById(input.id);

    if (!invoice) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    if (invoice.userId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    // CRITICAL: Only allow deletion of draft invoices in trash
    if (invoice.status !== 'draft') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only draft invoices can be permanently deleted.',
      });
    }

    if (!invoice.trashedAt) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Invoices must be moved to Rubbish bin before permanent deletion.',
      });
    }

    await db.deleteInvoice(input.id);
    return { success: true };
  }),

Add new mutations:

archive: protectedProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ input, ctx }) => {
    // Allowed for all statuses
    // Sets archivedAt = now, trashedAt = null
    const invoice = await db.getInvoiceById(input.id);

    if (!invoice || invoice.userId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    await db.archiveInvoice(input.id);
    return { success: true };
  }),

moveToTrash: protectedProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ input, ctx }) => {
    const invoice = await db.getInvoiceById(input.id);

    if (!invoice || invoice.userId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    // Only drafts can be trashed
    if (invoice.status !== 'draft') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only draft invoices can be moved to Rubbish bin.',
      });
    }

    await db.moveInvoiceToTrash(input.id);
    return { success: true };
  }),

restore: protectedProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ input, ctx }) => {
    const invoice = await db.getInvoiceById(input.id);

    if (!invoice || invoice.userId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    await db.restoreInvoice(input.id);
    return { success: true };
  }),

revertStatus: protectedProcedure
  .input(z.object({
    id: z.number(),
    targetStatus: z.enum(['draft', 'sent']),
    confirmed: z.boolean(),
  }))
  .mutation(async ({ input, ctx }) => {
    if (!input.confirmed) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Status reversion requires explicit confirmation.',
      });
    }

    const invoice = await db.getInvoiceById(input.id);

    if (!invoice || invoice.userId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    // Validate transitions: sent→draft, paid→sent only
    const validTransitions = {
      sent: ['draft'],
      paid: ['sent'],
    };

    if (!validTransitions[invoice.status]?.includes(input.targetStatus)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid status transition.',
      });
    }

    await db.revertInvoiceStatus(input.id, input.targetStatus);
    return { success: true };
  }),
4. Frontend Pages

Create: client/src/pages/InvoicesArchived.tsx

Follow pattern from ProjectsArchived.tsx / ContactsArchived.tsx:

List archived invoices (fetched via invoices.listArchived)
Show invoice number, client, amount, status, archived date
Actions menu:
Restore (always available)
Move to Rubbish (only if status === 'draft')
Duplicate (toast: "Coming soon")
Empty state: "No archived invoices"
Navigation link back to active invoices

Create: client/src/pages/InvoicesRubbish.tsx

Follow pattern from ProjectsRubbish.tsx / ContactsRubbish.tsx:

List trashed invoices (fetched via invoices.listTrashed)
Show invoice number, client, amount, status, trashed date
Actions menu:
Restore (always available)
Delete Permanently (only if status === 'draft')
Permanent delete requires AlertDialog confirmation:
Variant: destructive
Title: "Delete invoice permanently?"
Message: "This action cannot be undone. This invoice will be permanently deleted."
Empty state: "Rubbish bin is empty"

Update: client/src/pages/Invoices.tsx

Update to show only active invoices:

Change query from invoices.list (already filters active)
Add navigation links to header:
"Archived" → /invoices/archived
"Rubbish" → /invoices/rubbish

Update action menu (status-based):

Draft invoices:

Edit
Duplicate (toast only)
Archive
Move to Rubbish bin
Delete permanently (not available for active)

Sent invoices:

View
Archive
Mark as not sent (opens warning modal)
Duplicate (toast only)
Move to Rubbish bin (not available)
Delete (not available)

Paid invoices:

View
Archive
Mark as not paid (opens warning modal)
Duplicate (toast only)
Move to Rubbish bin (not available)
Delete (not available)
5. Frontend Components

Create: client/src/components/RevertInvoiceStatusDialog.tsx

Warning modal using shadcn AlertDialog:

For Sent → Draft:

Title: "Revert invoice to draft?"
Message: "This invoice has already been sent. Reverting it may affect records and client communication. Only do this if the invoice was sent in error."

For Paid → Sent:

Title: "Mark invoice as not paid?"
Message: "This invoice is marked as paid. Reverting it may affect accounting records. Only proceed if payment was recorded incorrectly."

UI:

Checkbox: "I understand the consequences" (required)
Cancel button
Confirm button (destructive variant, disabled until checkbox checked)

On confirm:

Call invoices.revertStatus mutation with confirmed: true
Show success toast
After revert: Delete/Rubbish bin actions become available (if now draft)
6. Routing

File: client/src/App.tsx (or wherever routes are defined)

Add routes:

<Route path="/invoices/archived" component={InvoicesArchived} />
<Route path="/invoices/rubbish" component={InvoicesRubbish} />
Verification Checklist
Draft → Move to Rubbish → Delete permanently (works)
Sent → Cannot delete → Archive works
Paid → Cannot delete → Archive works
Sent → Revert to draft → Delete becomes available
Paid → Revert to sent → Revert to draft → Delete available
Backend blocks invalid transitions even if UI bypassed (test via API)
Archived invoices appear in Archived view
Trashed invoices appear in Rubbish view
Restore works from both Archived and Rubbish views
Mobile-friendly (touch targets, responsive layout)
Migration Notes
Use the same archive/bin UI patterns from Projects/Contacts/Notes
Do NOT silently delete sent/paid invoices
All copy mentions "accounting reasons" where relevant
Use "Rubbish bin" terminology (not "trash")
Duplicate remains placeholder (toast only)
PHASE 1 — SETTINGS (LOGO + PREFERENCES)
Objective

Enable company logo upload (used in PDFs) and user preference management (date/time formats, locale).

Tasks (IN ORDER)
1. Database Schema

File: drizzle/schema.ts

Update companySettings table:

logoS3Key: varchar("logoS3Key", { length: 500 }),
logoUrl: text("logoUrl"),
logoWidth: int("logoWidth"),
logoHeight: int("logoHeight"),

Create userPreferences table:

export const userPreferences = mysqlTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: int("userId").notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  dateFormat: varchar("dateFormat", { length: 20 }).default('MM/DD/YYYY').notNull(),
  timeFormat: varchar("timeFormat", { length: 10 }).default('12h').notNull(),
  timezone: varchar("timezone", { length: 50 }).default('UTC').notNull(),
  language: varchar("language", { length: 10 }).default('en').notNull(),
  currency: varchar("currency", { length: 3 }).default('EUR').notNull(),
  notificationsEnabled: boolean("notificationsEnabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("user_preferences_userId_idx").on(table.userId),
}));
2. Backend Database Layer

File: server/db.ts

Add functions:

export async function getUserPreferencesByUserId(userId: number) {
  // SELECT * FROM user_preferences WHERE userId = ?
  // If not exists, create with defaults
}

export async function createUserPreferences(userId: number, data: Partial<UserPreferences>) {
  // INSERT INTO user_preferences
}

export async function updateUserPreferences(userId: number, data: Partial<UserPreferences>) {
  // UPDATE user_preferences WHERE userId = ?
}

export async function uploadCompanyLogo(userId: number, s3Key: string, url: string, width: number, height: number) {
  // UPDATE company_settings SET logoS3Key, logoUrl, logoWidth, logoHeight
}

export async function deleteCompanyLogo(userId: number) {
  // UPDATE company_settings SET logoS3Key = NULL, logoUrl = NULL, logoWidth = NULL, logoHeight = NULL
  // Also delete from S3
}
3. Backend Router

File: server/settingsRouter.ts

Add nested preferences router:

preferences: router({
  get: protectedProcedure.query(async ({ ctx }) => {
    return await db.getUserPreferencesByUserId(ctx.user.id);
  }),

  update: protectedProcedure
    .input(z.object({
      dateFormat: z.string().optional(),
      timeFormat: z.enum(['12h', '24h']).optional(),
      timezone: z.string().optional(),
      language: z.string().optional(),
      currency: z.string().optional(),
      notificationsEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await db.updateUserPreferences(ctx.user.id, input);
      return { success: true };
    }),
}),

Add logo procedures to main settings router:

uploadLogo: protectedProcedure
  .input(z.object({
    base64Image: z.string(),
    filename: z.string(),
  }))
  .mutation(async ({ input, ctx }) => {
    // 1. Validate file type and size
    // 2. Resize with Sharp to max 800x200px
    // 3. Upload to S3: uploads/logos/{userId}/{timestamp}.png
    // 4. Store s3Key + URL in company_settings
    // 5. Return logoUrl
  }),

deleteLogo: protectedProcedure
  .mutation(async ({ input, ctx }) => {
    // 1. Get current logo S3 key
    // 2. Delete from S3
    // 3. Clear logo fields in company_settings
  }),

Constraints:

Max file size: 5MB
Allowed types: PNG, JPG, SVG
Resize server-side with Sharp
Store S3 key + URL only (not base64)
4. Frontend Pages

Update: client/src/pages/Settings.tsx

Add three new sections after existing cards:

Section 1: Logo Upload

<Card>
  <CardHeader>
    <CardTitle>Company Logo</CardTitle>
    <CardDescription>
      Logo appears on invoices and reports (max 800x200px)
    </CardDescription>
  </CardHeader>
  <CardContent>
    <LogoUploadSection />
  </CardContent>
</Card>

Section 2: User Preferences

<Card>
  <CardHeader>
    <CardTitle>User Preferences</CardTitle>
  </CardHeader>
  <CardContent>
    <Form>
      <FormField name="dateFormat">
        <Select>
          <option>MM/DD/YYYY</option>
          <option>DD/MM/YYYY</option>
          <option>YYYY-MM-DD</option>
        </Select>
      </FormField>

      <FormField name="timeFormat">
        <RadioGroup>
          <Radio value="12h">12-hour</Radio>
          <Radio value="24h">24-hour</Radio>
        </RadioGroup>
      </FormField>

      <FormField name="timezone">
        <Select>
          <option>Europe/Berlin</option>
          <option>UTC</option>
          {/* Major timezones */}
        </Select>
      </FormField>

      <FormField name="language">
        <Select>
          <option value="en">English</option>
          <option value="de">Deutsch</option>
        </Select>
      </FormField>

      <FormField name="currency">
        <Select>
          <option>EUR</option>
          <option>USD</option>
          <option>GBP</option>
        </Select>
      </FormField>

      <FormField name="notificationsEnabled">
        <Switch />
      </FormField>

      <Button type="submit">Save Preferences</Button>
    </Form>
  </CardContent>
</Card>
5. Frontend Components

Create: client/src/components/LogoUploadSection.tsx

Features:

Image preview (current logo or placeholder)
Drag-and-drop zone
File input button (accepts PNG/JPG/SVG, max 5MB)
Client-side compression via browser-image-compression
Upload progress indicator
Delete logo button (if logo exists)
Validation errors displayed clearly

Critical Pattern: Follow existing image upload flow:

User selects file
Compress client-side (browser-image-compression)
Convert to base64
Send to backend via tRPC settings.uploadLogo
Backend processes with Sharp (resize to max 800x200px)
Upload to S3 with presigned URL
Store S3 key + URL in database
Return URL to frontend
Update preview immediately
Verification Checklist
Upload logo → Refresh page → Logo persists
Delete logo → Logo removed from preview
Logo file too large → Error message shown
Invalid file type → Error message shown
Preferences saved → Refresh page → Preferences persist
No PDF changes yet (that's Phase 4)
PHASE 2 — COMMENTS (CROSS-MODULE)
Objective

Enable threaded comments on Projects and Jobs.

Tasks (IN ORDER)
1. Database Schema

File: drizzle/schema.ts

Update comments table:

projectId: int("projectId").references(() => projects.id, { onDelete: 'cascade' }),
parentCommentId: int("parentCommentId").references(() => comments.id, { onDelete: 'cascade' }),
editedAt: timestamp("editedAt"),
isDeleted: boolean("isDeleted").default(false).notNull(),

Add indexes:

projectIdIdx: index("comments_projectId_idx").on(table.projectId),
parentCommentIdIdx: index("comments_parentCommentId_idx").on(table.parentCommentId),
2. Backend Database Layer

File: server/db.ts

Add functions:

export async function getCommentsByProjectId(projectId: number) {
  // SELECT * FROM comments WHERE projectId = ? AND isDeleted = false
  // ORDER BY createdAt DESC
}

export async function getCommentReplies(parentCommentId: number) {
  // SELECT * FROM comments WHERE parentCommentId = ? AND isDeleted = false
  // ORDER BY createdAt ASC
}

export async function updateComment(id: number, content: string) {
  // UPDATE comments SET content = ?, editedAt = NOW() WHERE id = ?
}

export async function softDeleteComment(id: number) {
  // UPDATE comments SET isDeleted = true WHERE id = ?
}
3. Backend Router

File: server/routers.ts

Enhance comments router:

comments: router({
  // Existing:
  listByJob, listByTask, create, delete,

  // New:
  listByProject: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input, ctx }) => {
      return await db.getCommentsByProjectId(input.projectId);
    }),

  listReplies: protectedProcedure
    .input(z.object({ parentCommentId: z.number() }))
    .query(async ({ input, ctx }) => {
      return await db.getCommentReplies(input.parentCommentId);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      content: z.string().max(2000),
    }))
    .mutation(async ({ input, ctx }) => {
      const comment = await db.getCommentById(input.id);

      if (!comment || comment.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db.updateComment(input.id, input.content);
      return { success: true };
    }),

  softDelete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const comment = await db.getCommentById(input.id);

      if (!comment || comment.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db.softDeleteComment(input.id);
      return { success: true };
    }),
}),

Rules:

Soft delete only (set isDeleted = true)
Preserve thread integrity (deleted parent shows "[deleted]", replies remain)
Only comment author can edit/delete
4. Frontend Components

Create: client/src/components/CommentsSection.tsx

interface Props {
  entityType: 'project' | 'job' | 'task'
  entityId: number
  allowReplies?: boolean // default: true
}

Features:

Fetch comments based on entityType (project, job, task)
Display comments list (newest first)
Threaded replies (indented, collapse/expand)
Comment input at top
Optimistic updates via TanStack Query
Auto-refresh every 30s when component visible (useInterval + isVisible)

Create: client/src/components/CommentCard.tsx

Single comment display:

User avatar (initials fallback)
User name
Timestamp (relative: "2 hours ago" using date-fns or similar)
Comment text
"edited" badge (if editedAt exists)
Action menu (3-dot):
Edit (own comments only)
Delete (own comments only)
Reply (if allowReplies)
Nested replies (recursive rendering of <CommentCard />)
Collapse/expand button (if has replies)

If isDeleted === true:

Show "[deleted]" placeholder (gray text)
Preserve replies (still rendered)
Hide action menu

Create: client/src/components/CommentInput.tsx

Comment input form:

Textarea with auto-resize (use autosize library or custom hook)
Placeholder: "Add a comment..."
Character count: "X / 2000" (max 2000 chars)
Submit button (disabled if empty or over limit)
Loading state during submission
Clear textarea on successful submit
5. Integration Points

Update: client/src/pages/ProjectDetail.tsx

Add "Comments" tab after "Jobs" tab:

<Tabs defaultValue="jobs">
  <TabsList>
    <TabsTrigger value="jobs">Jobs</TabsTrigger>
    <TabsTrigger value="comments">Comments</TabsTrigger>
  </TabsList>

  <TabsContent value="jobs">
    {/* Existing jobs list */}
  </TabsContent>

  <TabsContent value="comments">
    <CommentsSection entityType="project" entityId={projectId} />
  </TabsContent>
</Tabs>

Update: client/src/pages/ProjectJobDetail.tsx

Add comments section at bottom of page:

{/* Existing job details */}

<div className="mt-8">
  <h2 className="text-xl font-semibold mb-4">Comments</h2>
  <CommentsSection entityType="job" entityId={jobId} />
</div>
Verification Checklist
Post comment → Appears immediately (optimistic)
Reply to comment → Nested correctly
Edit own comment → Shows "edited" badge
Delete own comment → Shows "[deleted]" if has replies
Delete own comment → Removed completely if no replies
Cannot edit/delete others' comments
Mobile-friendly input and layout
Auto-refresh works (test by posting from another tab)
PHASE 3 — REPORTS (LITE VERSION)
Objective

Allow users to create and generate structured reports.

HARD CONSTRAINTS

🚫 No template editor UI 🚫 No drag-and-drop 🚫 No rich text editor

Use simple textarea for MVP. Upgrade later if needed.

Tasks (IN ORDER)
1. Database Schema

File: drizzle/schema.ts

Update reports table:

projectId: int("projectId").references(() => projects.id, { onDelete: 'cascade' }),
templateId: int("templateId").references(() => reportTemplates.id, { onDelete: 'set null' }),
settings: json("settings"), // Custom report settings (sections, filters)
generatedPdfKey: varchar("generatedPdfKey", { length: 500 }),
generatedAt: timestamp("generatedAt"),
status: varchar("status", { length: 20 }).default('draft').notNull(), // draft, generated, sent

Create report_templates table:

export const reportTemplates = mysqlTable("report_templates", {
  id: serial("id").primaryKey(),
  userId: int("userId").references(() => users.id, { onDelete: 'cascade' }), // NULL = global
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  templateType: varchar("templateType", { length: 50 }).notNull(), // daily, weekly, project_summary, custom
  sections: json("sections").notNull(), // Array of section configs
  isPublic: boolean("isPublic").default(false).notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

Seed 3 default templates:

// Migration seed or separate seed script
const defaultTemplates = [
  {
    name: "Daily Report",
    templateType: "daily",
    sections: ["overview", "jobs", "photos", "notes"],
    isPublic: true,
    isDefault: true,
  },
  {
    name: "Weekly Summary",
    templateType: "weekly",
    sections: ["overview", "jobs", "timeTracking", "photos"],
    isPublic: true,
    isDefault: false,
  },
  {
    name: "Project Summary",
    templateType: "project_summary",
    sections: ["overview", "jobs", "photos", "comments", "costs"],
    isPublic: true,
    isDefault: false,
  },
];
2. Backend Database Layer

File: server/db.ts

Add functions:

export async function getAllReportsByUser(userId: number) {
  // SELECT * FROM reports WHERE userId = ? ORDER BY createdAt DESC
}

export async function getReportsByProjectId(projectId: number) {
  // SELECT * FROM reports WHERE projectId = ? ORDER BY createdAt DESC
}

export async function getReportById(id: number) {
  // SELECT * FROM reports WHERE id = ?
  // Include template details if templateId exists
}

export async function createReport(data: InsertReport) {
  // INSERT INTO reports
}

export async function updateReport(id: number, data: Partial<Report>) {
  // UPDATE reports WHERE id = ?
}

export async function generateReportPdf(reportId: number) {
  // 1. Call PDF service with report data
  // 2. Upload PDF to S3
  // 3. Update report: generatedPdfKey, generatedAt, status = 'generated'
}

export async function duplicateReport(id: number) {
  // 1. Get original report
  // 2. Create new report with same data (new title: "Copy of X")
}

// Template functions
export async function getAllReportTemplates(userId: number) {
  // Get global templates (userId IS NULL) + user's templates
}

export async function getReportTemplateById(id: number) {
  // SELECT * FROM report_templates WHERE id = ?
}
3. Backend Router

Create: server/reportsRouter.ts

Extract from main router and add new procedures:

export const reportsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return await db.getAllReportsByUser(ctx.user.id);
  }),

  listByProject: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input, ctx }) => {
      return await db.getReportsByProjectId(input.projectId);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const report = await db.getReportById(input.id);

      if (!report || report.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return report;
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      jobId: z.number().optional(),
      templateId: z.number().optional(),
      title: z.string(),
      content: z.string().optional(),
      settings: z.any().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const report = await db.createReport({
        ...input,
        userId: ctx.user.id,
        status: 'draft',
      });
      return report;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      content: z.string().optional(),
      settings: z.any().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const report = await db.getReportById(input.id);

      if (!report || report.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db.updateReport(input.id, input);
      return { success: true };
    }),

  generate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const report = await db.getReportById(input.id);

      if (!report || report.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db.generateReportPdf(input.id);
      return { success: true };
    }),

  duplicate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const report = await db.getReportById(input.id);

      if (!report || report.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const newReport = await db.duplicateReport(input.id);
      return newReport;
    }),

  // Nested templates router
  templates: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getAllReportTemplates(ctx.user.id);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getReportTemplateById(input.id);
      }),
  }),
});

Note: Template creation/editing skipped for lite version. Read-only templates for now.

4. Frontend Pages

Replace: client/src/pages/Reports.tsx

Complete reports management page:

Header:

Title: "Reports"
"New Report" button (opens CreateReportDialog)
Navigation links: "All Reports" | "Drafts" | "Generated"

Tabs:

<Tabs defaultValue="all">
  <TabsList>
    <TabsTrigger value="all">All Reports</TabsTrigger>
    <TabsTrigger value="drafts">Drafts</TabsTrigger>
    <TabsTrigger value="generated">Generated</TabsTrigger>
  </TabsList>

  <TabsContent value="all">
    {/* Show all reports */}
  </TabsContent>

  <TabsContent value="drafts">
    {/* Filter: status === 'draft' */}
  </TabsContent>

  <TabsContent value="generated">
    {/* Filter: status === 'generated' or 'sent' */}
  </TabsContent>
</Tabs>

Report cards:

Title
Project name (link to project)
Status badge (draft/generated/sent)
Generated date (if generated)
Action menu:
Edit (if draft)
Generate PDF
Duplicate
Delete

Empty state:

Icon + message: "No reports yet"
"Create your first report" button
5. Frontend Components

Create: client/src/components/CreateReportDialog.tsx

Multi-step wizard (use state machine or step counter):

Step 1: Select Template

Template cards (grid layout):
Daily Report
Weekly Summary
Project Summary
Custom (placeholder for now)
Show template description
"Next" button

Step 2: Select Scope

Project: Select dropdown (required)
Job: Select dropdown (optional, filtered by selected project)
Date Range: DateRangePicker (for time-based reports)
"Back" and "Next" buttons

Step 3: Configure Sections

Section checklist (based on selected template):
☐ Project Overview
☐ Job List with Progress
☐ Photo Gallery
Tag filters: Safety, Defect, Anchor, Quote, Before, After
☐ Comments & Notes
☐ Time Tracking Summary
Each section has settings icon (opens popover with filters)
"Back" and "Next" buttons

Step 4: Review & Create

Preview report structure (simple list of enabled sections)
Title: Editable input
Default: "[Project Name] - [Template Type] - [Date]"
Action buttons:
"Back"
"Save as Draft"
"Generate PDF Now" (saves + generates in one step)

Create: client/src/components/EditReportDialog.tsx

Simple editor (full-screen dialog or modal):

Header:

Title: Editable input
Close button

Body:

Content: Large textarea (no rich text editor for MVP)
Placeholder: "Enter report content..."
Auto-resize
Character count (optional)

Footer:

"Cancel" button (discard changes, show confirm dialog if dirty)
"Save Draft" button
"Generate PDF" button

Note: Skip drag-and-drop sections, preview panel, and template editor for lite version.

Verification Checklist
Create report → Appears in list
Edit report → Changes saved
Generate PDF → PDF created (tested in Phase 4)
Duplicate report → New report created with "Copy of" prefix
Delete report → Removed from list
Template selection works
Section configuration persists in settings JSON
Status badges display correctly
PHASE 4 — PDF SYSTEM ENHANCEMENTS
Objective

Add logo to PDFs, batch generation, and preview functionality.

Tasks (IN ORDER)
1. Database Schema

File: drizzle/schema.ts

Create generated_pdfs table:

export const generatedPdfs = mysqlTable("generated_pdfs", {
  id: serial("id").primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: 'cascade' }),
  documentType: varchar("documentType", { length: 50 }).notNull(), // project_report, invoice, custom
  referenceId: int("referenceId"), // Link to project, invoice, etc.
  s3Key: varchar("s3Key", { length: 500 }).notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  fileSize: int("fileSize"),
  shareToken: varchar("shareToken", { length: 64 }).unique(),
  shareExpiresAt: timestamp("shareExpiresAt"),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  metadata: json("metadata"), // Generation params
}, (table) => ({
  userIdIdx: index("generated_pdfs_userId_idx").on(table.userId),
  documentTypeIdx: index("generated_pdfs_documentType_idx").on(table.documentType),
  shareTokenIdx: index("generated_pdfs_shareToken_idx").on(table.shareToken),
}));
2. Backend Database Layer

File: server/db.ts

Add functions:

export async function getGeneratedPdfsByUserId(userId: number) {
  // SELECT * FROM generated_pdfs WHERE userId = ? ORDER BY generatedAt DESC
}

export async function createGeneratedPdf(data: InsertGeneratedPdf) {
  // INSERT INTO generated_pdfs
}

export async function deleteGeneratedPdf(id: number) {
  // 1. Get S3 key
  // 2. Delete from S3
  // 3. DELETE FROM generated_pdfs WHERE id = ?
}
3. Backend Router

Update: server/pdfRouter.ts

Add new procedures:

generateBatch: protectedProcedure
  .input(z.object({
    projectIds: z.array(z.number()),
    template: z.string().optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    const results = [];

    for (const projectId of input.projectIds) {
      // Generate PDF for each project
      const pdf = await generateProjectReportPdf(projectId, input.template);
      results.push({
        projectId,
        s3Key: pdf.s3Key,
        shareUrl: pdf.shareUrl,
      });
    }

    return { jobs: results };
  }),

preview: protectedProcedure
  .input(z.object({
    type: z.enum(['project_report', 'invoice', 'custom']),
    referenceId: z.number(),
    template: z.string().optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    // 1. Generate HTML from template
    // 2. Convert to low-res PNG using wkhtmltoimage (or screenshot via Puppeteer)
    // 3. Return base64 image (do NOT save to S3)

    const base64Image = await generatePreviewImage(input);
    return { base64Image };
  }),

listGenerated: protectedProcedure.query(async ({ ctx }) => {
  return await db.getGeneratedPdfsByUserId(ctx.user.id);
}),

regenerate: protectedProcedure
  .input(z.object({ pdfId: z.number() }))
  .mutation(async ({ input, ctx }) => {
    const pdf = await db.getGeneratedPdfById(input.pdfId);

    if (!pdf || pdf.userId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    // 1. Delete old PDF from S3
    // 2. Regenerate PDF with updated data
    // 3. Update generated_pdfs record

    const newPdf = await regeneratePdf(pdf);
    return newPdf;
  }),

deleteGenerated: protectedProcedure
  .input(z.object({ pdfId: z.number() }))
  .mutation(async ({ input, ctx }) => {
    const pdf = await db.getGeneratedPdfById(input.pdfId);

    if (!pdf || pdf.userId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    await db.deleteGeneratedPdf(input.pdfId);
    return { success: true };
  }),
4. Backend Templates

Update: server/templates/projectReport.ts

Add logo to template:

<div class="header">
  {{#if logoUrl}}
    <img src="{{logoUrl}}" alt="Company Logo" style="max-height: 60px; max-width: 200px;" />
  {{else}}
    <h1>{{companyName}}</h1>
  {{/if}}

  <div class="company-details">
    <p>{{companyAddress}}</p>
    <p>{{companyPhone}} | {{companyEmail}}</p>
  </div>
</div>

Before generating PDF:

Fetch company settings: db.getCompanySettingsByUserId(userId)
Extract logoUrl, companyName, companyAddress, etc.
Fetch user preferences: db.getUserPreferencesByUserId(userId)
Extract dateFormat, timeFormat, currency
Pass all data to template renderer

Update: server/templates/invoice.ts

Add logo to invoice header (same pattern as project report):

<div class="invoice-header">
  {{#if logoUrl}}
    <img src="{{logoUrl}}" alt="Logo" class="invoice-logo" />
  {{else}}
    <h1>{{companyName}}</h1>
  {{/if}}

  <div class="invoice-details">
    <h2>Invoice #{{invoiceNumber}}</h2>
    <p>Date: {{invoiceDate}}</p>
    <p>Due: {{dueDate}}</p>
  </div>
</div>
5. Frontend Pages

Create: client/src/pages/GeneratedPdfs.tsx

PDF library page:

Header:

Title: "Generated PDFs"
Filter dropdown: "All Types" | "Project Reports" | "Invoices"
Search input (filename search)

Table:

Columns: Type | Filename | Generated | Size | Actions
Type: Badge (project_report, invoice, custom)
Filename: Text (truncated with tooltip)
Generated: Relative date ("2 hours ago")
Size: Human-readable (e.g., "1.2 MB")
Actions dropdown:
Download
Copy Share Link
Regenerate
Delete

Pagination:

50 PDFs per page
Page numbers at bottom

Empty state:

"No PDFs generated yet"

Add route:

Sidebar link: "Generated PDFs" (under "Reports" section)
Route: /pdfs
6. Frontend Components

Create: client/src/components/PdfPreviewDialog.tsx

Full-screen preview dialog:

Header:

Title: "PDF Preview"
Close button (X)

Body:

Loading skeleton (while preview generates)
Preview image (base64 from server)
Zoom controls:
"Fit to Width" button
"100%" button
Zoom in/out buttons

Footer:

"Close" button
"Download Full PDF" button
"Generate & Share" button

Flow:

User clicks "Preview" → Dialog opens
Call pdf.preview mutation with type + referenceId
Show loading skeleton
Server generates low-res preview image
Display base64 image
User can download full PDF or generate share link

Create: client/src/components/BatchPdfDialog.tsx

Batch generation dialog:

Header:

Title: "Batch Generate PDFs"

Body:

Project multi-select table:
Checkbox column
Project name
Status
Last updated
Template selector: Select dropdown (use same template for all)
Date range picker (optional, for time-based reports)

Footer:

"Cancel" button
"Generate X PDFs" button (X = selected count)

Progress indicator:

Show while generating: "Generating 3 of 10..."
Progress bar (visual)

Results:

Success message: "Generated 10 PDFs"
List of generated PDFs with download links
"Copy All Share Links" button (copies to clipboard, newline-separated)

Integration:

Add "Batch Generate" button to Projects page
Opens dialog, pre-selects all visible projects
Verification Checklist
Logo appears in project report PDFs
Logo appears in invoice PDFs
Preview generates and displays correctly
Batch generation processes multiple projects
Generated PDFs appear in library
Download links work
Share links work
Regenerate updates PDF with latest data
Delete removes PDF from S3 and DB
PHASE 5 — USER MANAGEMENT
Objective

Admin UI for user management and invitation flow.

Tasks (IN ORDER)
1. Database Schema

File: drizzle/schema.ts

Update users table:

status: varchar("status", { length: 20 }).default('active').notNull(), // active, inactive, suspended
invitedBy: int("invitedBy").references(() => users.id, { onDelete: 'set null' }),
invitedAt: timestamp("invitedAt"),
bio: text("bio"),
avatarS3Key: varchar("avatarS3Key", { length: 500 }),

Create user_invitations table:

export const userInvitations = mysqlTable("user_invitations", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  role: varchar("role", { length: 20 }).default('user').notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  invitedBy: int("invitedBy").notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  acceptedUserId: int("acceptedUserId").references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("user_invitations_email_idx").on(table.email),
  tokenIdx: index("user_invitations_token_idx").on(table.token),
}));
2. Backend Database Layer

File: server/db.ts

Add functions:

// User CRUD
export async function getUserById(id: number) { }
export async function updateUser(id: number, data: Partial<User>) { }
export async function updateUserRole(id: number, role: string) { }
export async function updateUserStatus(id: number, status: string) { }
export async function deleteUser(id: number) { } // Soft delete: status = 'deleted'

// Avatar
export async function uploadUserAvatar(userId: number, s3Key: string, url: string) { }

// Invitations
export async function createInvitation(email: string, role: string, invitedBy: number, expiresAt: Date) {
  // Generate unique token (crypto.randomBytes(32).toString('hex'))
  // INSERT INTO user_invitations
}

export async function getInvitationByToken(token: string) { }
export async function getAllPendingInvitations() {
  // WHERE acceptedAt IS NULL AND expiresAt > NOW()
}

export async function acceptInvitation(token: string, userId: number) {
  // UPDATE user_invitations SET acceptedAt = NOW(), acceptedUserId = ?
}

export async function revokeInvitation(id: number) {
  // DELETE FROM user_invitations WHERE id = ?
}
3. Backend Router

Create: server/usersRouter.ts

Extract from main router and add:

export const usersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    // Admin only
    if (ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    return await db.getAllUsers();
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const user = await db.getUserById(input.id);

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Admin: Full details
      if (ctx.user.role === 'admin') {
        return user;
      }

      // User: Limited details (name, email, bio, avatar only)
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        avatarS3Key: user.avatarS3Key,
      };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      email: z.string().email().optional(),
      bio: z.string().optional(),
      role: z.enum(['user', 'admin']).optional(),
      status: z.enum(['active', 'inactive', 'suspended']).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await db.getUserById(input.id);

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Admin: Can update role, status
      if (ctx.user.role === 'admin') {
        await db.updateUser(input.id, input);
        return { success: true };
      }

      // User: Can only update own profile (name, email, bio)
      if (user.id !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Remove role/status from input
      const { role, status, ...allowedFields } = input;
      await db.updateUser(input.id, allowedFields);
      return { success: true };
    }),

  updateRole: protectedProcedure
    .input(z.object({
      userId: z.number(),
      role: z.enum(['user', 'admin']),
    }))
    .mutation(async ({ input, ctx }) => {
      // Admin only
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db.updateUserRole(input.userId, input.role);
      return { success: true };
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      userId: z.number(),
      status: z.enum(['active', 'inactive', 'suspended']),
    }))
    .mutation(async ({ input, ctx }) => {
      // Admin only
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db.updateUserStatus(input.userId, input.status);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // Admin only
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db.deleteUser(input.id); // Soft delete
      return { success: true };
    }),

  uploadAvatar: protectedProcedure
    .input(z.object({ base64Image: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // 1. Validate image
      // 2. Resize with Sharp (max 400x400px)
      // 3. Upload to S3: uploads/avatars/{userId}/{timestamp}.jpg
      // 4. Store s3Key in users.avatarS3Key

      const avatarUrl = await uploadAvatar(ctx.user.id, input.base64Image);
      return { avatarUrl };
    }),

  // Nested invitations router
  invitations: router({
    send: protectedProcedure
      .input(z.object({
        email: z.string().email(),
        role: z.enum(['user', 'admin']).default('user'),
        expiresInDays: z.number().min(1).max(90).default(7),
      }))
      .mutation(async ({ input, ctx }) => {
        // Admin only
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);

        const invitation = await db.createInvitation(
          input.email,
          input.role,
          ctx.user.id,
          expiresAt
        );

        // TODO: Send email with invitation link
        // For now, return token to copy manually

        return {
          invitationId: invitation.id,
          token: invitation.token,
          invitationUrl: `${process.env.VITE_APP_URL}/accept-invitation?token=${invitation.token}`,
          expiresAt: invitation.expiresAt,
        };
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      // Admin only
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return await db.getAllPendingInvitations();
    }),

    resend: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Admin only
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        // TODO: Resend invitation email
        return { success: true };
      }),

    revoke: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Admin only
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        await db.revokeInvitation(input.id);
        return { success: true };
      }),

    accept: publicProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const invitation = await db.getInvitationByToken(input.token);

        if (!invitation) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invitation not found or expired.",
          });
        }

        if (invitation.expiresAt < new Date()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This invitation has expired.",
          });
        }

        if (invitation.acceptedAt) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This invitation has already been accepted.",
          });
        }

        // If user is logged in, link invitation to their account
        if (ctx.user) {
          await db.acceptInvitation(input.token, ctx.user.id);
          return { success: true, redirectUrl: '/dashboard' };
        }

        // If not logged in, redirect to signup with pre-filled email
        return {
          success: false,
          redirectUrl: `/signup?email=${invitation.email}&token=${input.token}`,
        };
      }),
  }),
});
4. Frontend Pages

Create: client/src/pages/Users.tsx (Admin only)

User management dashboard:

Header:

Title: "Users"
"Invite User" button (opens InviteUserDialog)

Tabs:

<Tabs defaultValue="active">
  <TabsList>
    <TabsTrigger value="active">Active Users</TabsTrigger>
    <TabsTrigger value="invitations">Pending Invitations</TabsTrigger>
    <TabsTrigger value="inactive">Inactive Users</TabsTrigger>
  </TabsList>

  <TabsContent value="active">
    {/* Filter: status === 'active' */}
  </TabsContent>

  <TabsContent value="invitations">
    {/* Show pending invitations */}
  </TabsContent>

  <TabsContent value="inactive">
    {/* Filter: status === 'inactive' or 'suspended' */}
  </TabsContent>
</Tabs>

User table:

Columns: Avatar | Name | Email | Role | Last Active | Status | Actions
Avatar: Image or initials
Role: Badge (user, admin)
Status: Badge (active, inactive, suspended)
Actions dropdown:
Edit Profile
Change Role
Deactivate / Activate
Delete

Search & filter:

Search input (name or email)
Filter by role (all, user, admin)

Empty state:

"No users found"
"Invite your first team member" button

Create: client/src/pages/AcceptInvitation.tsx (Public page)

Invitation acceptance flow:

URL: /accept-invitation?token=xxx

Flow:

Extract token from URL
Call invitations.accept mutation
If token invalid/expired:
Show error message: "This invitation is invalid or has expired."
"Contact your administrator" link
If token valid and user not logged in:
Redirect to signup with pre-filled email
After signup, auto-accept invitation
If token valid and user logged in:
Show invitation details:
"You've been invited to join [Company Name]"
Invited by: [Name]
Role: [User/Admin]
"Accept Invitation" button
On accept: Link account, redirect to dashboard
5. Frontend Components

Create: client/src/components/InviteUserDialog.tsx

Invitation form:

Fields:

Email: Input (required, email validation)
Role: Select (User, Admin)
Expiration: Select (24 hours, 7 days, 30 days, 90 days)
Message: Textarea (optional, not sent via email yet, just displayed)

Submit:

"Send Invitation" button
On success: Show success modal with invitation link

Result modal:

Success message: "Invitation sent to [email]"
Invitation link (copyable input with copy button)
"Send Email" button (future: send via email service)
Close button

Create: client/src/components/EditUserDialog.tsx

User profile editor:

Admin view:

Name: Input
Email: Input
Bio: Textarea
Role: Select (User, Admin)
Status: Select (Active, Inactive, Suspended)
Avatar: Image upload (uses uploadAvatar mutation)
"Save" button

User view (own profile):

Name, Email, Bio, Avatar only
Cannot change role or status
"Save" button
6. Navigation Updates

Sidebar:

Add "Users" link (admin only, shield icon)
Route: /users

User dropdown menu:

Add "My Profile" link
Route: /profile (opens EditUserDialog with current user)
Verification Checklist
Admin can view all users
Admin can invite user
Invitation link works
User can accept invitation
Expired invitations rejected
Admin can change user role
Admin can deactivate user
User can edit own profile
User cannot edit others' profiles
Avatar upload works
Pending invitations displayed correctly
PHASE 6 — TIME TRACKING
Objective

Reliable check-in/check-out flow with time reports.

HARD RULE

One active check-in per user. Enforced server-side.

Tasks (IN ORDER)
1. Database Schema

File: drizzle/schema.ts

Update project_checkins table:

jobId: int("jobId").references(() => projectJobs.id, { onDelete: 'cascade' }),
checkInLatitude: decimal("checkInLatitude", { precision: 10, scale: 8 }),
checkInLongitude: decimal("checkInLongitude", { precision: 11, scale: 8 }),
checkOutLatitude: decimal("checkOutLatitude", { precision: 10, scale: 8 }),
checkOutLongitude: decimal("checkOutLongitude", { precision: 11, scale: 8 }),
duration: int("duration"), // Calculated duration in minutes
breakTime: int("breakTime").default(0), // Break time in minutes
status: varchar("status", { length: 20 }).default('active').notNull(), // active, completed, cancelled
category: varchar("category", { length: 50 }), // work, travel, meeting

Remove old columns:

// Drop: latitude, longitude (replaced with separate check-in/check-out coords)

Create time_tracking_breaks table:

export const timeTrackingBreaks = mysqlTable("time_tracking_breaks", {
  id: serial("id").primaryKey(),
  checkinId: int("checkinId").notNull().references(() => projectCheckins.id, { onDelete: 'cascade' }),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime"),
  duration: int("duration"), // Calculated in minutes
  reason: varchar("reason", { length: 100 }), // lunch, rest, etc.
}, (table) => ({
  checkinIdIdx: index("time_tracking_breaks_checkinId_idx").on(table.checkinId),
}));
2. Backend Database Layer

File: server/db.ts

Add functions:

// Check-in
export async function createCheckin(userId: number, projectId: number, jobId: number | null, data: any) {
  // INSERT INTO project_checkins
}

export async function getCheckinById(id: number) { }

export async function updateCheckin(id: number, data: Partial<Checkin>) { }

export async function completeCheckin(id: number, checkOutTime: Date, coords: any) {
  // 1. Calculate duration: checkOutTime - checkInTime - breakTime
  // 2. UPDATE status = 'completed', checkOutTime, duration, coords
}

export async function getActiveCheckinForUser(userId: number) {
  // SELECT * FROM project_checkins WHERE userId = ? AND status = 'active'
}

export async function getUserCheckins(userId: number, filters: any) {
  // SELECT * FROM project_checkins WHERE userId = ?
  // Apply filters: startDate, endDate, projectId, status
  // ORDER BY checkInTime DESC
}

export async function getProjectCheckins(projectId: number, filters: any) { }

// Breaks
export async function startBreak(checkinId: number, reason: string | null) {
  // INSERT INTO time_tracking_breaks (checkinId, startTime, reason)
}

export async function endBreak(breakId: number, endTime: Date) {
  // 1. Calculate duration: endTime - startTime
  // 2. UPDATE time_tracking_breaks SET endTime, duration
  // 3. Add break duration to project_checkins.breakTime
}

export async function getCheckinBreaks(checkinId: number) {
  // SELECT * FROM time_tracking_breaks WHERE checkinId = ?
}

// Reports
export async function getTimeTrackingSummary(userId: number, startDate: Date, endDate: Date, groupBy: string) {
  // Aggregate: SUM(duration) grouped by day or project
}

export async function getTotalHoursForProject(projectId: number, startDate: Date, endDate: Date) {
  // SUM(duration) for project
}
3. Backend Router

Create: server/timeTrackingRouter.ts

export const timeTrackingRouter = router({
  // Check-in/out
  checkIn: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      jobId: z.number().optional(),
      category: z.string().optional(),
      notes: z.string().optional(),
      coords: z.object({
        latitude: z.number(),
        longitude: z.number(),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Check for existing active check-in
      const existingCheckin = await db.getActiveCheckinForUser(ctx.user.id);

      if (existingCheckin) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You already have an active check-in. Please check out first.',
        });
      }

      const checkin = await db.createCheckin(
        ctx.user.id,
        input.projectId,
        input.jobId || null,
        {
          category: input.category,
          notes: input.notes,
          checkInLatitude: input.coords?.latitude,
          checkInLongitude: input.coords?.longitude,
          checkInTime: new Date(),
          status: 'active',
        }
      );

      return {
        checkinId: checkin.id,
        checkInTime: checkin.checkInTime,
      };
    }),

  checkOut: protectedProcedure
    .input(z.object({
      checkinId: z.number(),
      coords: z.object({
        latitude: z.number(),
        longitude: z.number(),
      }).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const checkin = await db.getCheckinById(input.checkinId);

      if (!checkin || checkin.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (checkin.status !== 'active') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This check-in is not active.',
        });
      }

      const checkOutTime = new Date();
      await db.completeCheckin(input.checkinId, checkOutTime, input.coords);

      // Calculate duration
      const duration = Math.floor(
        (checkOutTime.getTime() - new Date(checkin.checkInTime).getTime()) / 1000 / 60
      ) - (checkin.breakTime || 0);

      return {
        duration,
        checkOutTime,
      };
    }),

  currentCheckin: protectedProcedure.query(async ({ ctx }) => {
    return await db.getActiveCheckinForUser(ctx.user.id);
  }),

  update: protectedProcedure
    .input(z.object({
      checkinId: z.number(),
      notes: z.string().optional(),
      category: z.string().optional(),
      breakTime: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const checkin = await db.getCheckinById(input.checkinId);

      if (!checkin || checkin.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db.updateCheckin(input.checkinId, input);
      return { success: true };
    }),

  // Breaks
  startBreak: protectedProcedure
    .input(z.object({
      checkinId: z.number(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const checkin = await db.getCheckinById(input.checkinId);

      if (!checkin || checkin.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const breakRecord = await db.startBreak(input.checkinId, input.reason || null);
      return breakRecord;
    }),

  endBreak: protectedProcedure
    .input(z.object({ breakId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const endTime = new Date();
      await db.endBreak(input.breakId, endTime);
      return { success: true };
    }),

  // Reports
  list: protectedProcedure
    .input(z.object({
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      projectId: z.number().optional(),
      status: z.enum(['active', 'completed', 'cancelled']).optional(),
    }))
    .query(async ({ input, ctx }) => {
      return await db.getUserCheckins(ctx.user.id, input);
    }),

  summary: protectedProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      groupBy: z.enum(['day', 'project']),
    }))
    .query(async ({ input, ctx }) => {
      return await db.getTimeTrackingSummary(
        ctx.user.id,
        input.startDate,
        input.endDate,
        input.groupBy
      );
    }),

  export: protectedProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      format: z.enum(['csv', 'pdf']),
    }))
    .mutation(async ({ input, ctx }) => {
      // TODO: Generate CSV or PDF export
      // For now, return placeholder
      return { downloadUrl: '#' };
    }),
});

Rules:

Store UTC timestamps only
Duration calculated server-side
Prevent multiple active check-ins per user
Auto check-out after 24 hours (background job, future)
4. Frontend Components

Create: client/src/components/TimeTrackingWidget.tsx

Global widget (fixed bottom-right corner):

Not Checked In:

"Check In" button (green, clock icon)
Last check-in info: "Last: 2 hours ago (Project Alpha)"

Checked In:

Live timer: HH:MM:SS (updates every second)
Project name (truncated)
Job name (if applicable)
"Take Break" button (yellow)
"Check Out" button (red)
Minimize/expand toggle

Features:

Persist state across navigation (React context + localStorage)

Warning before closing tab while checked in:

useEffect(() => {
  if (isCheckedIn) {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }
}, [isCheckedIn]);

Auto-update timer using setInterval

Collapsible to minimize screen space

Create: client/src/components/CheckInDialog.tsx

Check-in form:

Fields:

Project: Select (required)
Job: Select (optional, filtered by selected project)
Category: Select (Work, Travel, Meeting, Other)
Notes: Textarea (optional)
Capture Location: Checkbox (requests geolocation permission)

Submit:

"Check In" button
On success: Close dialog, show widget with timer

Create: client/src/components/CheckOutDialog.tsx

Check-out confirmation:

Summary:

Elapsed time: HH:MM:SS
Break time: HH:MM (sum of all breaks)
Working time: HH:MM (elapsed - break)

Fields:

Add Final Notes: Textarea (appended to existing notes)
Capture Location: Checkbox

Submit:

"Check Out" button
On success: Close dialog, hide widget, show success toast
5. Frontend Pages

Create: client/src/pages/TimeTracking.tsx

Time tracking reports page:

Header:

Title: "Time Tracking"
Date range picker (This Week, This Month, Custom)
Export button (CSV/PDF)

Summary cards (4 cards in row):

Total Hours This Week: "32.5 hrs"
Total Hours This Month: "140 hrs"
Average Hours Per Day: "6.5 hrs"
Current Status: "Checked Out" or "Checked In (2:34:15)"

Tabs:

<Tabs defaultValue="recent">
  <TabsList>
    <TabsTrigger value="recent">Recent Activity</TabsTrigger>
    <TabsTrigger value="byProject">By Project</TabsTrigger>
    <TabsTrigger value="calendar">Calendar View</TabsTrigger>
  </TabsList>

  <TabsContent value="recent">
    {/* Table of check-ins */}
  </TabsContent>

  <TabsContent value="byProject">
    {/* Grouped by project with totals */}
  </TabsContent>

  <TabsContent value="calendar">
    <TimeTrackingCalendar />
  </TabsContent>
</Tabs>

Table (Recent Activity):

Columns: Date | Project | Job | Check-in | Check-out | Duration | Actions
Duration: "8h 30m" (formatted)
Actions dropdown:
Edit Notes
View Details (opens modal with breaks, coords)
Delete

By Project:

Accordion or cards grouped by project
Show total hours per project
List check-ins under each project

Create: client/src/components/TimeTrackingCalendar.tsx

Calendar timeline view:

Monthly calendar grid:

Each day shows time blocks (colored bars)
Color-coded by project (use project color or hash)
Bar height represents duration
Click day → open modal with details
Hover → tooltip with summary

Example:

Mon 1   ████████░░ (8.5 hrs - Project Alpha)
Tue 2   ████████░░ (8 hrs - Project Beta)
Wed 3   ░░░░░░░░░░ (0 hrs - No check-ins)
6. Integration

Update: client/src/layouts/DashboardLayout.tsx

Add widget to layout:

<div className="dashboard-layout">
  {/* Existing sidebar, header, content */}

  <TimeTrackingWidget />
</div>

Sidebar:

Add "Time Tracking" link (clock icon)
Route: /time-tracking
Verification Checklist
Check-in creates active check-in
Cannot check in twice (error message)
Timer updates every second
Break time tracked correctly
Check-out calculates duration accurately
Widget persists across page navigation
Warning shown before closing tab while checked in
Time tracking reports display correctly
Calendar view renders time blocks
Export works (CSV/PDF)
Multi-tab prevention (detect existing check-in)
FINAL ACCEPTANCE CRITERIA

Claude must not consider work complete unless:

DB migrations applied cleanly (no errors)
No TypeScript errors in codebase
No unused tables or routes
Core workflows tested end-to-end
Mobile usability confirmed (touch targets, responsive)
All verification checklists passed
Each phase deployed successfully to production
EXECUTION MODE SUMMARY

Claude is acting as:

Senior SaaS engineer (not junior, not experimental)
Production-minded (ship working software, not prototypes)
Zero-scope-creep (only build what's specified)
Incremental delivery (one phase at a time, test thoroughly)
Pattern-follower (match existing codebase style exactly)

End of Plan