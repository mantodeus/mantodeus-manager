# ✅ Codex Prompt — Invoice Delete / Archive / Revert Status System (Refined for Production)

## Context
We are implementing a safe, compliant invoice lifecycle in Mantodeus Manager.
Invoices must follow archive/bin patterns already used elsewhere in the app (Projects, Contacts, Notes).

**Core rules (non-negotiable):**
- Sent and paid invoices must NOT be deleted
- Sent and paid invoices MAY be archived
- Draft invoices MAY be deleted (via Rubbish bin)
- Sent/paid invoices may optionally be reverted ("mark as not sent / not paid") with a strong warning, after which deletion becomes allowed
- Backend must enforce rules (UI alone is not enough)

## 🎯 Objectives

1. Replace hard delete with archive + Rubbish bin pattern
2. Enforce status-based guards server-side
3. Add revert status actions with warnings
4. Keep UI consistent with existing archive/bin patterns (Projects, Contacts, Notes)
5. Preserve audit safety and predictable UX

## 🧠 Data Model (Schema Extension)

**Add to `drizzle/schema.ts` invoices table:**
```typescript
archivedAt: timestamp("archivedAt"),
trashedAt: timestamp("trashedAt"),
```

**Note:** Do NOT use a `visibility` enum. Follow the existing pattern used by `projects`, `contacts`, and `notes` tables which use `archivedAt` and `trashedAt` timestamp fields.

**Visibility logic (computed, not stored):**
- `archivedAt === null && trashedAt === null` → `'active'`
- `archivedAt !== null && trashedAt === null` → `'archived'`
- `trashedAt !== null` → `'trashed'` (regardless of archivedAt)

**Status remains separate:**
- `status: 'draft' | 'sent' | 'paid'` (unchanged)

## 📋 Database Migration

Create a new migration file in `/drizzle/`:
- Add `archivedAt` and `trashedAt` timestamp columns to `invoices` table
- Add indexes: `invoices_archivedAt_idx` and `invoices_trashedAt_idx`
- Follow the pattern from existing migrations (e.g., `0011_invoice_overhaul.sql`)

## 🔐 Backend — invoiceRouter.ts

### 1. Update `list` query
Filter to show only active invoices (where `archivedAt IS NULL AND trashedAt IS NULL`).

### 2. Add new list queries (following existing pattern)
```typescript
listArchived: protectedProcedure.query(async ({ ctx }) => {
  // Return invoices where archivedAt IS NOT NULL AND trashedAt IS NULL
}),

listTrashed: protectedProcedure.query(async ({ ctx }) => {
  // Return invoices where trashedAt IS NOT NULL
}),
```

### 3. Remove/modify hard delete

**Replace `delete` mutation with guards:**

```typescript
delete: protectedProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ input, ctx }) => {
    const invoice = await db.getInvoiceById(input.id);
    if (!invoice) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
    }
    if (invoice.userId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You don't have access to this invoice" });
    }
    // CRITICAL: Only allow deletion of draft invoices that are in trash
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
```

### 4. Add new mutations

**archiveInvoice:**
```typescript
archive: protectedProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ input, ctx }) => {
    // Allowed for all statuses
    // Sets archivedAt = now, trashedAt = null
  }),
```

**trashInvoice:**
```typescript
moveToTrash: protectedProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ input, ctx }) => {
    // Allowed only if status === 'draft'
    // Sets trashedAt = now
  }),
```

**restoreInvoice:**
```typescript
restore: protectedProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ input, ctx }) => {
    // Restores from archived or trashed → active
    // Sets archivedAt = null, trashedAt = null
  }),
```

**revertInvoiceStatus:**
```typescript
revertStatus: protectedProcedure
  .input(z.object({ 
    id: z.number(),
    targetStatus: z.enum(['draft', 'sent']),
    confirmed: z.boolean() // Explicit confirmation flag
  }))
  .mutation(async ({ input, ctx }) => {
    // Allowed transitions:
    //   sent → draft (if confirmed)
    //   paid → sent (if confirmed)
    // Requires confirmed === true
    // Clears any sent/paid timestamps if present
  }),
```

### 5. Server-side enforcement

**Do NOT rely on UI guards.** All restrictions must be enforced in router:
- Check `status` before allowing trash/delete
- Check `trashedAt` before allowing permanent delete
- Require `confirmed: true` for status reversions
- Validate status transitions (sent→draft, paid→sent only)

## 🗄️ Backend — db.ts

Add database functions following existing patterns:

```typescript
// List queries
export async function getArchivedInvoicesByUserId(userId: number)
export async function getTrashedInvoicesByUserId(userId: number)

// Archive/trash operations
export async function archiveInvoice(id: number)
export async function moveInvoiceToTrash(id: number)
export async function restoreInvoice(id: number) // Restores from archive or trash

// Update list queries to filter by archivedAt/trashedAt
export async function getInvoicesByUserId(userId: number) {
  // Filter: archivedAt IS NULL AND trashedAt IS NULL
}
```

## 🖥️ Frontend — Invoices.tsx and action menus

### Active invoice menu (status-based)

**Draft:**
- Edit
- Duplicate (coming soon - toast only)
- Archive
- Move to Rubbish bin
- ~~Delete permanently~~ (not available for active invoices)

**Sent:**
- View
- Archive
- Mark as not sent (warning modal)
- Duplicate (coming soon - toast only)
- ~~Move to Rubbish bin~~ (not available)
- ~~Delete~~ (not available)

**Paid:**
- View
- Archive
- Mark as not paid (warning modal)
- Duplicate (coming soon - toast only)
- ~~Move to Rubbish bin~~ (not available)
- ~~Delete~~ (not available)

### Archived invoice menu
- Restore
- Move to Rubbish bin (if draft only)
- Duplicate (coming soon)

### Trashed invoice menu
- Restore
- Delete permanently (if draft only)

## ⚠️ Warning Modals (Critical)

When reverting status, show a blocking confirmation modal using shadcn `AlertDialog`:

**Title:** "Revert invoice status?"

**Message examples:**

**Sent → Draft:**
> This invoice has already been sent. Reverting it may affect records and client communication. Only do this if the invoice was sent in error.

**Paid → Sent:**
> This invoice is marked as paid. Reverting it may affect accounting records. Only proceed if payment was recorded incorrectly.

**Required:**
- Explicit confirmation click
- Optional checkbox: "I understand the consequences"
- Only after revert: Delete / Rubbish bin becomes available (if draft)

## 🗑️ Rubbish Bin Behaviour

**Trashed invoices:**
- Can be restored (sets `trashedAt = null`)
- Can be permanently deleted (only if `status === 'draft'`)

**Permanent delete:**
- Draft only (enforced server-side)
- Explicit danger confirmation (use AlertDialog with destructive variant)
- Only available from Rubbish bin view

## 📄 New UI Pages

Create following pages (matching existing pattern):

1. **`/client/src/pages/InvoicesArchived.tsx`**
   - List archived invoices
   - Actions: Restore, Move to Rubbish (if draft), Duplicate
   - Follow pattern from `ProjectsArchived.tsx` / `ContactsArchived.tsx`

2. **`/client/src/pages/InvoicesRubbish.tsx`**
   - List trashed invoices
   - Actions: Restore, Delete permanently (if draft)
   - Follow pattern from `ProjectsRubbish.tsx` / `ContactsRubbish.tsx`

3. **Update `Invoices.tsx`**
   - Filter to show only active invoices
   - Update action menu based on status
   - Add navigation links to Archived/Rubbish views
   - Add status-based action restrictions

4. **Update routing in `App.tsx`**
   - Add routes for `/invoices/archived` and `/invoices/rubbish`

## 🧪 Tests / Smoke Checks

Manually verify:

1. ✅ Draft → Rubbish bin → delete permanently
2. ✅ Sent → cannot delete → archive works
3. ✅ Paid → cannot delete → archive works
4. ✅ Sent → revert to draft → delete becomes available
5. ✅ Paid → revert to sent → revert to draft → delete available
6. ✅ Backend blocks invalid transitions even if UI is bypassed
7. ✅ Archived invoices appear in Archived view
8. ✅ Trashed invoices appear in Rubbish view
9. ✅ Restore works from both Archived and Rubbish views

## 📝 Notes

- Use the same archive/bin UI patterns already present in `ProjectsArchived.tsx`, `ContactsArchived.tsx`, `ProjectsRubbish.tsx`, `ContactsRubbish.tsx`
- Do NOT silently delete sent/paid invoices
- All copy should mention "accounting reasons" where relevant
- Use "Rubbish bin" terminology (not "bin" or "trash") to match existing UI
- Duplicate remains placeholder for now (toast only)
- Follow existing component patterns (ItemActionsMenu, AlertDialog, etc.)

## ✅ Outcome

This implementation:
- ✅ Matches professional accounting software behaviour
- ✅ Is legally safe (German tax compliance)
- ✅ Is UX-clear and predictable
- ✅ Scales cleanly to credit notes / cancellations later
- ✅ Consistent with existing codebase patterns
- ✅ Properly enforces rules server-side

