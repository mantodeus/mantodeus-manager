# Expenses Module — Complete Documentation

**Version:** Phase 1 Foundation  
**Last Updated:** 2024-12-17  
**Status:** ✅ Implemented (Core Features Complete)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [API Endpoints (tRPC)](#api-endpoints-trpc)
5. [Frontend Components](#frontend-components)
6. [Features & Workflows](#features--workflows)
7. [Business Rules](#business-rules)
8. [Suggestion Engine](#suggestion-engine)
9. [File Management](#file-management)
10. [Known Limitations](#known-limitations)
11. [Future Enhancements](#future-enhancements)

---

## Overview

The Expenses Module is a comprehensive expense tracking system designed for self-employed rope access technicians and small businesses. It provides:

- **Receipt Management**: Upload, scan, and attach receipts to expenses
- **Status Workflow**: Three-state system (needs_review → in_order → void)
- **Smart Suggestions**: AI-powered suggestions for category, VAT mode, and business use percentage
- **German Tax Compliance**: Support for VAT modes (none, german, foreign) and business use tracking
- **Bulk Operations**: Upload multiple receipts at once
- **Mobile-First**: Receipt scanning with camera capture

### Key Design Principles

1. **Status-Driven Workflow**: Expenses flow through a strict status lifecycle
2. **Audit Trail**: All changes tracked with user IDs and timestamps
3. **Ownership-Based Access**: Users can only access their own expenses (admins see all)
4. **Payment Fields Are Informational**: Payment status never affects deductibility or status
5. **Accounting Fields Trigger Review**: Changes to accounting fields reset status to `needs_review`

---

## Architecture

### Tech Stack

- **Backend**: Node.js + Express + tRPC
- **Database**: MySQL (via Drizzle ORM)
- **Storage**: AWS S3 (presigned URLs)
- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui

### File Structure

```
server/
├── expenseRouter.ts          # Main tRPC router
├── expenses/
│   └── suggestionEngine.ts   # AI suggestion logic
└── db.ts                     # Database queries

client/src/
├── pages/
│   ├── Expenses.tsx          # List view
│   ├── ExpenseDetail.tsx     # Detail/edit view
│   └── ScanReceipt.tsx        # Mobile receipt scanner
└── components/expenses/
    ├── ExpenseForm.tsx        # Main form component
    ├── ExpenseCard.tsx        # List card component
    ├── CategorySelect.tsx     # Category dropdown
    ├── CurrencySelect.tsx     # Currency selector
    ├── ReceiptUploadZone.tsx # Drag-and-drop upload
    ├── ReceiptPreviewList.tsx # Receipt thumbnails
    ├── SuggestionBadge.tsx    # Suggestion UI
    ├── SuggestionControls.tsx # Accept/dismiss buttons
    ├── VoidExpenseDialog.tsx  # Void confirmation
    ├── BulkUploadDialog.tsx   # Bulk upload UI
    ├── CaptureFab.tsx         # Floating action button
    └── CornerAdjuster.tsx     # Receipt corner adjustment

drizzle/
└── 0018_add_expenses_module.sql  # Migration file
```

---

## Database Schema

### `expenses` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT | Primary key (auto-increment) |
| `createdBy` | INT | User who created the expense (FK → users.id) |
| `updatedByUserId` | INT | Last user who updated (FK → users.id) |
| `status` | ENUM | `'needs_review'`, `'in_order'`, `'void'` (default: `'needs_review'`) |
| `source` | ENUM | `'upload'`, `'scan'`, `'manual'` |
| `supplierName` | VARCHAR(255) | Supplier/vendor name (required) |
| `description` | TEXT | Expense description (optional) |
| `expenseDate` | DATE | Date of expense (required) |
| `grossAmountCents` | INT | Gross amount in cents (required) |
| `currency` | CHAR(3) | ISO currency code (default: `'EUR'`) |
| `vatMode` | ENUM | `'none'`, `'german'`, `'foreign'` (default: `'none'`) |
| `vatRate` | ENUM | `'0'`, `'7'`, `'19'` (nullable) |
| `vatAmountCents` | INT | VAT amount in cents (nullable) |
| `businessUsePct` | INT | Business use percentage 0-100 (default: 100) |
| `category` | ENUM | See categories below (nullable) |
| `reviewedByUserId` | INT | User who marked as in_order (FK → users.id) |
| `reviewedAt` | DATETIME | When marked as in_order |
| `voidedByUserId` | INT | User who voided (FK → users.id) |
| `voidedAt` | DATETIME | When voided |
| `voidReason` | ENUM | `'duplicate'`, `'personal'`, `'mistake'`, `'wrong_document'`, `'other'` |
| `voidNote` | TEXT | Optional void explanation |
| `paymentStatus` | ENUM | `'paid'`, `'unpaid'` (default: `'unpaid'`) |
| `paymentDate` | DATE | When payment was made (nullable) |
| `paymentMethod` | ENUM | `'cash'`, `'bank_transfer'`, `'card'`, `'online'` (nullable) |
| `confidenceScore` | FLOAT | OCR confidence (0.0-1.0, nullable) |
| `confidenceReason` | VARCHAR(255) | OCR confidence explanation (nullable) |
| `createdAt` | DATETIME | Creation timestamp |
| `updatedAt` | DATETIME | Last update timestamp |

**Indexes:**
- `expenses_createdBy_status_expenseDate_idx` (createdBy, status, expenseDate)
- `expenses_createdBy_expenseDate_idx` (createdBy, expenseDate)
- `expenses_updatedByUserId_idx` (updatedByUserId)

### `expense_files` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT | Primary key (auto-increment) |
| `expenseId` | INT | Foreign key → expenses.id (CASCADE DELETE) |
| `s3Key` | VARCHAR(512) | S3 object key |
| `mimeType` | VARCHAR(128) | File MIME type |
| `originalFilename` | VARCHAR(255) | Original filename |
| `fileSize` | INT | File size in bytes |
| `createdAt` | DATETIME | Upload timestamp |

**Indexes:**
- `expense_files_expenseId_idx` (expenseId)

### Expense Categories

```typescript
type ExpenseCategory =
  | "office_supplies"
  | "travel"
  | "meals"
  | "vehicle"
  | "equipment"
  | "software"
  | "insurance"
  | "marketing"
  | "utilities"
  | "rent"
  | "professional_services"
  | "shipping"
  | "training"
  | "subscriptions"
  | "repairs"
  | "taxes_fees"
  | "other";
```

---

## API Endpoints (tRPC)

All endpoints are under `trpc.expenses.*` and require authentication.

### `list`

**Input:**
```typescript
{
  statusFilter?: "needs_review" | "in_order" | "void";
  includeVoid?: boolean; // default: false
}
```

**Output:** Array of expenses with `receiptCount` field

**Description:** Lists expenses for the current user. Excludes void expenses by default.

---

### `getExpense`

**Input:**
```typescript
{
  id: number;
}
```

**Output:** Expense object with:
- `files`: Array of receipt files with presigned `previewUrl` (GET URLs, 1 hour expiry)
- `suggestions`: Object with category, vatMode, businessUsePct suggestions

**Description:** Gets a single expense by ID. Always includes `files` array (even if empty). Includes AI suggestions.

---

### `createManualExpense`

**Input:**
```typescript
{
  supplierName: string; // min 1 char
  description?: string | null;
  expenseDate: Date;
  grossAmountCents: number; // positive integer
  currency?: string; // default: "EUR", length 3
  vatMode?: "none" | "german" | "foreign"; // default: "none"
  vatRate?: "0" | "7" | "19" | null;
  vatAmountCents?: number | null; // non-negative
  businessUsePct?: number; // 0-100, default: 100
  category: ExpenseCategory; // required
  paymentStatus?: "paid" | "unpaid"; // default: "unpaid"
  paymentDate?: Date | null;
  paymentMethod?: "cash" | "bank_transfer" | "card" | "online" | null;
}
```

**Output:** Created expense object

**Description:** Creates a manual expense entry. Always starts with `status: "needs_review"`.

**Validation:**
- German VAT requires EUR currency
- VAT/currency rules validated

---

### `updateExpense`

**Input:**
```typescript
{
  id: number;
  supplierName?: string; // min 1 char
  description?: string | null;
  expenseDate?: Date;
  grossAmountCents?: number; // positive
  currency?: string; // length 3
  vatMode?: "none" | "german" | "foreign";
  vatRate?: "0" | "7" | "19" | null;
  vatAmountCents?: number | null; // non-negative
  businessUsePct?: number; // 0-100
  category?: ExpenseCategory;
  paymentStatus?: "paid" | "unpaid";
  paymentDate?: Date | null;
  paymentMethod?: "cash" | "bank_transfer" | "card" | "online" | null;
}
```

**Output:** Updated expense object

**Description:** Updates an expense. **Important behavior:**
- Payment field edits (`paymentStatus`, `paymentDate`, `paymentMethod`) never affect status
- Accounting field changes (`supplierName`, `expenseDate`, `grossAmountCents`, `currency`, `vatMode`, `vatRate`, `vatAmountCents`, `businessUsePct`, `category`) reset status to `needs_review` if currently `in_order`

**Validation:**
- German VAT requires EUR currency
- Category must be valid enum value

---

### `setExpenseStatus`

**Input:**
```typescript
{
  id: number;
  status: "needs_review" | "in_order" | "void";
  voidReason?: "duplicate" | "personal" | "mistake" | "wrong_document" | "other";
  voidNote?: string | null;
}
```

**Output:** Updated expense object

**Description:** Changes expense status.

**Rules:**
- Setting to `in_order`: Requires `supplierName`, `expenseDate`, `grossAmountCents`, and `category`
- Setting to `void`: Only allowed if current status is `in_order` + `voidReason` required
- Setting to `needs_review`: Clears review fields

**Audit Trail:**
- `in_order`: Sets `reviewedByUserId` and `reviewedAt`
- `void`: Sets `voidedByUserId`, `voidedAt`, `voidReason`, `voidNote`

---

### `deleteExpense`

**Input:**
```typescript
{
  id: number;
}
```

**Output:**
```typescript
{
  success: boolean;
}
```

**Description:** Deletes an expense and all associated receipt files from S3.

**Rules:**
- Only allowed if `status === "needs_review"`
- Cascades to `expense_files` (CASCADE DELETE)
- Best-effort S3 cleanup (errors logged, don't fail)

---

### `uploadExpenseReceipt`

**Input:**
```typescript
{
  expenseId: number;
  filename: string; // min 1 char
  mimeType: string;
  fileSize: number; // positive integer
}
```

**Output:**
```typescript
{
  uploadUrl: string; // Presigned PUT URL (15 minutes expiry)
  s3Key: string;
}
```

**Description:** Generates a presigned upload URL for direct S3 upload.

**Validation:**
- Max file size: 15MB
- Allowed MIME types: `application/pdf`, `image/jpeg`, `image/jpg`, `image/png`, `image/heic`, `image/heif`, `image/webp`

**S3 Key Pattern:** `expenses/{expenseId}/{yyyyMMdd-HHmmss}-{safeFilename}`

---

### `registerReceipt`

**Input:**
```typescript
{
  expenseId: number;
  s3Key: string;
  mimeType: string;
  originalFilename: string;
  fileSize: number;
}
```

**Output:** Created `expense_files` record

**Description:** Registers a receipt file after successful S3 upload. Call this after uploading to the presigned URL.

---

### `getReceiptUrl`

**Input:**
```typescript
{
  fileId: number;
}
```

**Output:**
```typescript
{
  url: string; // Presigned GET URL (1 hour expiry)
  file: ExpenseFile;
}
```

**Description:** Gets a presigned URL for viewing/downloading a receipt.

---

### `deleteExpenseFile`

**Input:**
```typescript
{
  id: number;
}
```

**Output:**
```typescript
{
  success: boolean;
}
```

**Description:** Deletes a receipt file from database and S3.

---

### `getExpenseFiles`

**Input:**
```typescript
{
  expenseId: number;
}
```

**Output:** Array of `expense_files` records

**Description:** Gets all receipt files for an expense.

---

### `uploadReceiptsBulk`

**Input:**
```typescript
{
  files: Array<{
    filename: string;
    mimeType: string;
    fileSize: number;
    base64Data: string; // Base64-encoded file content
  }>; // min 1, max 10 files
}
```

**Output:**
```typescript
{
  createdExpenseIds: number[];
  errors?: Array<{
    filename: string;
    error: string;
  }>;
}
```

**Description:** Bulk upload receipts. Creates a new expense for each file with deterministic defaults:
- `status: "needs_review"`
- `source: "upload"`
- `supplierName`: Sanitized filename (extension removed, cleaned)
- `expenseDate`: Current date
- `grossAmountCents: 0`
- `currency: "EUR"`
- `vatMode: "none"`
- `businessUsePct: 100`
- `category: null`
- `paymentStatus: "unpaid"`

**Behavior:**
- Processes files independently (partial failures don't abort batch)
- Returns list of created expense IDs and any errors
- Best-effort cleanup on failures

---

### `processReceipt`

**Input:**
```typescript
{
  expenseId: number;
  fileId: number;
}
```

**Output:** ❌ **NOT_IMPLEMENTED** (throws error)

**Description:** Placeholder for future OCR processing. Currently throws `NOT_IMPLEMENTED` error.

---

## Frontend Components

### Pages

#### `Expenses.tsx` (List View)

**Route:** `/expenses`

**Features:**
- Header cards showing deductible costs (year and current quarter)
- Two sections: "Needs Review" and "In Order"
- Excludes void expenses by default
- Keyboard shortcuts:
  - `Enter`: Edit first expense in Needs Review
  - `I`: Mark first expense as In Order
- Floating action button (FAB) for quick capture
- Bulk upload dialog

**State Management:**
- Uses `trpc.expenses.list.useQuery()` with `includeVoid` toggle
- Calculates deductible amounts client-side

---

#### `ExpenseDetail.tsx` (Detail/Edit View)

**Route:** `/expenses/:id` or `/expenses/new`

**Features:**
- Full expense form
- Receipt upload and management
- AI suggestions display
- Actions: Save, Mark as In Order, Void, Delete
- Keyboard shortcut: `Cmd/Ctrl + Enter` to save
- Auto-navigation to next expense after marking as in_order

**State Management:**
- Uses `trpc.expenses.getExpense.useQuery()` for existing expenses
- Separate mutations for create, update, status changes, file operations

---

#### `ScanReceipt.tsx` (Mobile Scanner)

**Route:** `/expenses/scan?expenseId={id}`

**Features:**
- Mobile-first camera capture (`<input type="file" capture="environment" />`)
- Client-side document scanning (grayscale + contrast enhancement)
- Corner adjustment UI
- Preview before upload
- Redirects to expense detail after upload

**Dependencies:**
- `@/lib/documentScanner/scanPipeline` (client-side image processing)

---

### Components

#### `ExpenseForm.tsx`

**Props:**
```typescript
{
  initialData?: ExpenseFormData;
  files?: ExpenseFile[];
  suggestions?: ExpenseSuggestion[];
  onSave: (data: ExpenseFormData) => void;
  onAcceptSuggestion?: (field: string, value: string | number) => void;
  onMarkInOrder?: () => void;
  onVoid?: () => void;
  onDelete?: () => void;
  onReceiptUpload?: (files: File[]) => void;
  onReceiptDelete?: (id: number) => void;
  onReceiptView?: (id: number) => void;
  // ... loading states, permissions, etc.
}
```

**Features:**
- Form fields: description, category, gross amount, currency, business use %
- Deductible amount calculation (display only)
- Payment information (informational only)
- Receipt upload zone (drag-and-drop)
- Receipt preview list
- Suggestion badges and controls
- "Accept all suggestions" button (when 2+ suggestions available)
- Action buttons (Save, Mark as In Order, Void, Delete)

**Suggestion Handling:**
- Filters out dismissed suggestions
- Hides suggestions for manually edited fields
- Shows confidence badges and reasons

---

#### `ExpenseCard.tsx`

**Props:**
```typescript
{
  expense: ExpenseWithReceiptCount;
  onAction: (action: ItemAction, expenseId: number) => void;
  showVoid?: boolean;
}
```

**Features:**
- Displays expense summary
- Status badge
- Gross amount and deductible amount
- Business use percentage
- Receipt count badge
- Actions menu (Edit, Mark as In Order, Void)

---

#### `CategorySelect.tsx`

**Features:**
- Dropdown with all expense categories
- Human-readable labels
- Search/filter support (if implemented)

---

#### `CurrencySelect.tsx`

**Features:**
- Currency dropdown (ISO codes)
- Default: EUR

---

#### `ReceiptUploadZone.tsx`

**Features:**
- Drag-and-drop file upload
- Click to browse
- Multiple file support
- Loading state

---

#### `ReceiptPreviewList.tsx`

**Features:**
- Thumbnail grid of uploaded receipts
- View button (opens in new tab)
- Delete button
- Loading states

---

#### `SuggestionBadge.tsx`

**Features:**
- Displays confidence score (0-100%)
- Shows reason text
- Color-coded by confidence

---

#### `SuggestionControls.tsx`

**Features:**
- Accept button
- Dismiss button
- Loading state

---

#### `VoidExpenseDialog.tsx`

**Features:**
- Void reason selector
- Optional void note
- Confirmation button

---

#### `BulkUploadDialog.tsx`

**Features:**
- File picker (multiple)
- Progress indicator
- Error display

---

#### `CaptureFab.tsx`

**Features:**
- Floating action button
- Options: Bulk upload, Manual entry
- Mobile-optimized

---

#### `CornerAdjuster.tsx`

**Features:**
- Interactive corner adjustment for receipt scanning
- Used in `ScanReceipt.tsx`

---

## Features & Workflows

### 1. Creating an Expense

**Manual Entry:**
1. Navigate to `/expenses/new`
2. Fill in form (category required)
3. Click "Save"
4. Expense created with `status: "needs_review"`

**Bulk Upload:**
1. Click FAB → "Bulk Upload"
2. Select multiple files (max 10)
3. Each file creates a new expense with defaults
4. All expenses start in `needs_review`

**Receipt Scan:**
1. Click "Scan receipt" button on expense detail
2. Camera opens (mobile) or file picker (desktop)
3. Capture/select image
4. Optional: Adjust corners
5. Confirm upload
6. Receipt attached to expense

---

### 2. Reviewing an Expense

**Workflow:**
1. Expense appears in "Needs Review" section
2. Click to open detail view
3. Review AI suggestions (category, VAT mode, business use %)
4. Accept or dismiss suggestions
5. Fill in missing fields (amount, category, etc.)
6. Click "Mark as In Order"
7. Expense moves to "In Order" section

**Requirements for "In Order":**
- `supplierName` (required)
- `expenseDate` (required)
- `grossAmountCents` > 0 (required)
- `category` (required)

---

### 3. Voiding an Expense

**Workflow:**
1. Expense must be in `in_order` status
2. Click "Void" button
3. Select void reason (required)
4. Optionally add void note
5. Confirm
6. Expense status changes to `void`
7. Expense hidden from default list (can show with toggle)

**Void Reasons:**
- `duplicate`: Expense was already recorded
- `personal`: Not a business expense
- `mistake`: Data entry error
- `wrong_document`: Wrong receipt attached
- `other`: Other reason (note required)

---

### 4. Deleting an Expense

**Workflow:**
1. Expense must be in `needs_review` status
2. Click "Delete" button
3. Confirm deletion
4. Expense and all receipts deleted from DB and S3

**Note:** Only `needs_review` expenses can be deleted. Use void for `in_order` expenses.

---

### 5. Editing an Expense

**Accounting Fields:**
- Changes to `supplierName`, `expenseDate`, `grossAmountCents`, `currency`, `vatMode`, `vatRate`, `vatAmountCents`, `businessUsePct`, `category` reset status to `needs_review` if currently `in_order`

**Payment Fields:**
- Changes to `paymentStatus`, `paymentDate`, `paymentMethod` never affect status

**Description:**
- Changes to `description` trigger suggestion refetch (500ms delay)

---

## Business Rules

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

- **Ownership-based**: Users can only access expenses they created
- **Admin override**: Admin users can access all expenses
- **Validation**: All endpoints check ownership before operations

---

## Suggestion Engine

**Location:** `server/expenses/suggestionEngine.ts`

**Purpose:** Pure, stateless suggestion engine that proposes (but never applies) values for:
- Category
- VAT mode
- Business use percentage

### Rules

#### Rule A: Supplier Memory (Highest Priority)

**Logic:**
- Query last 5 expenses with same supplier name (case-insensitive)
- Suggest values from most recent expense
- Confidence: `0.8 + (history.length * 0.05)`, max `0.95`

**Applies to:** `category`, `vatMode`, `businessUsePct`

---

#### Rule B: Keyword Matching

**Logic:**
- Extract keywords from `supplierName` and receipt filenames
- Match against keyword dictionary:
  ```typescript
  {
    amazon: "equipment",
    ikea: "office_supplies",
    hotel: "travel",
    taxi: "travel",
    uber: "travel",
    restaurant: "meals",
    cafe: "meals",
    adobe: "software",
    figma: "software",
    dhl: "shipping",
    post: "shipping",
  }
  ```
- Confidence: `0.6` (single keyword) or `0.7` (multiple)

**Applies to:** `category`

---

#### Rule C: Category → VAT Heuristic

**Logic:**
- If `currency === "EUR"` and category is `"meals"`, `"travel"`, or `"rent"`:
  - Suggest `vatMode: "german"`
  - Confidence: `0.6`

**Applies to:** `vatMode`

---

#### Rule D: Currency Guard (Absolute Priority for VAT)

**Logic:**
- If `currency !== "EUR"`:
  - Suggest `vatMode: "foreign"`
  - Confidence: `1.0` (overrides all other VAT suggestions)

**Applies to:** `vatMode`

---

### Conflict Resolution

For each field, choose the suggestion with highest confidence:
1. Collect all suggestions for the field
2. Select highest confidence
3. If tie, first suggestion wins

**Special Case:** Currency guard (`vatMode: "foreign"`) always wins for VAT suggestions (confidence 1.0).

---

### Suggestion Format

```typescript
type ExpenseSuggestions = {
  category?: {
    value: string;
    confidence: number; // 0.0-1.0
    reason: string;
  };
  vatMode?: {
    value: "none" | "german" | "foreign";
    confidence: number;
    reason: string;
  };
  businessUsePct?: {
    value: number;
    confidence: number;
    reason: string;
  };
};
```

---

## File Management

### S3 Storage

**Key Pattern:** `expenses/{expenseId}/{yyyyMMdd-HHmmss}-{safeFilename}`

**Example:** `expenses/123/20241217-143022-receipt_scan.jpg`

### Upload Flow

1. Client calls `uploadExpenseReceipt` → receives presigned PUT URL
2. Client uploads file directly to S3 using PUT URL
3. Client calls `registerReceipt` → creates DB record
4. File appears in expense detail view

### Download Flow

1. Client calls `getReceiptUrl` → receives presigned GET URL (1 hour expiry)
2. Client opens URL in new tab or downloads

### File Limits

- **Max file size:** 15MB
- **Allowed MIME types:**
  - `application/pdf`
  - `image/jpeg`
  - `image/jpg`
  - `image/png`
  - `image/heic`
  - `image/heif`
  - `image/webp`

### Cleanup

- **Cascade delete:** Deleting expense deletes all `expense_files` records (CASCADE)
- **S3 cleanup:** Best-effort deletion on expense/file delete (errors logged, don't fail)

---

## Known Limitations

### 1. OCR Not Implemented

- `processReceipt` endpoint throws `NOT_IMPLEMENTED`
- No automatic extraction of amount, date, supplier from receipts
- Manual entry required for all fields

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

---

## Future Enhancements

### Phase 2: OCR Integration

- [ ] Integrate OCR service (e.g., AWS Textract, Google Vision)
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

## Testing Checklist

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

---

## Code Quality Notes

### Strengths

✅ **Type Safety:** Full TypeScript with Zod validation  
✅ **Error Handling:** Comprehensive error messages  
✅ **Audit Trail:** All changes tracked  
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

## Questions for Review

1. **OCR Integration:** What OCR service should we use? AWS Textract, Google Vision, or other?
2. **Performance:** Should we add pagination to the expense list?
3. **Export:** Should we prioritize DATEV CSV export or tax report PDFs?
4. **Project Linking:** Should expenses be linkable to projects/jobs?
5. **Multi-User:** Should we add expense approval workflow for teams?
6. **Suggestion Engine:** Should we invest in ML-based suggestions or expand keyword dictionary?
7. **Mobile App:** Should we prioritize native mobile app or improve PWA?
8. **Testing:** Should we add automated tests (unit, integration, E2E)?

---

## Contact & Contribution

For questions, bug reports, or feature requests, please:
1. Open an issue in the repository
2. Tag with `expenses-module` label
3. Include relevant details (screenshots, error messages, steps to reproduce)

---

**Document Version:** 1.0  
**Last Updated:** 2024-12-17  
**Maintained By:** Development Team

