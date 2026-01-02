# Expenses Module — Complete Debugging & Improvement Guide

**Version:** Phase 1 Foundation  
**Last Updated:** 2024-12-17  
**Status:** ✅ Core Features Complete (OCR Not Implemented)

---

## 📋 Quick Reference

### Key Files
- **Backend Router:** `server/expenseRouter.ts` (880 lines)
- **Database Schema:** `drizzle/schema.ts` (lines 708-787)
- **Database Queries:** `server/db.ts` (lines 1795-1995+)
- **Frontend List:** `client/src/pages/Expenses.tsx`
- **Frontend Detail:** `client/src/pages/ExpenseDetail.tsx`
- **Main Form:** `client/src/components/expenses/ExpenseForm.tsx`

### Supporting Modules
- **Suggestion Engine:** `server/expenses/suggestionEngine.ts`
- **Autofill Engine:** `server/expenses/autofillEngine.ts`
- **Filename Parser:** `server/expenses/filenameParser.ts`
- **Proposed Fields:** `server/expenses/proposedFields.ts`
- **Confidence Calculator:** `server/expenses/confidence.ts`

---

## 🏗️ Architecture Overview

### Tech Stack
- **Backend:** Node.js + Express + tRPC
- **Database:** MySQL via Drizzle ORM
- **Storage:** AWS S3 (presigned URLs)
- **Frontend:** React 18 + TypeScript + Vite
- **UI:** Tailwind CSS + shadcn/ui

### Data Flow

```
User Action
    ↓
Frontend Component (React)
    ↓
tRPC Client (`trpc.expenses.*`)
    ↓
tRPC Router (`expenseRouter.ts`)
    ↓
Database Layer (`db.ts`)
    ↓
MySQL Database
```

### File Upload Flow

```
1. Client calls `uploadExpenseReceipt` → Gets presigned PUT URL
2. Client uploads directly to S3 using PUT URL
3. Client calls `registerReceipt` → Creates DB record
4. Autofill engine runs (if first receipt)
5. File appears in expense detail view
```

---

## 📊 Database Schema

### `expenses` Table

**Primary Fields:**
- `id` (INT, PK, auto-increment)
- `createdBy` (INT, FK → users.id)
- `updatedByUserId` (INT, FK → users.id, nullable)
- `status` (ENUM: `'needs_review'`, `'in_order'`, `'void'`, default: `'needs_review'`)
- `source` (ENUM: `'upload'`, `'scan'`, `'manual'`)

**Accounting Fields:**
- `supplierName` (VARCHAR(255), required)
- `description` (TEXT, nullable)
- `expenseDate` (DATE, required)
- `grossAmountCents` (INT, required)
- `currency` (CHAR(3), default: `'EUR'`)
- `vatMode` (ENUM: `'none'`, `'german'`, `'foreign'`, default: `'none'`)
- `vatRate` (ENUM: `'0'`, `'7'`, `'19'`, nullable)
- `vatAmountCents` (INT, nullable)
- `businessUsePct` (INT, 0-100, default: 100)
- `category` (ENUM: 17 categories, nullable)

**Status Tracking:**
- `reviewedByUserId` (INT, FK → users.id, nullable)
- `reviewedAt` (DATETIME, nullable)
- `voidedByUserId` (INT, FK → users.id, nullable)
- `voidedAt` (DATETIME, nullable)
- `voidReason` (ENUM: `'duplicate'`, `'personal'`, `'mistake'`, `'wrong_document'`, `'other'`, nullable)
- `voidNote` (TEXT, nullable)

**Payment Fields (Informational Only):**
- `paymentStatus` (ENUM: `'paid'`, `'unpaid'`, default: `'unpaid'`)
- `paymentDate` (DATE, nullable)
- `paymentMethod` (ENUM: `'cash'`, `'bank_transfer'`, `'card'`, `'online'`, nullable)

**OCR Fields (Not Currently Used):**
- `confidenceScore` (FLOAT, nullable)
- `confidenceReason` (VARCHAR(255), nullable)

**Timestamps:**
- `createdAt` (DATETIME, auto)
- `updatedAt` (DATETIME, auto-update)

**Indexes:**
- `expenses_createdBy_status_expenseDate_idx` (createdBy, status, expenseDate)
- `expenses_createdBy_expenseDate_idx` (createdBy, expenseDate)
- `expenses_updatedByUserId_idx` (updatedByUserId)

### `expense_files` Table

- `id` (INT, PK, auto-increment)
- `expenseId` (INT, FK → expenses.id, CASCADE DELETE)
- `s3Key` (VARCHAR(512))
- `mimeType` (VARCHAR(128))
- `originalFilename` (VARCHAR(255))
- `fileSize` (INT)
- `createdAt` (DATETIME, auto)

**Index:**
- `expense_files_expenseId_idx` (expenseId)

---

## 🔌 API Endpoints (tRPC)

All endpoints are under `trpc.expenses.*` and require authentication via `protectedProcedure`.

### `list`
**Input:** `{ statusFilter?: "needs_review" | "in_order" | "void", includeVoid?: boolean }`  
**Output:** Array of expenses with `receiptCount` and `reviewMeta` (for needs_review expenses)  
**Notes:** 
- Excludes void expenses by default
- For `needs_review` expenses, includes `reviewMeta` with proposed fields, overall score, and missing required fields
- Calculates receipt counts per expense

### `getExpense`
**Input:** `{ id: number }`  
**Output:** Expense with `files[]` (presigned GET URLs), `suggestions`, `autofilledFields[]`  
**Notes:**
- Always includes `files` array (even if empty)
- Presigned URLs expire in 1 hour
- Suggestions are computed fresh on each call
- `autofilledFields` indicates which fields were auto-filled from receipt

### `createManualExpense`
**Input:** Full expense data (category required)  
**Output:** Created expense  
**Notes:**
- Always creates with `status: "needs_review"`
- Validates VAT/currency rules (German VAT requires EUR)

### `updateExpense`
**Input:** Partial expense data  
**Output:** Updated expense  
**Critical Behavior:**
- **Payment fields** (`paymentStatus`, `paymentDate`, `paymentMethod`) never affect status
- **Accounting fields** (`supplierName`, `expenseDate`, `grossAmountCents`, `currency`, `vatMode`, `vatRate`, `vatAmountCents`, `businessUsePct`, `category`) reset status to `needs_review` if currently `in_order`

### `applyProposedFields`
**Input:** `{ id: number, fields: { ... } }`  
**Output:** Updated expense  
**Notes:**
- Used by review lane to apply suggested fields
- Does NOT change status
- Only applies provided fields

### `setExpenseStatus`
**Input:** `{ id: number, status: "...", voidReason?: "...", voidNote?: string }`  
**Output:** Updated expense  
**Rules:**
- `in_order`: Requires `supplierName`, `expenseDate`, `grossAmountCents`, `category`
- `void`: Only allowed if current status is `in_order` + `voidReason` required
- Sets audit trail fields (`reviewedByUserId`, `reviewedAt`, etc.)

### `deleteExpense`
**Input:** `{ id: number }`  
**Output:** `{ success: boolean }`  
**Rules:**
- Only allowed if `status === "needs_review"`
- Cascades to `expense_files` (CASCADE DELETE)
- Best-effort S3 cleanup (errors logged, don't fail)

### `uploadExpenseReceipt`
**Input:** `{ expenseId, filename, mimeType, fileSize }`  
**Output:** `{ uploadUrl: string, s3Key: string }`  
**Notes:**
- Returns presigned PUT URL (15 minutes expiry)
- Max file size: 15MB
- Allowed MIME types: PDF, JPEG, PNG, HEIC, HEIF, WEBP
- S3 key pattern: `expenses/{expenseId}/{yyyyMMdd-HHmmss}-{safeFilename}`

### `registerReceipt`
**Input:** `{ expenseId, s3Key, mimeType, originalFilename, fileSize }`  
**Output:** Created `expense_files` record  
**Notes:**
- Call this AFTER uploading to presigned URL
- If first receipt, triggers autofill engine

### `getReceiptUrl`
**Input:** `{ fileId: number }`  
**Output:** `{ url: string, file: ExpenseFile }`  
**Notes:**
- Returns presigned GET URL (1 hour expiry)

### `deleteExpenseFile`
**Input:** `{ id: number }`  
**Output:** `{ success: boolean }`  
**Notes:**
- Best-effort S3 cleanup

### `getExpenseFiles`
**Input:** `{ expenseId: number }`  
**Output:** Array of `expense_files` records

### `uploadReceiptsBulk`
**Input:** `{ files: Array<{ filename, mimeType, fileSize, base64Data }> }` (max 10)  
**Output:** `{ createdExpenseIds: number[], errors?: Array<{ filename, error }> }`  
**Notes:**
- Creates one expense per file
- All expenses start with `status: "needs_review"`
- Partial failures don't abort batch
- Uses filename parsing for initial values

### `processReceipt`
**Input:** `{ expenseId: number, fileId: number }`  
**Output:** ❌ **NOT_IMPLEMENTED** (throws error)  
**Notes:**
- Placeholder for future OCR integration

---

## 🧠 Suggestion & Autofill System

### Suggestion Engine (`server/expenses/suggestionEngine.ts`)

**Purpose:**** Proposes (but never applies) values for category, VAT mode, and business use percentage.

**Rules (Priority Order):**

1. **Rule A: Supplier Memory** (Highest Priority)
   - Queries last 5 expenses with same supplier name (case-insensitive)
   - Suggests values from most recent expense
   - Confidence: `0.8 + (history.length * 0.05)`, max `0.95`
   - Applies to: `category`, `vatMode`, `businessUsePct`

2. **Rule B: Keyword Matching**
   - Extracts keywords from `supplierName` and receipt filenames
   - Matches against keyword dictionary (amazon → equipment, hotel → travel, etc.)
   - Confidence: `0.6` (single) or `0.7` (multiple)
   - Applies to: `category`

3. **Rule C: Category → VAT Heuristic**
   - If `currency === "EUR"` and category is `"meals"`, `"travel"`, or `"rent"`: suggest `vatMode: "german"`
   - Confidence: `0.6`
   - Applies to: `vatMode`

4. **Rule D: Currency Guard** (Absolute Priority for VAT)
   - If `currency !== "EUR"`: suggest `vatMode: "foreign"`
   - Confidence: `1.0` (overrides all other VAT suggestions)
   - Applies to: `vatMode`

**Conflict Resolution:**
- For each field, choose suggestion with highest confidence
- Currency guard always wins for VAT (confidence 1.0)

### Autofill Engine (`server/expenses/autofillEngine.ts`)

**Purpose:** Automatically fills expense fields when first receipt is uploaded.

**Trigger:** When `registerReceipt` is called and it's the first receipt for the expense.

**Process:**
1. Parses filename for initial values (via `filenameParser.ts`)
2. Applies autofill suggestions (via `suggestionEngine.ts`)
3. Updates expense in database

**Note:** Autofill is best-effort (errors logged, don't fail the upload).

### Filename Parser (`server/expenses/filenameParser.ts`)

**Purpose:** Extracts expense data from receipt filenames.

**Patterns Supported:**
- Date formats: `YYYY-MM-DD`, `YYYYMMDD`, etc.
- Amount formats: `€12.50`, `12,50 EUR`, etc.
- Supplier name extraction

### Proposed Fields (`server/expenses/proposedFields.ts`)

**Purpose:** Generates proposed field values for review lane.

**Uses:**
- Suggestion engine
- Filename parser
- Confidence calculator

### Confidence Calculator (`server/expenses/confidence.ts`)

**Purpose:** Calculates overall confidence score and identifies missing required fields.

**Functions:**
- `calculateOverallScore(expense, proposedFields)`: Returns 0-100 score
- `getMissingRequiredFields(expense)`: Returns array of missing field names

---

## 🎨 Frontend Components

### Pages

#### `Expenses.tsx` (List View)
**Route:** `/expenses`

**Features:**
- Header cards: deductible costs (year and current quarter)
- Two sections: "Needs Review" and "In Order"
- Excludes void expenses by default
- Keyboard shortcuts:
  - `Enter`: Edit first expense in Needs Review
  - `I`: Mark first expense as In Order
  - `Arrow Up/Down`: Navigate between expenses
  - `A`: Apply all suggestions (if 2+ available)
- Floating action button (FAB) for quick capture
- Bulk upload dialog
- Sticky review actions (when expense expanded)

**State:**
- Uses `trpc.expenses.list.useQuery()`
- Calculates deductible amounts client-side
- Manages expanded expense state

#### `ExpenseDetail.tsx` (Detail/Edit View)
**Route:** `/expenses/:id` or `/expenses/new`

**Features:**
- Full expense form
- Receipt upload and management
- AI suggestions display
- Actions: Save, Mark as In Order, Void, Delete
- Keyboard shortcut: `Cmd/Ctrl + Enter` to save
- Auto-navigation to next expense after marking as in_order

**State:**
- Uses `trpc.expenses.getExpense.useQuery()` for existing expenses
- Separate mutations for create, update, status changes, file operations

#### `ScanReceipt.tsx` (Mobile Scanner)
**Route:** `/expenses/scan?expenseId={id}`

**Features:**
- Mobile-first camera capture (`<input type="file" capture="environment" />`)
- Client-side document scanning (grayscale + contrast enhancement)
- Corner adjustment UI
- Preview before upload
- Redirects to expense detail after upload

### Components

#### `ExpenseForm.tsx`
**Props:**
- `initialData`, `files`, `suggestions`
- `onSave`, `onAcceptSuggestion`, `onMarkInOrder`, `onVoid`, `onDelete`
- `onReceiptUpload`, `onReceiptDelete`, `onReceiptView`

**Features:**
- Form fields: description, category, gross amount, currency, business use %
- Deductible amount calculation (display only)
- Payment information (informational only)
- Receipt upload zone (drag-and-drop)
- Receipt preview list
- Suggestion badges and controls
- "Accept all suggestions" button (when 2+ suggestions available)

#### `ExpenseCard.tsx`
**Props:**
- `expense`, `onAction`, `showVoid`

**Features:**
- Displays expense summary
- Status badge
- Gross amount and deductible amount
- Business use percentage
- Receipt count badge
- Actions menu (Edit, Mark as In Order, Void)

#### `ReviewExpenseCard.tsx`
**Props:**
- `expense` (with `reviewMeta`), `onAction`, `onApplyField`, `onApplyAll`, `onMarkInOrder`

**Features:**
- Expanded view for needs_review expenses
- Shows proposed fields with confidence badges
- Apply individual field or all fields
- Missing required fields indicator
- Overall confidence score

#### `StickyReviewActions.tsx`
**Props:**
- `expense`, `onApplyAll`, `onMarkInOrder`

**Features:**
- Sticky bottom bar when expense is expanded
- Quick actions: Apply All, Mark as In Order
- Shows proposed count and missing required count

#### Other Components
- `CategorySelect.tsx`: Category dropdown
- `CurrencySelect.tsx`: Currency selector
- `ReceiptUploadZone.tsx`: Drag-and-drop upload
- `ReceiptPreviewList.tsx`: Receipt thumbnails
- `SuggestionBadge.tsx`: Suggestion UI with confidence
- `SuggestionControls.tsx`: Accept/dismiss buttons
- `VoidExpenseDialog.tsx`: Void confirmation
- `BulkUploadDialog.tsx`: Bulk upload UI
- `CaptureFab.tsx`: Floating action button
- `CornerAdjuster.tsx`: Receipt corner adjustment

---

## 🔄 Business Rules & Workflows

### Status Transitions

```
needs_review → in_order (requires: supplierName, expenseDate, grossAmountCents, category)
in_order → void (requires: voidReason)
void → (cannot transition, hidden from list)
needs_review → (can be deleted)
```

### Accounting Fields

Fields that affect deductibility:
- `supplierName`
- `expenseDate`
- `grossAmountCents`
- `currency`
- `vatMode`
- `vatRate`
- `vatAmountCents`
- `businessUsePct`
- `category`

**Rule:** Changes to accounting fields reset status to `needs_review` if currently `in_order`.

### Payment Fields

Informational only (never affect status):
- `paymentStatus`
- `paymentDate`
- `paymentMethod`

### VAT Rules

1. **German VAT** (`vatMode: "german"`):
   - Requires `currency === "EUR"`
   - Valid `vatRate`: `"0"`, `"7"`, `"19"`

2. **Foreign VAT** (`vatMode: "foreign"`):
   - Used for non-EUR currencies
   - `vatRate` can be null

3. **No VAT** (`vatMode: "none"`):
   - Default for new expenses
   - `vatRate` and `vatAmountCents` should be null

### Access Control

- **Ownership-based:** Users can only access expenses they created
- **Admin override:** Admin users can access all expenses
- **Validation:** All endpoints check ownership before operations

---

## 🐛 Common Issues & Debugging

### Issue: Expense status not updating

**Check:**
1. Is the expense in `in_order` status? (Accounting field changes reset to `needs_review`)
2. Are required fields present? (`supplierName`, `expenseDate`, `grossAmountCents`, `category`)
3. Check `server/db.ts` `updateExpense()` function (line 1909)
4. Check `server/db.ts` `setExpenseStatus()` function (line 1940)

### Issue: Receipt upload failing

**Check:**
1. File size < 15MB?
2. MIME type allowed? (PDF, JPEG, PNG, HEIC, HEIF, WEBP)
3. Presigned URL expired? (15 minutes for PUT, 1 hour for GET)
4. S3 credentials configured? (`server/storage.ts`)
5. Check `server/expenseRouter.ts` `uploadExpenseReceipt()` (line 572)

### Issue: Suggestions not appearing

**Check:**
1. Is expense in `needs_review` status?
2. Does expense have files?
3. Check `server/expenses/suggestionEngine.ts`
4. Check `server/expenseRouter.ts` `getExpense()` (line 336) - suggestions computed fresh
5. Check browser console for errors

### Issue: Autofill not working

**Check:**
1. Is this the first receipt for the expense?
2. Check `server/expenses/autofillEngine.ts`
3. Check `server/expenseRouter.ts` `registerReceipt()` (line 616) - autofill runs here
4. Check server logs for autofill errors (logged but don't fail)

### Issue: Bulk upload partial failures

**Check:**
1. Each file processed independently (partial failures don't abort batch)
2. Check `server/expenseRouter.ts` `uploadReceiptsBulk()` (line 752)
3. Check return value: `{ createdExpenseIds, errors? }`
4. Errors logged per file, continue processing

### Issue: Expense not appearing in list

**Check:**
1. Is expense void? (Excluded by default)
2. Check `includeVoid` parameter in `list` query
3. Check `server/db.ts` `listExpensesByUser()` (line 1845)
4. Check user ownership (users only see their own expenses, admins see all)

### Issue: S3 cleanup failures

**Check:**
1. S3 cleanup is best-effort (errors logged, don't fail operations)
2. Check server logs for S3 errors
3. Check `server/storage.ts` `deleteFromStorage()`
4. Manual cleanup may be needed if files orphaned

### Issue: Status transition blocked

**Check:**
1. `in_order` → `void`: Requires current status is `in_order` + `voidReason`
2. `needs_review` → `in_order`: Requires `supplierName`, `expenseDate`, `grossAmountCents`, `category`
3. Check `server/db.ts` `setExpenseStatus()` (line 1940)
4. Check `server/expenseRouter.ts` `setExpenseStatus()` (line 511)

---

## 🧪 Testing Checklist

### Manual Testing

- [ ] Create manual expense
- [ ] Bulk upload receipts
- [ ] Scan receipt (mobile)
- [ ] Edit expense (accounting fields)
- [ ] Edit expense (payment fields)
- [ ] Mark as in order
- [ ] Void expense
- [ ] Delete expense (needs_review only)
- [ ] Accept suggestion
- [ ] Dismiss suggestion
- [ ] Upload receipt to existing expense
- [ ] Delete receipt
- [ ] View receipt
- [ ] Access control (user can't access other user's expenses)
- [ ] Admin access (admin can access all expenses)

### Edge Cases

- [ ] Empty expense list
- [ ] Expense with no receipts
- [ ] Expense with multiple receipts
- [ ] Very long supplier name
- [ ] Very large receipt file (near 15MB limit)
- [ ] Invalid file type upload
- [ ] Network error during upload
- [ ] S3 cleanup failure (should not fail expense delete)
- [ ] Status transition with missing required fields
- [ ] Accounting field change on `in_order` expense (should reset to `needs_review`)

---

## 🚀 Known Limitations

### 1. OCR Not Implemented
- `processReceipt` endpoint throws `NOT_IMPLEMENTED`
- No automatic extraction of amount, date, supplier from receipts
- Manual entry required for all fields
- `confidenceScore` and `confidenceReason` fields exist but not populated

### 2. No Multi-Currency Support in Calculations
- Deductible calculations assume single currency
- No currency conversion

### 3. No Export/Import
- No DATEV CSV export
- No bulk import from CSV/Excel

### 4. No Recurring Expenses
- No template system
- No scheduled expense creation

### 5. No Project/Job Linking
- Expenses are standalone (not linked to projects/jobs)
- No expense allocation to projects

### 6. No Tax Report Generation
- No automatic tax report PDFs
- No quarterly/yearly summaries

### 7. Limited Suggestion Engine
- Keyword dictionary is small
- No ML-based suggestions
- No receipt image analysis

### 8. No Receipt OCR Confidence Display
- `confidenceScore` and `confidenceReason` fields exist but not populated
- No UI to show OCR confidence

### 9. No Pagination
- Expense list loads all expenses (could be slow with many expenses)

### 10. No Caching
- Suggestions computed fresh on each call
- No caching of expense lists

---

## 🔮 Future Enhancements

### Phase 2: OCR Integration
- [ ] Integrate OCR service (AWS Textract, Google Vision, etc.)
- [ ] Extract: amount, date, supplier, VAT from receipts
- [ ] Auto-populate expense fields
- [ ] Display OCR confidence scores
- [ ] Manual correction UI for OCR errors

### Phase 3: Advanced Features
- [ ] DATEV CSV export
- [ ] Tax report PDF generation
- [ ] Recurring expense templates
- [ ] Project/job expense allocation
- [ ] Multi-currency support with conversion
- [ ] Expense approval workflow (multi-user)
- [ ] Receipt duplicate detection
- [ ] Expense categories customization
- [ ] Custom VAT rates
- [ ] Expense tags/labels
- [ ] Search and filters (date range, category, amount, etc.)
- [ ] Expense analytics dashboard

### Phase 4: Mobile App
- [ ] Native mobile app (Capacitor)
- [ ] Offline expense creation
- [ ] Offline receipt capture
- [ ] Sync when online
- [ ] Push notifications for reminders

---

## 📝 Code Quality Notes

### Strengths
✅ **Type Safety:** Full TypeScript with Zod validation  
✅ **Error Handling:** Comprehensive error messages  
✅ **Audit Trail:** All changes tracked with user IDs and timestamps  
✅ **Access Control:** Ownership-based with admin override  
✅ **Status Workflow:** Strict rules enforced  
✅ **Suggestion Engine:** Pure, stateless, explainable  
✅ **File Management:** Presigned URLs, proper cleanup  
✅ **Mobile-First:** Receipt scanning optimized for mobile  

### Areas for Improvement
⚠️ **OCR Integration:** Not implemented (placeholder endpoint)  
⚠️ **Testing:** No automated tests (manual testing only)  
⚠️ **Error Recovery:** S3 cleanup failures are logged but don't fail operations  
⚠️ **Suggestion Engine:** Keyword dictionary is small, no ML  
⚠️ **Performance:** No pagination for expense list (could be slow with many expenses)  
⚠️ **Caching:** No caching of suggestions or expense lists  

---

## 🔍 Debugging Commands

### Database Queries

```sql
-- Get all expenses for a user
SELECT * FROM expenses WHERE createdBy = ? ORDER BY expenseDate DESC;

-- Get expenses by status
SELECT * FROM expenses WHERE createdBy = ? AND status = 'needs_review';

-- Get expense with files
SELECT e.*, COUNT(ef.id) as receiptCount
FROM expenses e
LEFT JOIN expense_files ef ON e.id = ef.expenseId
WHERE e.id = ?
GROUP BY e.id;

-- Check for orphaned S3 files
SELECT ef.* FROM expense_files ef
LEFT JOIN expenses e ON ef.expenseId = e.id
WHERE e.id IS NULL;
```

### Server Logs

Check for:
- `[Expenses]` prefixed log messages
- Autofill errors (logged but don't fail)
- S3 cleanup errors (logged but don't fail)
- Suggestion engine errors

### Frontend Debugging

- Check browser console for tRPC errors
- Check React DevTools for component state
- Check Network tab for failed API calls
- Check Application tab for presigned URL expiry

---

## 📚 Additional Resources

- **Full Documentation:** `EXPENSES_MODULE_DOCUMENTATION.md`
- **Database Migration:** `drizzle/0018_add_expenses_module.sql`
- **Main Router:** `server/routers.ts` (expenses router registered here)

---

## ❓ Questions for Review

1. **OCR Integration:** What OCR service should we use? AWS Textract, Google Vision, or other?
2. **Performance:** Should we add pagination to the expense list?
3. **Export:** Should we prioritize DATEV CSV export or tax report PDFs?
4. **Project Linking:** Should expenses be linkable to projects/jobs?
5. **Multi-User:** Should we add expense approval workflow for teams?
6. **Suggestion Engine:** Should we invest in ML-based suggestions or expand keyword dictionary?
7. **Mobile App:** Should we prioritize native mobile app or improve PWA?
8. **Testing:** Should we add automated tests (unit, integration, E2E)?

---

**Document Version:** 1.0  
**Last Updated:** 2024-12-17  
**Maintained By:** Development Team

