# Invoice Create & Edit Pages â€” Complete Documentation

## Overview

The invoice creation and editing system in Mantodeus Manager consists of multiple components working together to provide a seamless experience across mobile and desktop. This document covers everything needed to understand and improve these pages.

---

## Architecture

### Component Hierarchy

```
InvoiceCreate (Page)
â””â”€â”€ CreateInvoiceDialog
    â”œâ”€â”€ Mobile: Dialog with InvoiceForm
    â””â”€â”€ Desktop: CreateInvoiceWorkspace
        â”œâ”€â”€ Left Panel: Preview (40vw)
        â””â”€â”€ Right Panel: InvoiceForm (60vw)

InvoiceView (Page)
â”œâ”€â”€ Desktop Draft: Split layout (same as CreateInvoiceWorkspace)
â”œâ”€â”€ Mobile/Non-Draft: Single column with InvoiceForm
â””â”€â”€ Uploaded Invoices: InvoiceUploadReviewDialog (never shows InvoiceForm)
```

### Key Components

1. **`InvoiceForm.tsx`** â€” Core form component (shared for create/edit)
2. **`CreateInvoiceDialog.tsx`** â€” Mobile dialog wrapper
3. **`CreateInvoiceWorkspace.tsx`** â€” Desktop full-page workspace
4. **`InvoiceView.tsx`** â€” Edit page with conditional layouts
5. **`InvoiceCreate.tsx`** â€” Create page (simple wrapper)

---

## Invoice Form Component (`InvoiceForm.tsx`)

### Purpose
Shared form component used for both creating and editing invoices. Handles all form state, validation, and submission.

### Props

```typescript
{
  mode: "create" | "edit";
  invoiceId?: number; // Required for edit mode
  contacts: Array<{ id: number; name: string }>;
  onClose: () => void;
  onSuccess: () => void;
  onOpenInvoice?: (invoiceId: number) => void;
  onPreview?: () => void;
  showPreview?: boolean;
  onFormChange?: (formData: InvoicePreviewData) => void;
  getFormDataRef?: React.MutableRefObject<(() => InvoicePreviewData | null) | null>;
  renderBeforeFooter?: React.ReactNode;
}
```

### Form Fields

#### Basic Information
- **Invoice Number** â€” Auto-generated from company settings, can be manually overridden
- **Client** â€” Dropdown select from contacts (optional)
- **Issue Date** â€” Required, defaults to today
- **Due Date** â€” Optional, required before sending

#### Service Period
- **Service Period Start** â€” Optional date
- **Service Period End** â€” Optional date

#### Line Items
- Dynamic list of invoice items
- Each item has: name, description, category, quantity, unit price, currency
- Items edited via modal dialog (`LineItemModal`)
- Categories: services, materials, travel, other (via `InvoiceCategorySelect`)

#### Additional Fields
- **Partial Invoice** â€” Boolean flag (future use)
- **Anmerkungen (Notes)** â€” Optional textarea (appears on invoice PDF)
- **Bedingungen (Terms)** â€” Optional textarea (appears on invoice PDF)
- **Order/Reference Number** â€” Optional text field

### State Management

#### Form State (`InvoiceFormState`)
```typescript
{
  invoiceNumber: string;
  clientId?: string;
  issueDate: string; // ISO date string
  dueDate?: string;
  notes?: string;
  terms?: string;
  servicePeriodStart?: string;
  servicePeriodEnd?: string;
  referenceNumber?: string;
  partialInvoice: boolean;
}
```

#### Line Items State
- Array of `InvoiceLineItem` objects
- Default: empty array for create, single default item for edit (until loaded)

### Data Flow

#### Create Mode
1. Component mounts with empty form
2. `trpc.invoices.nextNumber.useQuery` fetches suggested invoice number
3. User fills form and adds line items
4. On submit: `trpc.invoices.create.useMutation` creates invoice
5. `onSuccess` callback fires (navigates to invoice list)

#### Edit Mode
1. Component mounts with `invoiceId`
2. `trpc.invoices.get.useQuery` fetches invoice data
3. Form state populated from invoice data
4. User edits form
5. On submit: `trpc.invoices.update.useMutation` updates invoice
6. `onSuccess` callback fires (shows toast, invalidates queries)

### Validation

#### Client-Side
- Invoice number must not be empty
- At least one line item required
- Each line item must have name and quantity > 0
- Due date required before sending (for draft invoices)

#### Server-Side (via tRPC)
- Invoice number must include numeric sequence
- Invoice number must be unique per user
- Only draft invoices can be updated
- Cancelled invoices are read-only
- Archived invoices cannot be updated

### Read-Only States

The form becomes read-only when:
- Invoice is sent (`sentAt !== null`)
- Invoice is paid (`paidAt !== null`)
- Invoice is cancelled (`cancelledAt !== null`)

**Exception:** Draft invoices can always be edited, even if `needsReview === true`

### Special Features

#### Cancellation Invoices
- Shows badge "STORNO" if `type === "cancellation"`
- Displays link to original invoice if `cancelledInvoiceId` exists
- Shows warning if invoice is cancelled by another invoice

#### Payments Section
- Only visible for sent invoices (`sentAt !== null`)
- Shows: Total, Paid, Outstanding
- "Add Payment" button opens `AddPaymentDialog`
- Hidden when invoice is fully paid

#### Warning Banners
- "Not sent yet" â€” if `!sentAt && !needsReview`
- "Sent but not paid" â€” if `sentAt && !paidAt`
- "Overdue" â€” if past due date and not paid

### Line Item Editor Modal

Separate modal dialog (`LineItemModal`) for adding/editing line items:
- Fields: Name, Description, Category, Quantity, Unit Price, Currency
- Real-time line total calculation
- Currency is fixed to EUR (disabled input)
- Validates name is required before saving

---

## Create Invoice Flow

### Mobile (`CreateInvoiceDialog.tsx`)

1. User navigates to `/invoices/create`
2. `InvoiceCreate` page renders `CreateInvoiceDialog`
3. Dialog opens as full-screen modal
4. `InvoiceForm` renders inside dialog
5. User can click "Preview" button to generate unsaved preview
6. Preview opens in separate dialog (stacked dialogs)
7. On save, invoice created and dialog closes

**Key Features:**
- Full-screen dialog with header
- Preview button in form footer
- Preview opens in separate dialog (z-index 70)
- Touch zoom support for preview PDF
- Prevents closing parent dialog when preview is open

### Desktop (`CreateInvoiceWorkspace.tsx`)

1. User navigates to `/invoices/create`
2. `InvoiceCreate` page renders `CreateInvoiceDialog`
3. `CreateInvoiceDialog` detects desktop and renders `CreateInvoiceWorkspace`
4. Workspace shows split layout:
   - **Left (40vw):** Preview panel
   - **Right (60vw):** Form panel
5. User clicks "Update Preview" to generate preview
6. Preview appears in left panel (iframe with zoom support)
7. On save, invoice created and workspace closes

**Key Features:**
- Full-page overlay (backdrop with blur)
- Fixed position panels (z-index 110)
- Preview panel with zoom controls (mouse wheel, trackpad pinch)
- Form panel scrollable independently
- Click outside to close workspace

### Preview Generation

Both mobile and desktop use the same preview endpoint:

**Endpoint:** `POST /api/invoices/preview`

**Request:**
```json
{
  "invoiceNumber": "RE-2025-0001",
  "clientId": 123,
  "issueDate": "2025-01-15",
  "dueDate": "2025-02-15",
  "notes": "...",
  "terms": "...",
  "servicePeriodStart": "2025-01-01",
  "servicePeriodEnd": "2025-01-31",
  "items": [
    {
      "name": "Service",
      "description": "...",
      "quantity": 1,
      "unitPrice": 1000,
      "currency": "EUR"
    }
  ]
}
```

**Response:** PDF blob

**Features:**
- Uses unsaved form data (via `getFormDataRef`)
- Rate limiting (429 status) â€” silently fails, keeps last valid preview
- AbortController for cancellation
- Blob URL management (cleanup on unmount)

---

## Edit Invoice Flow (`InvoiceView.tsx`)

### Route
`/invoices/:id`

### Layout Logic

#### Desktop Draft Invoices
- **Condition:** `!isMobile && invoice.source === "created" && isDraft`
- **Layout:** Split layout (same as `CreateInvoiceWorkspace`)
  - Left: Preview panel
  - Right: Form panel with status actions dropdown

#### Mobile or Non-Draft Invoices
- **Layout:** Single column
  - Header with title and back button
  - Action buttons (Preview, Status dropdown)
  - Form card with `InvoiceForm`

#### Uploaded Invoices
- **Special Handling:** Never shows `InvoiceForm`
- Redirects to `InvoiceUploadReviewDialog` instead
- Review dialog handles all editing for uploaded invoices

### Invoice States

Invoice state is derived from timestamps (not `status` field):

```typescript
function getInvoiceState(invoice) {
  if (invoice.needsReview) return 'REVIEW';
  if (!invoice.sentAt) return 'DRAFT';
  if (invoice.paidAt) return 'PAID';
  if (invoice.amountPaid > 0) return 'PARTIAL';
  return 'SENT';
}
```

### Status Actions Dropdown

`InvoiceStatusActionsDropdown` component provides all lifecycle actions:
- Send Invoice (opens `ShareInvoiceDialog`)
- Mark as Sent
- Mark as Paid (opens `MarkAsPaidDialog`)
- Add Payment
- Revert to Draft
- Revert to Sent
- Create Cancellation
- Archive
- Move to Trash

### Preview Behavior

#### For Created Invoices
- **Saved Preview:** Click "Preview" button â†’ generates PDF from saved invoice data
- **Unsaved Preview:** Click "Update Preview" button â†’ generates PDF from form data (unsaved)

#### For Uploaded Invoices
- Uses original PDF from S3 (`originalPdfS3Key`)
- Fetched via `/api/file-proxy` endpoint

### Form Behavior in Edit Mode

- Loads invoice data on mount
- Populates all form fields
- Normalizes dates to ISO strings for inputs
- Handles `clientId` vs `contactId` (legacy support)
- Preserves `dueDate` from database (important for sent invoices)
- Shows read-only state for sent/paid/cancelled invoices

---

## Backend API (`invoiceRouter.ts`)

### Key Endpoints

#### `invoices.create`
- Validates invoice number format (must include numeric sequence)
- Generates invoice number if not provided
- Ensures unique invoice number per user
- Calculates totals from line items
- Creates invoice with `status: "draft"`

#### `invoices.update`
- Only allows updates to draft invoices
- Validates invoice number uniqueness
- Recalculates totals if items changed
- Blocks updates to cancelled invoices
- Blocks updates to archived invoices

#### `invoices.nextNumber`
- Generates next invoice number based on:
  - User's company settings (`invoicePrefix`, `invoiceNumberFormat`)
  - Issue date (for year-based numbering)
  - Last invoice counter for the year

#### `invoices.get`
- Fetches invoice by ID
- Includes cancellation metadata
- Returns derived state values

### Invoice Number Generation

Format: `{prefix}-{year}-{counter}` (e.g., "RE-2025-0001")

Logic:
1. Get user's `invoicePrefix` (default: "RE")
2. Get `invoiceNumberFormat` from settings (optional)
3. Find last invoice for the year
4. Increment counter
5. Format with leading zeros

---

## PDF Preview System

### Endpoints

#### `POST /api/invoices/preview`
- Generates PDF from unsaved form data
- Requires authentication
- Returns PDF blob
- Rate limited (429 status)

#### `GET /api/invoices/:id/pdf?preview=true`
- Generates PDF from saved invoice
- Requires authentication
- Returns PDF blob

### Preview Features

#### Desktop
- Fixed left panel (40vw width)
- Zoom support: mouse wheel (Ctrl/Cmd), trackpad pinch, touch pinch
- Zoom range: 0.3x to 3x
- Auto-fit on load (calculates to fit viewport)
- Scrollable iframe

#### Mobile
- Full-screen dialog
- Touch zoom support (pinch-to-zoom)
- Scrollable iframe
- Separate dialog (z-index 70) to prevent closing parent

### PDF Generation

Uses `@react-pdf/renderer` to generate PDFs:
- Template: `server/templates/invoice.tsx`
- Includes company settings (logo, address, bank details)
- Includes client contact info (if linked)
- Includes all line items with totals
- German formatting (DD.MM.YYYY dates, 1.234,56 â‚¬ currency)

---

## Data Models

### Invoice Database Schema

```typescript
{
  id: number;
  userId: number;
  invoiceNumber: string;
  invoiceName: string;
  invoiceCounter: number;
  invoiceYear: number;
  clientId: number | null;
  status: "draft" | "open" | "paid" | "cancelled";
  source: "created" | "uploaded";
  issueDate: Date;
  dueDate: Date | null;
  sentAt: Date | null;
  paidAt: Date | null;
  amountPaid: number;
  subtotal: string; // Decimal as string
  vatAmount: string;
  total: string;
  notes: string | null;
  terms: string | null;
  servicePeriodStart: Date | null;
  servicePeriodEnd: Date | null;
  referenceNumber: string | null;
  partialInvoice: boolean;
  needsReview: boolean;
  items: Array<InvoiceLineItem>;
  archivedAt: Date | null;
  trashedAt: Date | null;
  cancelledAt: Date | null;
  type: "invoice" | "cancellation" | null;
  cancelledInvoiceId: number | null;
  // ... file storage fields for uploaded invoices
}
```

### InvoiceLineItem

```typescript
{
  name: string;
  description: string | null;
  category: string | null;
  quantity: number;
  unitPrice: number;
  currency: string;
  lineTotal: number;
}
```

---

## UI/UX Patterns

### Mobile-First Design
- All layouts designed for mobile, scaled up for desktop
- Large touch targets (for field use with gloves)
- Full-screen dialogs on mobile
- Bottom sheet patterns for previews

### Responsive Behavior
- Desktop: Split layout with preview panel
- Mobile: Single column with stacked dialogs
- Breakpoint: `useIsMobile()` hook (typically 768px)

### Loading States
- Skeleton loaders for invoice list
- Spinner for form submission
- Disabled buttons during mutations
- Toast notifications for success/error

### Error Handling
- Client-side validation with error messages
- Server-side validation with tRPC errors
- Toast notifications for all errors
- Graceful degradation (e.g., rate-limited previews)

### Accessibility
- ARIA labels on buttons
- Keyboard navigation support
- Screen reader friendly
- Focus management in dialogs

---

## German Legal Requirements

### Invoice Numbering
- Must be sequential (no gaps)
- Must be unique per user
- Format: `{prefix}-{year}-{counter}` (e.g., "RE-2025-0001")
- Counter resets each year

### VAT Handling
- Currently: VAT is 0 (Kleinunternehmerregelung Â§ 19 UStG)
- Future: Configurable VAT rate (default 19%)
- `isKleinunternehmer` flag in company settings

### Required Fields
- Invoice number
- Issue date
- Total amount
- Company details (from `companySettings`)
- Client details (if linked)

### PDF Format
- German date format: DD.MM.YYYY
- German currency format: 1.234,56 â‚¬
- Includes company address, tax number, bank details

---

## Known Issues & Limitations

### Current Limitations
1. **VAT Calculation:** Not implemented (always 0)
2. **Multi-Currency:** Currency is fixed to EUR
3. **Partial Payments:** Can add payments, but no payment history view
4. **Invoice Templates:** Single template (no customization)
5. **Offline Support:** No offline capability yet

### Technical Debt
1. **Legacy Fields:** `contactId` vs `clientId` (both supported for backward compatibility)
2. **Status Field:** Not used for state logic (uses timestamps instead)
3. **File Storage:** Multiple fields for file keys (`fileKey`, `pdfFileKey`, `originalPdfS3Key`)

---

## Improvement Opportunities

### UX Improvements
1. **Auto-save:** Save draft automatically as user types
2. **Keyboard Shortcuts:** Save (Ctrl+S), Preview (Ctrl+P), etc.
3. **Bulk Line Item Entry:** Add multiple items at once
4. **Invoice Templates:** Pre-filled line items for common services
5. **Client Autocomplete:** Better client search/selection

### Feature Enhancements
1. **VAT Calculation:** Implement proper VAT handling
2. **Multi-Currency:** Support different currencies per invoice
3. **Payment History:** View all payments with dates
4. **Invoice Attachments:** Attach files to invoices
5. **Email Integration:** Send invoices directly from app

### Performance
1. **Preview Debouncing:** Debounce preview generation on form changes
2. **Optimistic Updates:** Update UI immediately, sync in background
3. **Lazy Loading:** Load invoice data on demand
4. **Caching:** Cache preview PDFs temporarily

### Code Quality
1. **Type Safety:** More strict TypeScript types
2. **Error Boundaries:** Add error boundaries for form components
3. **Testing:** Unit tests for form validation
4. **Documentation:** JSDoc comments for complex functions

---

## File Locations

### Frontend Components
- `client/src/components/invoices/InvoiceForm.tsx` â€” Main form component
- `client/src/components/invoices/CreateInvoiceDialog.tsx` â€” Mobile dialog
- `client/src/components/invoices/CreateInvoiceWorkspace.tsx` â€” Desktop workspace
- `client/src/pages/InvoiceCreate.tsx` â€” Create page
- `client/src/pages/InvoiceView.tsx` â€” Edit page
- `client/src/components/invoices/InvoiceCategorySelect.tsx` â€” Category selector
- `client/src/components/invoices/ShareInvoiceDialog.tsx` â€” Share dialog
- `client/src/components/invoices/AddPaymentDialog.tsx` â€” Payment dialog
- `client/src/components/invoices/InvoiceStatusActionsDropdown.tsx` â€” Status actions

### Backend
- `server/invoiceRouter.ts` â€” tRPC router with all endpoints
- `server/db.ts` â€” Database queries
- `server/_core/index.ts` â€” PDF preview endpoint
- `server/templates/invoice.tsx` â€” PDF template

### Utilities
- `client/src/lib/invoiceState.ts` â€” State calculation helpers
- `client/src/lib/invoiceActions.ts` â€” Action validation helpers
- `client/src/lib/accountingDate.ts` â€” Date helpers

---

## Testing Checklist

### Create Invoice
- [ ] Auto-generates invoice number
- [ ] Can manually override invoice number
- [ ] Validates invoice number format
- [ ] Requires at least one line item
- [ ] Calculates totals correctly
- [ ] Saves invoice successfully
- [ ] Preview generates correctly
- [ ] Mobile dialog works
- [ ] Desktop workspace works

### Edit Invoice
- [ ] Loads invoice data correctly
- [ ] Populates all form fields
- [ ] Can edit draft invoices
- [ ] Cannot edit sent invoices
- [ ] Cannot edit paid invoices
- [ ] Cannot edit cancelled invoices
- [ ] Preview shows saved data
- [ ] "Update Preview" shows unsaved data
- [ ] Status actions work correctly

### Line Items
- [ ] Can add line item
- [ ] Can edit line item
- [ ] Can delete line item
- [ ] Requires at least one item
- [ ] Calculates line totals correctly
- [ ] Category selection works
- [ ] Currency is fixed to EUR

### Validation
- [ ] Invoice number required
- [ ] Invoice number must be unique
- [ ] At least one line item required
- [ ] Line item name required
- [ ] Due date required before sending
- [ ] Total must be > 0

---

## Summary

The invoice create and edit pages are well-structured with clear separation of concerns:
- **Shared form component** (`InvoiceForm`) handles all form logic
- **Responsive layouts** adapt to mobile/desktop
- **Preview system** supports both saved and unsaved data
- **State management** uses timestamps (not status field)
- **German compliance** built-in (invoice numbering, formatting)

The system is extensible and ready for improvements in VAT handling, multi-currency, and enhanced UX features.
