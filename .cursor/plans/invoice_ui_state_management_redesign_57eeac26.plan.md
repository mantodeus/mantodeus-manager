---
name: Invoice UI State Management Redesign
overview: Redesign the invoice editing interface with a comprehensive state management system that handles uploaded and created invoices differently, with proper UI controls, status transitions, and warning messages.
todos:
  - id: backend-mark-sent
    content: "Add backend tRPC endpoints: markAsSent, revertToDraft, revertToSent, addInvoicePayment in invoiceRouter.ts (status derived by backend only)"
    status: pending
    dependencies:
      - database-schema-payments
  - id: database-schema-payments
    content: "Add amountPaid column (DECIMAL(10,2), default 0.00), add lastPaymentAt column (timestamp, nullable), add invalidated column (boolean, default false), add invalidatedAt column (timestamp, nullable) to shared_documents table, ensure dueDate is DATE type, MANDATORY BACKFILL: UPDATE invoices SET amountPaid = total WHERE paidAt IS NOT NULL, create migration with backfill script"
    status: pending
  - id: backend-db-functions
    content: "Add database functions: markInvoiceAsSent, revertInvoiceToDraft (only if amountPaid === 0, invalidates all share links), revertInvoiceToSent (resets amountPaid), addInvoicePayment (auto-sets lastPaymentAt, blocks overpayment) in db.ts (status always derived from timestamps)"
    status: pending
    dependencies:
      - database-schema-payments
  - id: share-link-auto-sent
    content: Update pdf.createShareLink to auto-set sentAt if null when creating invoice share link
    status: pending
    dependencies:
      - backend-mark-sent
  - id: share-invoice-page
    content: "Create ShareInvoice page/dialog: default expiry 30 days, show expiry date clearly, allow regeneration without touching sentAt, auto-mark as sent when link created"
    status: pending
    dependencies:
      - backend-mark-sent
  - id: add-payment-dialog
    content: "Create AddPaymentDialog component: amount input only (no date picker for v1), validation (amount <= outstanding, block overpayment), auto-set lastPaymentAt, submit updates amountPaid"
    status: pending
    dependencies:
      - backend-mark-sent
  - id: payments-section-ui
    content: "Add payments section to InvoiceUploadReviewDialog and InvoiceForm: show Total/Paid/Outstanding, Add Payment button (visible when sentAt && !paidAt)"
    status: pending
    dependencies:
      - add-payment-dialog
      - backend-mark-sent
  - id: badge-system
    content: "Implement badge system: OVERDUE (red, priority 1), PARTIAL (amber, priority 2), SENT/PAID (secondary, priority 3) in list and detail views"
    status: pending
    dependencies:
      - backend-mark-sent
  - id: overdue-logic
    content: "Implement UI-derived overdue calculation: isOverdue = sentAt && !paidAt && dueDate && dueDate < today, show days overdue in warning banner"
    status: pending
    dependencies:
      - badge-system
  - id: update-upload-dialog-ui
    content: "Update InvoiceUploadReviewDialog: remove description, add header buttons (lifecycle - Sent button stays 'Sent' even when partial), footer buttons (form actions only), PARTIAL as badge not button, derive state from timestamps + needsReview + amountPaid, enforce canRevertToDraft = amountPaid === 0"
    status: pending
    dependencies:
      - backend-mark-sent
      - share-link-auto-sent
      - payments-section-ui
      - badge-system
  - id: update-invoice-form-ui
    content: "Update InvoiceForm: add header buttons (lifecycle - Sent button stays 'Sent' even when partial), footer buttons (form actions), PARTIAL as badge not button, derive state from timestamps + amountPaid, add read-only overlay when sent, enforce canRevertToDraft = amountPaid === 0"
    status: pending
    dependencies:
      - backend-mark-sent
      - share-link-auto-sent
      - payments-section-ui
      - badge-system
  - id: warning-banners
    content: "Add warning banners: NOT SENT (!sentAt && !needsReview), NOT PAID (sentAt && !paidAt), OVERDUE (sentAt && !paidAt && dueDate < today) in both components"
    status: pending
    dependencies:
      - update-upload-dialog-ui
      - update-invoice-form-ui
      - overdue-logic
  - id: read-only-overlay
    content: Add read-only overlay/note explaining why fields are disabled when invoice is sent
    status: pending
    dependencies:
      - update-upload-dialog-ui
      - update-invoice-form-ui
  - id: share-flow-integration
    content: "Integrate share flow: Send button navigates to share page, auto-marks as sent when share link created, updates UI on return"
    status: pending
    dependencies:
      - share-invoice-page
      - update-upload-dialog-ui
  - id: revert-dialogs
    content: "Enhance RevertInvoiceStatusDialog: display invoice number + amount, optional 'REVERT' typing requirement for critical reversions"
    status: pending
    dependencies:
      - backend-mark-sent
      - update-upload-dialog-ui
      - update-invoice-form-ui
  - id: mobile-responsive
    content: "Mobile: Header buttons don't wrap, prioritize primary lifecycle button, collapse Preview to icon if needed, footer stacks properly"
    status: pending
    dependencies:
      - update-upload-dialog-ui
      - update-invoice-form-ui
  - id: test-state-transitions
    content: "Test all state transitions (timestamp-driven + amountPaid): review → draft → sent → partial → paid, payment flow, overdue calculation, reversions, share flow auto-mark, read-only states"
    status: pending
    dependencies:
      - warning-banners
      - share-flow-integration
      - revert-dialogs
      - read-only-overlay
      - mobile-responsive
      - payments-section-ui
      - badge-system
      - overdue-logic
---

# Invoice UI State Management Redesign

## Overview

This plan implements a comprehensive invoice editing interface with state-based UI controls, proper status transitions, and warning messages for both uploaded and created invoices.

## Current State Analysis

### Existing Components

- `InvoiceUploadReviewDialog.tsx` - Handles uploaded invoice review/edit
- `InvoiceForm.tsx` - Handles created invoice editing (full customization)
- `RevertInvoiceStatusDialog.tsx` - Warning dialog for status reversions
- Share link system exists via `pdf.createShareLink` tRPC endpoint

### Current Invoice States

**Single Source of Truth: Timestamps + needsReview + amountPaid**

- `needsReview: true` - Newly uploaded, unconfirmed
- `sentAt: Date | null` - Timestamp when invoice was sent (fact)
- `paidAt: Date | null` - Timestamp when invoice was paid (fact)
- `amountPaid: DECIMAL(10,2)` - Total amount paid so far (default 0)
- `lastPaymentAt: Date | null` - Timestamp of last payment (optional, auto-set)
- `dueDate: DATE | null` - Payment due date (for overdue calculation)
- `status` - Derived from timestamps (backend-managed, not UI-driven)

**Derived Values (never stored):**

```typescript
outstanding = totalAmount - amountPaid
isPaid = outstanding <= 0
isPartial = amountPaid > 0 && outstanding > 0
isOverdue = sentAt !== null && !isPaid && dueDate && dueDate < today
```

**Derived State Logic (UI should use this):**

```typescript
if (needsReview) -> REVIEW
else if (!sentAt) -> DRAFT
else if (sentAt && !paidAt && amountPaid === 0) -> SENT
else if (sentAt && amountPaid > 0 && !paidAt) -> PARTIAL
else if (paidAt) -> PAID
```

**Critical Rules:**

- UI logic keys off timestamps + needsReview + amountPaid, NOT status field directly
- Status is derived/written only by backend helpers
- Partial is NOT a stored status — it's a derived UI state
- `paidAt` is set only when `outstanding <= 0` (fully paid)

## Implementation Plan

### 1. Create Share Invoice Page/Dialog

**File:** `client/src/pages/ShareInvoice.tsx` (new page) or `client/src/components/ShareInvoiceDialog.tsx` (dialog)**Purpose:** Dedicated interface for sharing invoices with clients**Features:**

- Display invoice details (number, client, amount)
- Create share link using `pdf.createShareLink` mutation
- Display shareable link with copy button
- **Default expiry: 30 days** (configurable)
- **Show expiry date clearly** in UI
- **Allow regeneration** of share link without touching `sentAt` (if link already exists)
- **Auto-mark as sent** when share link is created (no separate button)
- Show confirmation message: "This invoice has now been marked as sent"
- Navigation back to invoice edit page

**Route:** `/invoices/:id/share` (if page) or dialog (if component)

### 2. Update InvoiceUploadReviewDialog Component

**File:** `client/src/components/InvoiceUploadReviewDialog.tsx`**Changes:**

#### UI Layout

- Remove `DialogDescription` text ("Edit invoice metadata...")
- Add header action buttons (top right):
- Preview button (always visible, left side)
- Send button (when draft, highlighted/primary, right side)
- Sent button (when sent, replaces Send, disabled state)
- Paid button (when paid, replaces Sent)
- Remove preview button from footer
- Footer buttons: Save/Update, Cancel (red/destructive variant)

#### State-Based Button Logic

**Review State (`needsReview === true`):**

- Title: "Review Invoice"
- Top right: Only "Preview" button
- Footer: Save, Cancel **ONLY** (no lifecycle actions in review state)
- **No "Mark as Sent" or "Mark as Paid" buttons** - Must save first to become draft, then can send

**Draft State (`needsReview === false`, `!sentAt`):**

- Title: "Edit Invoice"
- Top right: "Preview" (left), "Send" (right, highlighted/primary)
- Footer: Save, Cancel
- **Header = lifecycle, Footer = form actions only**

**Sent State (`sentAt !== null`, `!paidAt`, `amountPaid === 0`):**

- Title: "Edit Invoice"
- Top right: "Preview" (left), "Sent" (right, disabled/secondary)
- Footer: Save, Revert to Draft, Cancel
- **Revert to Draft only allowed if `amountPaid === 0`** (financial integrity)
- Form fields disabled (cannot edit)
- **Read-only overlay/note:** "This invoice is locked because it has been sent."
- **Payments section visible** (if sent): Shows total, paid, outstanding, "Add Payment" button

**Partial State (`sentAt !== null`, `amountPaid > 0`, `!paidAt`):**

- Title: "Edit Invoice"
- Top right: "Preview" (left), "Sent" (right, disabled/secondary) - **Header button remains "Sent"**
- **PARTIAL badge** displayed (amber, separate from lifecycle button)
- Footer: Save, Revert to Sent (NOT Revert to Draft), Cancel
- **Critical:** Cannot revert to draft if `amountPaid > 0` (financial integrity protection)
- Form fields disabled (cannot edit)
- **Read-only overlay/note:** "This invoice is locked because it has been sent."
- **Payments section visible:** Shows total, paid, outstanding, "Add Payment" button

**Paid State (`paidAt !== null`):**

- Title: "Edit Invoice"
- Top right: "Preview" (left), "Paid" (right, disabled/secondary)
- Footer: Save, Revert to Sent, Cancel
- Form fields disabled (cannot edit)
- **Read-only overlay/note:** "This invoice is locked because it has been sent."

#### Warning Messages

**Simplified Logic:**

- NOT SENT: `!sentAt && !needsReview` (draft invoices that should have been sent)
- NOT PAID: `sentAt && !paidAt` (sent invoices that haven't been paid)
- OVERDUE: `sentAt && !paidAt && dueDate && dueDate < today` (sent, unpaid, past due date)
- Use existing warning pattern from `InvoicesRubbish.tsx` (yellow border, text)
- Display as badges/banners above form fields
- **Overdue warning:** "⚠️ This invoice is overdue by X days" (calculate days dynamically)

#### New Mutations Needed

- `markAsSent` - Sets `sentAt` timestamp (if not exists)
- `revertToDraft` - Clears `sentAt`, reverts to draft (requires confirmation)
- `revertToSent` - Clears `paidAt` and `amountPaid`, reverts to sent state (requires confirmation)
- `addInvoicePayment` - Adds payment amount, updates `amountPaid`, sets `paidAt` if fully paid

### 3. Update InvoiceForm Component

**File:** `client/src/components/invoices/InvoiceForm.tsx`**Changes:**

- Add same header action buttons (Preview, Send/Sent/Paid)
- Remove preview button from bottom
- Add same state-based footer buttons
- Add warning messages for not sent/not paid states
- Disable form fields when `sentAt !== null` (sent invoices cannot be edited)

### 4. Database Schema Updates

**File:** `drizzle/schema.ts`**Add to invoices table:**

```typescript
amountPaid: decimal("amountPaid", { precision: 10, scale: 2 }).notNull().default("0.00"),
lastPaymentAt: timestamp("lastPaymentAt"), // Optional: tracks when last payment was made
dueDate: date("dueDate"), // Already exists, ensure it's DATE type
```

**Migration:** Create migration file to:

1. Add `amountPaid` column with default 0.00
2. Add `lastPaymentAt` column (nullable)
3. **MANDATORY BACKFILL:** `UPDATE invoices SET amountPaid = total WHERE paidAt IS NOT NULL`

- This prevents paid invoices from appearing unpaid after migration
- Must be included in migration script

**Design Principles:**

- No payments table
- No joins
- No over-engineering
- Partial payments are additive, not transactional
- Overdue is derived, never stored

### 5. Backend: Add New tRPC Endpoints

**File:** `server/invoiceRouter.ts`**New Procedures:**

```typescript
markAsSent: protectedProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ input, ctx }) => {
    // Set sentAt timestamp, update status to 'open'
    // Similar to issueInvoice but doesn't lock invoice number
  }),

revertToDraft: protectedProcedure
  .input(z.object({ id: z.number(), confirmed: z.boolean() }))
  .mutation(async ({ input, ctx }) => {
    // Clear sentAt, revert to draft
    // Requires confirmation (warning dialog with invoice details)
  }),

revertToSent: protectedProcedure
  .input(z.object({ id: z.number(), confirmed: z.boolean() }))
  .mutation(async ({ input, ctx }) => {
    // Clear paidAt and amountPaid (reset to 0), revert to sent/open state
    // Requires confirmation (warning dialog with invoice details)
  }),

addInvoicePayment: protectedProcedure
  .input(z.object({
    id: z.number(),
    amount: z.number().positive(),
    // No date input for v1 - auto-set to now()
  }))
  .mutation(async ({ input, ctx }) => {
    // Validate amount > 0
    // Validate amount <= outstanding (totalAmount - amountPaid) - BLOCK overpayment
    // Update amountPaid += paymentAmount
    // Set lastPaymentAt = now() (if field exists)
    // If amountPaid >= totalAmount, set paidAt = now()
    // Return updated invoice
  }),
```



### 5. Database Functions

**File:** `server/db.ts`**New Functions:**

- `markInvoiceAsSent(id: number)` - Sets `sentAt = NOW()`, `status = 'open'`
- `markInvoiceAsNotSent(id: number)` - Sets `sentAt = NULL`, `status = 'draft'`
- `markInvoiceAsNotPaid(id: number)` - Sets `paidAt = NULL`, keeps `sentAt`

### 7. UI Badge System (List + Detail Views)

**File:** `client/src/pages/Invoices.tsx`, `client/src/components/InvoiceUploadReviewDialog.tsx`, `client/src/components/invoices/InvoiceForm.tsx`**Badge Priority (left → right):**

1. OVERDUE (red/warning) - Highest priority
2. PARTIAL (amber) - Medium priority
3. SENT / PAID (secondary) - Normal state

**Badge Logic:**

```typescript
// In invoice list and detail views
const badges = [];
if (isOverdue) badges.push(<Badge variant="destructive">OVERDUE</Badge>);
if (isPartial) badges.push(<Badge variant="outline" className="border-amber-500 text-amber-600">PARTIAL</Badge>);
if (sentAt && !paidAt && !isPartial) badges.push(<Badge variant="default">SENT</Badge>);
if (paidAt) badges.push(<Badge variant="secondary">PAID</Badge>);
```

**Important:** PARTIAL is a badge, NOT a lifecycle button. Header button remains "Sent" even when partial.**Examples:**

- `[ OVERDUE ] [ PARTIAL ]` - Overdue with partial payment
- `[ PARTIAL ]` - Partial payment, not overdue
- `[ OVERDUE ]` - Overdue, no payment yet
- `[ SENT ]` - Sent, not paid, not overdue
- `[ PAID ]` - Fully paid

**No edge cases. No ambiguity.**

### 8. Add Payment Dialog Component

**File:** `client/src/components/invoices/AddPaymentDialog.tsx` (new)**Purpose:** Simple dialog for adding payments to sent invoices**Fields:**

- Amount (€) - Number input, required, min 0.01, max = outstanding
- **No date picker for v1** - Payment date auto-set to now() and stored in `lastPaymentAt`
- Optional note (not stored in v1 for ultra-simple approach)

**Validation:**

- Amount must be > 0
- Amount cannot exceed outstanding amount (strict validation - block overpayment)
- Show outstanding amount in dialog for reference
- **No negative outstanding allowed in v1** (credit notes are future feature)

**UI:**

```tsx
<Dialog>
  <DialogTitle>Add Payment</DialogTitle>
  <DialogContent>
    <div>
      <Label>Outstanding: €{outstanding.toFixed(2)}</Label>
    </div>
    <Input type="number" step="0.01" min="0.01" max={outstanding} />
    {/* No date input for v1 - auto-set to now() */}
    <DialogFooter>
      <Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button onClick={handleSubmit} disabled={!isValid}>Add Payment</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**On Submit:**

- Call `addInvoicePayment` mutation
- Auto-set `lastPaymentAt = now()` (if field exists)
- Update `amountPaid += paymentAmount`
- If `amountPaid >= totalAmount`, set `paidAt = now()`
- Update invoice data
- Close dialog
- Show success toast

**Rules:**

- No undo
- No delete payment (v1)
- No partial payment editing (v1)
- Payments are additive only
- Payment date auto-set to now() (no user input for v1)

### 9. Payments Section in Invoice Detail

**File:** `client/src/components/InvoiceUploadReviewDialog.tsx`, `client/src/components/invoices/InvoiceForm.tsx`**New Section (only visible when `sentAt !== null`):**

```tsx
{sentAt && (
  <div className="space-y-4 border-t pt-4">
    <h3 className="font-semibold">Payments</h3>
    <div className="grid grid-cols-3 gap-4">
      <div>
        <Label className="text-muted-foreground">Total</Label>
        <div className="text-lg font-semibold">{formatCurrency(totalAmount)}</div>
      </div>
      <div>
        <Label className="text-muted-foreground">Paid</Label>
        <div className="text-lg font-semibold text-green-600">{formatCurrency(amountPaid)}</div>
      </div>
      <div>
        <Label className="text-muted-foreground">Outstanding</Label>
        <div className="text-lg font-semibold">{formatCurrency(outstanding)}</div>
      </div>
    </div>
    {!paidAt && (
      <Button onClick={() => setAddPaymentOpen(true)}>
        Add Payment
      </Button>
    )}
  </div>
)}
```

**Visibility:**

- Only shown when invoice has been sent (`sentAt !== null`)
- "Add Payment" button only shown when not fully paid (`!paidAt`)

### 10. Overdue Logic (UI-Derived Only)

**Files:** All invoice list and detail views**Derived Logic:**

```typescript
const isOverdue = sentAt !== null && !paidAt && dueDate && new Date(dueDate) < new Date();
const daysOverdue = isOverdue ? Math.floor((new Date() - new Date(dueDate)) / (1000 * 60 * 60 * 24)) : 0;
```

**Where to Show:**

1. **Invoice List Badge:**

- Show OVERDUE badge when `isOverdue === true`
- Red/warning variant

2. **Invoice Detail Warning Banner:**
   ```tsx
                           {isOverdue && (
                             <Alert variant="destructive">
                               <AlertTriangle className="h-4 w-4" />
                               <AlertTitle>Overdue</AlertTitle>
                               <AlertDescription>
                                 This invoice is overdue by {daysOverdue} day{daysOverdue !== 1 ? 's' : ''}.
                               </AlertDescription>
                             </Alert>
                           )}
   ```


**Critical:**

- No cron jobs
- No background tasks
- No stored flags
- Overdue is calculated on-the-fly in UI

### 11. Share Invoice Flow

**When "Send" button is clicked:**

1. Navigate to `/invoices/:id/share` (or open ShareInvoiceDialog)
2. On share page:

- Create share link via `pdf.createShareLink` mutation
- **Auto-mark as sent when share link is created** (no separate button needed)
- Display shareable link with copy button
- Option to set expiry hours
- Show message: "This invoice has now been marked as sent"
- Navigation back to invoice edit page

3. When returning to edit page:

- Invoice already has `sentAt` set (from share link creation)
- UI updates to show "Sent" button instead of "Send"
- Form becomes read-only

**Implementation Rule:** `pdf.createShareLink` mutation should automatically set `sentAt` if null. Creating a share link = functionally sending the invoice.

### 7. Warning System Integration

**Files:** `InvoiceUploadReviewDialog.tsx`, `InvoiceForm.tsx`**Warning Banners:**

- Use `Alert` or `Badge` component from shadcn/ui
- **Simplified Logic:**
- NOT SENT: `!sentAt && !needsReview` (draft invoices)
- NOT PAID: `sentAt && !paidAt` (sent but unpaid invoices)
- Yellow/warning variant styling

**Pattern from InvoicesRubbish.tsx:**

```tsx
<Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">
  NOT SENT
</Badge>
```

Display above form fields, clearly visible.

### 12. State Transition Logic

**Uploaded Invoices Flow (timestamp-driven):**

1. Upload → `needsReview: true` → Review state (Preview only, Save + Cancel)
2. Save → `needsReview: false`, `!sentAt` → Draft state (Send + Preview buttons appear)
3. Send → Navigate to share → Share link created → `sentAt` auto-set → Sent state (read-only, payments section visible)
4. Add Payment → `amountPaid` increases → Partial state (if not fully paid)
5. Add Payment (fully paid) → `amountPaid >= totalAmount` → `paidAt` set → Paid state
6. Revert to Draft → Clear `sentAt` → Back to draft (editable, requires confirmation)
7. Revert to Sent → Clear `paidAt` and `amountPaid` → Back to sent (read-only, requires confirmation)

**Created Invoices Flow:**

- Same as uploaded, but with full form customization
- All fields editable until sent
- Same state logic (timestamps + needsReview + amountPaid)
- Payments section appears after sending

**Partial Payment Flow:**

1. Invoice sent → `sentAt` set, `amountPaid = 0`
2. Add payment → `amountPaid = 400`, `outstanding = 800` → Partial state
3. Add another payment → `amountPaid = 1200`, `outstanding = 0` → `paidAt` set → Paid state

### 13. UI Component Updates

**Button Variants:**

- Send: Primary/highlighted (default variant) - **Lifecycle action (header)**
- Preview: Outline/ghost - **Lifecycle action (header)**
- Sent: Secondary/disabled - **Lifecycle state indicator (header)**
- Paid: Secondary/disabled - **Lifecycle state indicator (header)**
- Save: Default - **Form action (footer)**
- Cancel: Destructive/outline (red) - **Form action (footer)**
- Revert to Draft/Sent: Outline/destructive - **Form action (footer, requires confirmation)**

**Dialog Header (Lifecycle Actions):**

- Flex layout: Title on left, action buttons on right
- **Priority order:** Primary lifecycle button (Send/Sent/Paid) first, Preview second
- **Mobile:** Never wrap unpredictably. If space tight, collapse Preview to icon-only
- **Never hide lifecycle state**

**Dialog Footer (Form Actions):**

- Save, Cancel always present
- Revert actions only when applicable (sent/paid states)
- **Clear separation:** Footer never advances lifecycle, only form edits/reverts

### 14. Revert Confirmation Dialogs

**File:** Update `RevertInvoiceStatusDialog.tsx` or create new component**Enhanced Safeguards:**

- Display invoice number prominently
- Display invoice amount
- Display current status and target status
- **Optional but powerful:** Require typing "REVERT" to confirm (especially for Paid → Not Paid, Sent → Not Sent)
- Checkbox: "I understand the consequences" (required)
- Destructive button styling

**Purpose:** Make reversions feel serious, not casual. Prevents accidental reversions.

### 15. Read-Only State UX

**Files:** `InvoiceUploadReviewDialog.tsx`, `InvoiceForm.tsx`**When form is read-only (`sentAt !== null`):**

- Disable all form fields
- Add subtle overlay or inline note: "This invoice is locked because it has been sent."
- Use muted/disabled styling
- **Purpose:** Reduce confusion, prevent rage clicking, avoid support messages

### 16. Navigation & Routing

**File:** `client/src/App.tsx`**New Route:**

```tsx
<Route path="/invoices/:id/share">
  <DashboardLayout>
    <ShareInvoice />
  </DashboardLayout>
</Route>
```

**Or:** Use dialog/modal approach (no new route needed)

## Implementation Order

1. **Backend Foundation:**

- Add `markAsSent`, `revertToDraft`, `revertToSent` endpoints
- Update `pdf.createShareLink` to auto-set `sentAt` if null
- Add database functions with status derivation (backend-only)

2. **State Logic (Timestamp-Driven):**

- Update UI to derive state from timestamps + needsReview (not status field)
- Implement derived state logic: `if (needsReview) -> REVIEW else if (!sentAt) -> DRAFT...`

3. **Share Invoice Component:**

- Create ShareInvoice page/dialog
- Auto-mark as sent when share link created
- Show confirmation message

4. **UI Updates:**

- Update InvoiceUploadReviewDialog: header buttons (lifecycle), footer buttons (form actions)
- Update InvoiceForm: same pattern
- Remove "Mark as Sent/Paid" from review footer (only Save + Cancel)
- Add read-only overlay/note when sent

5. **Warning System:**

- Add warning banners (NOT SENT: `!sentAt && !needsReview`, NOT PAID: `sentAt && !paidAt`)

6. **Revert Safeguards:**

- Enhance RevertInvoiceStatusDialog with invoice number + amount
- Optional: Require typing "REVERT" for critical reversions

7. **Mobile Optimization:**

- Ensure header buttons don't wrap
- Priority: Primary lifecycle button, then Preview
- Collapse Preview to icon if needed

8. **Testing:**

- Test all state transitions (timestamp-driven)
- Test share flow (auto-mark as sent)
- Test revert confirmations
- Test mobile layouts

## Key Considerations

### Single Source of Truth

- **Timestamps are facts, status is derived** - UI logic keys off `needsReview`, `sentAt`, `paidAt`
- Status field is backend-managed only, never directly written by UI
- Prevents impossible states (e.g., `status='paid'` but `paidAt=null`)

### Partial Payments Design Principles

- **No new invoice statuses explosion** - Keep it simple
- **No payment ledger UI** - v1 is additive only
- **No bank reconciliation** - Future feature
- **Partial payments are additive, not transactional** - Can't edit/delete payments in v1
- **Overdue is derived, never stored** - Calculated on-the-fly in UI
- **No payments table** - Single `amountPaid` field is sufficient
- **No joins** - Everything in invoices table
- **No over-engineering** - Simple, scalable foundation

### Payment Logic

- `paidAt` is set only when `outstanding <= 0` (fully paid)
- Payments are additive: `amountPaid += paymentAmount`
- Payment date auto-set to now() (stored in `lastPaymentAt` if field exists)
- **Block overpayment:** Validate `amount <= outstanding` strictly
- **No negative outstanding in v1** (credit notes are future feature)
- Revert to Sent resets `amountPaid = 0` (for consistency)
- **Revert to Draft only if `amountPaid === 0`** (cannot revert if money received)
- No undo, no delete payment, no partial payment editing (v1)

### Lifecycle vs Form Actions

- **Header = Lifecycle:** Preview, Send/Sent/Paid (advances invoice state)
- **PARTIAL is a badge, NOT a lifecycle button** - Header button remains "Sent" even when partial
- **Footer = Form Actions:** Save, Cancel, Revert (form edits only)
- Footer never advances lifecycle (prevents accidental state changes)
- **Revert to Draft only available if `amountPaid === 0`** (financial integrity protection)

### Share Flow Philosophy

- **Creating share link = sending invoice** - Auto-mark as sent, no separate button
- **Default expiry: 30 days** (configurable)
- **Show expiry date clearly** in UI
- **Allow regeneration** of share link without touching `sentAt` (if link already exists)
- Fewer decisions = calmer UX
- Prevents "shared but not sent" limbo state

### Review State Safety

- **No lifecycle actions in review** - Only Save + Cancel (locked in)
- **No "Mark as Sent" or "Mark as Paid" buttons** in review footer
- Must save first to become draft, then can send
- Payments only happen after sent (paid = result of payments, not a toggle)
- Reduces accidental paid invoices, audit nightmares

### Revert Safeguards

- Display invoice number + amount in confirmation
- Optional: Require typing "REVERT" for critical reversions (Paid → Not Paid, Sent → Not Sent)
- Makes reversions feel serious, not casual

### Read-Only UX

- **Full lock after sent (v1)** - Conservative approach for audit safety
- Clear overlay/note explaining why fields are disabled
- **Lock `dueDate` after sending** (v1)
- Revert flow available if something is wrong
- Later: Can add "Edit non-financial fields (tracked)" if needed
- Reduces confusion, prevents rage clicking, avoids support messages

### Mobile Priority

- Header buttons must not wrap unpredictably
- Priority: Primary lifecycle button (Send/Sent/Partial/Paid) first, Preview second
- If space tight: Collapse Preview to icon, never hide lifecycle state

### Created vs Uploaded

- Created invoices have more editable fields, but same state logic applies
- Both use timestamp-driven + amountPaid state derivation

### What We Are NOT Doing (Intentionally)

- ❌ Payment ledger
- ❌ Multiple payment records
- ❌ Payment deletion
- ❌ Late fees / interest
- ❌ Aging reports
- ❌ Bank sync

All of that can be layered later without breaking this model.

## Testing Checklist

### State Logic (Timestamp-Driven + amountPaid)

- [ ] Review state (`needsReview: true`) shows Preview only, Save + Cancel in footer
- [ ] Draft state (`!sentAt && !needsReview`) shows Send + Preview in header, Save + Cancel in footer
- [ ] Sent state (`sentAt && !paidAt && amountPaid === 0`) shows Sent button, form is read-only, payments section visible
- [ ] Partial state (`sentAt && amountPaid > 0 && !paidAt`) shows Partial button, form is read-only, payments section visible
- [ ] Paid state (`paidAt`) shows Paid button, form is read-only, Revert to Sent in footer
- [ ] State derivation works correctly (not relying on status field directly)
- [ ] Derived values work: `outstanding`, `isPaid`, `isPartial`, `isOverdue`

### Warning System

- [ ] NOT SENT warning appears when `!sentAt && !needsReview`
- [ ] NOT PAID warning appears when `sentAt && !paidAt`
- [ ] Warnings are clearly visible (yellow badges/banners)

### Payment System

- [ ] Payments section visible when `sentAt !== null`
- [ ] Payments section shows: Total, Paid, Outstanding
- [ ] "Add Payment" button visible when `!paidAt`
- [ ] AddPaymentDialog validates amount <= outstanding
- [ ] Adding payment updates `amountPaid` correctly
- [ ] Fully paid invoice sets `paidAt` automatically
- [ ] Partial payment shows PARTIAL badge
- [ ] Revert to Sent resets `amountPaid = 0`

### Badge System

- [ ] OVERDUE badge shows with highest priority (red)
- [ ] PARTIAL badge shows when `amountPaid > 0 && outstanding > 0` (amber)
- [ ] PARTIAL is a badge, NOT a lifecycle button (Sent button remains "Sent")
- [ ] SENT badge shows when sent and not paid/partial
- [ ] PAID badge shows when `paidAt !== null`
- [ ] Badge priority correct: OVERDUE > PARTIAL > SENT/PAID

### Share Flow

- [ ] Send button navigates to share page/dialog
- [ ] Share link creation auto-marks invoice as sent (`sentAt` set)
- [ ] Default expiry 30 days, expiry date shown clearly
- [ ] Share link regeneration allowed without touching `sentAt`
- [ ] Confirmation message shown: "This invoice has now been marked as sent"
- [ ] Returning to edit page shows Sent button, form is read-only, payments section visible

### Revert Actions

- [ ] Revert to Draft shows confirmation with invoice number + amount
- [ ] Revert to Sent shows confirmation with invoice number + amount
- [ ] Optional: Typing "REVERT" required for confirmation
- [ ] Revert enables editing (draft) or keeps read-only (sent)
- [ ] Confirmation checkbox required

### Read-Only State

- [ ] Form fields disabled when `sentAt !== null`
- [ ] Overlay/note explains: "This invoice is locked because it has been sent."
- [ ] No confusion or rage clicking

### Mobile UX

- [ ] Header buttons don't wrap unpredictably
- [ ] Primary lifecycle button (Send/Sent/Paid) prioritized
- [ ] Preview button accessible (icon-only if space tight)
- [ ] Footer buttons stack properly on mobile

### Edge Cases

- [ ] Cancel button deletes if `needsReview`, closes otherwise
- [ ] Created invoices have same state logic but more editable fields
- [ ] Impossible states prevented (status derived from timestamps + amountPaid)
- [ ] Payment amount cannot exceed outstanding (overpayment blocked)
- [ ] Multiple payments accumulate correctly
- [ ] Payment date auto-set to now() (no user input for v1)
- [ ] `lastPaymentAt` field updated when payment added
- [ ] Overdue calculation handles null dueDate correctly (returns false if null)
- [ ] Partial payment state transitions correctly to paid