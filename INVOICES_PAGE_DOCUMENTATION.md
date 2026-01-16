# Invoices Page â€” Complete Documentation

**File:** `client/src/pages/Invoices.tsx` (2,588 lines)  
**Last Updated:** 2024-12-17

---

## ðŸ“‹ Table of Contents

1. [Overview](#overview)
2. [Architecture & Data Flow](#architecture--data-flow)
3. [State Management](#state-management)
4. [Features & Functionality](#features--functionality)
5. [UI Components & Layout](#ui-components--layout)
6. [Invoice States & Actions](#invoice-states--actions)
7. [Search & Filtering](#search--filtering)
8. [Multi-Select & Batch Operations](#multi-select--batch-operations)
9. [Backend Integration](#backend-integration)
10. [Key Dependencies](#key-dependencies)
11. [Known Issues & Improvement Opportunities](#known-issues--improvement-opportunities)

---

## Overview

The Invoices page is the main hub for managing invoices in Mantodeus Manager. It displays a list of invoices with filtering, search, multi-select capabilities, and comprehensive invoice lifecycle management.

### Key Capabilities

- âœ… View active, archived, and trashed invoices
- âœ… Create new invoices (via dialog)
- âœ… Bulk upload invoice PDFs with OCR processing
- âœ… Search invoices by client, date, amount, invoice number
- âœ… Filter by project, client, time period, status
- âœ… Multi-select for batch operations
- âœ… Year/Quarter total cards with drill-down
- âœ… "Needs Review" section for uploaded invoices
- âœ… Full invoice lifecycle management (draft â†’ sent â†’ paid)
- âœ… Status reversion (paid â†’ sent, sent â†’ draft)
- âœ… Cancellation invoice creation
- âœ… Archive/trash workflow

---

## Architecture & Data Flow

### Component Structure

```
Invoices (Page)
â”œâ”€â”€ PageHeader (title, search, filter, settings, primary actions)
â”œâ”€â”€ YearTotalCard (year totals with popover)
â”œâ”€â”€ QuarterTotalCard (quarter totals with popover)
â”œâ”€â”€ Needs Review Section (uploaded invoices pending review)
â”œâ”€â”€ Invoice Grid (filtered invoices)
â”œâ”€â”€ MultiSelectBar (batch operations)
â”œâ”€â”€ Search Overlay (mobile search interface)
â”œâ”€â”€ Filter Sheet (filter controls)
â””â”€â”€ Multiple Dialogs:
    â”œâ”€â”€ CreateInvoiceDialog
    â”œâ”€â”€ InvoiceUploadReviewDialog
    â”œâ”€â”€ BulkInvoiceUploadDialog
    â”œâ”€â”€ RevertInvoiceStatusDialog
    â”œâ”€â”€ MarkAsSentWarningDialog
    â”œâ”€â”€ MarkAsPaidDialog
    â”œâ”€â”€ DeleteConfirmDialog (multiple instances)
    â””â”€â”€ PDFPreviewModal
```

### Data Queries

The page uses **6 tRPC queries** to fetch data:

```typescript
// Active invoices (not archived, not trashed)
const { data: invoices } = trpc.invoices.list.useQuery();

// Archived invoices
const { data: archivedInvoices } = trpc.invoices.listArchived.useQuery();

// Trashed invoices
const { data: trashedInvoices } = trpc.invoices.listTrashed.useQuery();

// Uploaded invoices needing review
const { data: needsReviewInvoices } = trpc.invoices.listNeedsReview.useQuery();

// Contacts (for client name resolution)
const { data: contacts } = trpc.contacts.list.useQuery();

// Projects (for filtering)
const { data: projects } = trpc.projects.list.useQuery();

// Company settings (for accounting date calculations)
const { data: companySettings } = trpc.settings.get.useQuery();
```

### Data Merging

All invoices are merged into a single array with a `_status` marker:

```typescript
const allInvoices = useMemo(() => {
  const active = invoices.map(inv => ({ ...inv, _status: 'active' as const }));
  const archived = archivedInvoices.map(inv => ({ ...inv, _status: 'archived' as const }));
  const trashed = trashedInvoices.map(inv => ({ ...inv, _status: 'deleted' as const }));
  return [...active, ...archived, ...trashed];
}, [invoices, archivedInvoices, trashedInvoices]);
```

---

## State Management

### Local State (30+ useState hooks)

#### Dialog State
- `createDialogOpen` - Create invoice dialog
- `bulkUploadOpen` - Bulk upload dialog
- `uploadReviewDialogOpen` - Review uploaded invoice
- `previewModalOpen` - PDF preview modal
- `archiveDialogOpen` - Archive confirmation
- `moveToRubbishDialogOpen` - Delete confirmation
- `revertDialogOpen` - Revert status confirmation
- `batchRevertDialogOpen` - Batch revert confirmation
- `markAsSentDialogOpen` - Mark as sent warning
- `markAsPaidDialogOpen` - Mark as paid dialog
- `cancellationDialogOpen` - Create cancellation dialog

#### Selection & Target State
- `selectedIds` - Set of selected invoice IDs (multi-select)
- `isMultiSelectMode` - Whether multi-select is active
- `archiveTargetId` - Invoice ID to archive
- `moveToRubbishTargetId` - Invoice ID to delete
- `revertTarget` - Invoice to revert (single)
- `batchRevertData` - Invoices to revert (batch)
- `markAsSentTarget` - Invoice to mark as sent
- `markAsPaidTarget` - Invoice to mark as paid
- `cancellationTarget` - Invoice to create cancellation for
- `needsReviewDeleteTarget` - Uploaded invoice to delete
- `uploadedInvoiceId` - Invoice ID in review dialog
- `uploadedParsedData` - OCR-extracted data for review

#### UI State
- `selectedYear` - Currently selected year for totals
- `selectedQuarter` - Currently selected quarter for totals
- `yearPopoverOpen` - Year selector popover
- `quarterPopoverOpen` - Quarter selector popover
- `isSearchOpen` - Search overlay visibility
- `isFilterOpen` - Filter sheet visibility
- `searchQuery` - Applied search query
- `searchDraft` - Draft search query (before apply)
- `filters` - Filter state object
- `previewUrl` - PDF preview blob URL
- `previewFileName` - PDF preview filename

### Computed State (useMemo)

- `filteredInvoices` - Filtered and searched invoices
- `yearPaid`, `yearDue` - Year totals
- `quarterPaid`, `quarterDue` - Quarter totals
- `allYearTotals` - All years with totals
- `allQuarterTotals` - All quarters with totals
- `hasActiveFilters` - Whether any filters are active

---

## Features & Functionality

### 1. Invoice Display

#### Invoice Cards
- Grid layout: 1 column (mobile), 2 columns (tablet), 3 columns (desktop)
- Each card shows:
  - Invoice number/name
  - Client name (resolved from contacts)
  - Issue date (formatted as DD.MM.YYYY)
  - Total amount (formatted as German currency)
  - Status badges (DRAFT, SENT, PAID, NEEDS REVIEW, CANCELLED)
  - Action menu (long-press on mobile, click on desktop)

#### Invoice States
States are derived from timestamps (not status field):
- **REVIEW** - `needsReview === true`
- **DRAFT** - `!sentAt`
- **SENT** - `sentAt && !paidAt && amountPaid === 0`
- **PARTIAL** - `sentAt && amountPaid > 0 && outstanding > 0`
- **PAID** - `paidAt !== null`

### 2. Year/Quarter Total Cards

#### YearTotalCard
- Shows total paid and due for selected year
- Long-press opens popover with all years
- Toggle between "total" and "paid/due" view modes
- Click to filter by year

#### QuarterTotalCard
- Shows total paid and due for selected quarter
- Long-press opens popover with all quarters
- Toggle between "total" and "paid/due" view modes
- Click to filter by quarter

**Note:** Totals only count active invoices (exclude archived/trashed). Cancelled invoices are excluded from revenue calculations.

### 3. Needs Review Section

Special section for uploaded invoices that need review:
- Appears above main invoice grid
- Shows uploaded invoices with OCR-extracted data
- Clicking opens `InvoiceUploadReviewDialog` (not full form)
- Can mark as sent/paid directly from review
- Can delete (hard delete, not soft delete)

### 4. Invoice Actions

Actions are determined by `getInvoiceActions()` from `@/lib/invoiceActions.ts`:

#### Available Actions
- **edit** - Edit invoice (opens form or review dialog)
- **duplicate** - Create a copy
- **select** - Enter multi-select mode
- **markAsSent** - Mark as sent (only draft/review, not cancelled)
- **markAsPaid** - Mark as paid (with date picker)
- **revertToSent** - Mark as not paid (from paid)
- **revertToDraft** - Revert to draft (from sent, no payments)
- **archive** - Archive invoice (not draft/review)
- **delete** - Move to trash (or hard delete if in review)
- **markAsCancelled** - Mark as cancelled (draft/review only)
- **markAsNotCancelled** - Unmark as cancelled (draft/review only)

#### Action Validation
- Actions are validated per invoice using `isActionValidForInvoice()`
- Batch operations filter out invalid actions
- Cancelled invoices cannot be marked as sent/paid

### 5. Invoice Lifecycle

#### Draft â†’ Sent
- Requires: `dueDate` and `total > 0`
- Sets `sentAt` timestamp
- Can be reverted to draft if no payments received

#### Sent â†’ Paid
- Sets `paidAt` timestamp
- Can optionally mark as sent simultaneously (for uploaded invoices)
- Can be reverted to sent (mark as not paid)

#### Cancellation
- Can create cancellation invoice from sent/paid invoices
- Original invoice remains unchanged
- Cancellation invoice is a new invoice with negative amounts

---

## UI Components & Layout

### PageHeader
- Title: "Invoices"
- Subtitle: "Create, edit, and manage invoices"
- Icon actions: Search, Filter, Settings (navigates to `/settings`)
- Primary actions: Upload (bulk), Create (new invoice)

### Search Overlay
- Mobile: Full-screen overlay with input
- Desktop: Inline search (if implemented)
- Auto-focuses input on mobile when opened
- Searches: client name, invoice number, date (month name), amount

### Filter Sheet
- Project filter (all/unassigned/specific project)
- Client filter (all/unassigned/specific client)
- Time filter (all/year/year-month)
- Status filter (active/archived/deleted/all)
- Revert button to clear all filters

### Invoice Grid
- Responsive grid layout
- Empty state when no invoices match filters
- Loading states handled by tRPC queries

### Multi-Select Bar
- Appears at bottom when multi-select mode active
- Shows selected count
- Batch actions: Archive, Delete, Revert to Draft, Revert to Sent
- Batch operations validate each invoice before executing

---

## Search & Filtering

### Search Functionality

Searches across multiple fields:
- **Client name** - Case-insensitive substring match
- **Invoice number** - Case-insensitive substring match
- **Invoice name** - Case-insensitive substring match
- **Date (month)** - Matches month name (e.g., "October")
- **Amount** - Numeric match (partial or exact)

### Filter Functionality

#### Project Filter
- `"all"` - All projects
- `"unassigned"` - Invoices without `jobId`
- `"<projectId>"` - Specific project (not fully implemented)

#### Client Filter
- `"all"` - All clients
- `"unassigned"` - Invoices without `clientId` or `contactId`
- `"<contactId>"` - Specific client/contact

#### Time Filter
- `"all"` - All time periods
- `"2024"` - Specific year (4 digits)
- `"2024-10"` - Specific year-month (YYYY-MM)

#### Status Filter
- `"active"` - Active invoices only (default)
- `"archived"` - Archived invoices only
- `"deleted"` - Trashed invoices only
- `"all"` - All statuses

### Filter Logic

Filters are applied in sequence:
1. Search query (if any)
2. Project filter
3. Client filter
4. Time filter
5. Status filter

Selected items remain visible even if they don't match filters (for multi-select UX).

---

## Multi-Select & Batch Operations

### Entering Multi-Select Mode

- Long-press on invoice card (mobile)
- Click "Select" action from menu
- Selected items are highlighted

### Batch Operations

All batch operations:
1. Validate each selected invoice
2. Show confirmation dialog with count
3. Execute mutations for valid invoices
4. Show skipped count if any invoices were invalid

#### Available Batch Actions

- **Archive** - Archive all valid invoices
- **Delete** - Move to trash (or hard delete if in review)
- **Revert to Draft** - Revert sent invoices to draft (no payments)
- **Revert to Sent** - Mark paid invoices as not paid

### Multi-Select Bar

- Fixed at bottom of page
- Shows selected count
- Action buttons for batch operations
- Exit button to cancel multi-select mode
- Accounts for bottom tab bar on mobile (padding)

---

## Backend Integration

### tRPC Mutations (15+)

#### Invoice Lifecycle
- `trpc.invoices.issue.useMutation` - Send invoice (mark as sent)
- `trpc.invoices.markAsSent.useMutation` - Mark as sent
- `trpc.invoices.markAsPaid.useMutation` - Mark as paid
- `trpc.invoices.revertStatus.useMutation` - Revert status (deprecated)
- `trpc.invoices.revertToDraft.useMutation` - Revert to draft
- `trpc.invoices.revertToSent.useMutation` - Mark as not paid

#### Invoice Management
- `trpc.invoices.create.useMutation` - Create new invoice
- `trpc.invoices.update.useMutation` - Update invoice
- `trpc.invoices.duplicate.useMutation` - Duplicate invoice
- `trpc.invoices.archive.useMutation` - Archive invoice
- `trpc.invoices.moveToTrash.useMutation` - Move to trash
- `trpc.invoices.cancelUploadedInvoice.useMutation` - Delete uploaded invoice

#### Cancellation
- `trpc.invoices.markAsCancelled.useMutation` - Mark as cancelled
- `trpc.invoices.markAsNotCancelled.useMutation` - Unmark as cancelled
- `trpc.invoices.createCancellation.useMutation` - Create cancellation invoice

#### Upload
- `trpc.documents.process.useMutation` - Process uploaded PDF (OCR)
- `trpc.invoices.uploadInvoicesBulk.useMutation` - Bulk upload PDFs

### Mutation Patterns

All mutations follow this pattern:
```typescript
const mutation = trpc.invoices.xxx.useMutation({
  onSuccess: () => {
    toast.success("Action completed");
    refetch(); // Refetch main list
    refetchNeedsReview(); // Refetch needs review
    // Invalidate related queries
    utils.invoices.listArchived.invalidate();
    utils.invoices.listTrashed.invalidate();
  },
  onError: (err) => toast.error(err.message),
});
```

---

## Key Dependencies

### Internal Utilities

- `@/lib/invoiceState` - Invoice state derivation (`getInvoiceState`, `getDerivedValues`)
- `@/lib/invoiceActions` - Action model (`getInvoiceActions`, `isActionValidForInvoice`)
- `@/lib/accountingDate` - Accounting date calculations (EÃœR vs Bilanz)
- `@/hooks/useIsMobile` - Mobile detection
- `@/hooks/useLongPress` - Long-press gesture detection
- `@/hooks/useTheme` - Theme context

### Components

- `PageHeader` - Standardized page header
- `ItemActionsMenu` - Context menu for invoice actions
- `MultiSelectBar` - Batch operations bar
- `CreateInvoiceDialog` - Create invoice dialog
- `InvoiceUploadReviewDialog` - Review uploaded invoice
- `BulkInvoiceUploadDialog` - Bulk upload dialog
- `RevertInvoiceStatusDialog` - Revert confirmation
- `MarkAsSentWarningDialog` - Mark as sent warning
- `MarkAsPaidDialog` - Mark as paid with date picker
- `DeleteConfirmDialog` - Delete confirmation
- `PDFPreviewModal` - PDF preview modal

### External Libraries

- `wouter` - Routing (`useLocation`, `navigate`)
- `sonner` - Toast notifications
- `react` - Core React hooks
- `@tanstack/react-query` - Data fetching (via tRPC)

---

## Known Issues & Improvement Opportunities

### Code Quality

1. **File Size** - 2,588 lines is very large. Consider splitting into:
   - `InvoicesList.tsx` - Main list component
   - `InvoicesHeader.tsx` - Header with totals
   - `InvoiceCard.tsx` - Individual invoice card
   - `InvoicesFilters.tsx` - Filter sheet component
   - `InvoicesSearch.tsx` - Search overlay component

2. **State Management** - 30+ useState hooks could be consolidated:
   - Use reducer for dialog state
   - Use reducer for multi-select state
   - Extract filter state to custom hook

3. **Type Safety** - Some `any` types in filtering logic:
   ```typescript
   const getInvoiceClient = (invoice: any) => { ... }
   const filterInvoices = (invoices: any[]) => { ... }
   ```

### Performance

1. **Memoization** - Some expensive computations could be better memoized:
   - `filterInvoices` is called in useMemo but could be optimized
   - Year/quarter totals recalculate on every render

2. **Query Optimization** - Multiple queries could be combined:
   - Consider a single query that returns all invoice types
   - Or use React Query's `useQueries` for parallel fetching

### UX Improvements

1. **Loading States** - No skeleton loaders for initial load
2. **Empty States** - Could be more informative with illustrations
3. **Error States** - No error boundaries or retry mechanisms
4. **Pagination** - No pagination for large invoice lists
5. **Sorting** - No sorting options (date, amount, client, etc.)
6. **Export** - No export functionality (CSV, PDF list)

### Feature Gaps

1. **Project Filter** - Project filter exists but doesn't fully work (invoices don't have direct `projectId`)
2. **Advanced Search** - No date range picker, amount range, etc.
3. **Bulk Edit** - No way to bulk edit invoice properties
4. **Templates** - No invoice templates for recurring invoices
5. **Recurring Invoices** - No recurring invoice functionality
6. **Payment Tracking** - No partial payment tracking UI (backend supports it)
7. **Reminders** - No overdue invoice reminders
8. **Email Integration** - No email sending from the page

### Mobile Experience

1. **Touch Targets** - Some buttons might be too small for mobile
2. **Swipe Actions** - No swipe-to-archive/delete gestures
3. **Pull to Refresh** - No pull-to-refresh on mobile
4. **Offline Support** - No offline caching or sync

### Accessibility

1. **Keyboard Navigation** - Multi-select might not be fully keyboard accessible
2. **Screen Readers** - Some dynamic content might not be announced
3. **Focus Management** - Focus might not be managed in dialogs

### Testing

1. **No Tests** - No unit tests or integration tests
2. **Test Coverage** - Critical paths should be tested:
   - Filtering logic
   - Search logic
   - Batch operations
   - State transitions

---

## Code Patterns & Conventions

### Naming Conventions

- Components: PascalCase (`YearTotalCard`, `InvoiceCard`)
- Hooks: camelCase with `use` prefix (`useIsMobile`, `useLongPress`)
- State: camelCase (`selectedYear`, `isMultiSelectMode`)
- Mutations: camelCase with `Mutation` suffix (`archiveMutation`)

### State Updates

Always use functional updates for Set/Map state:
```typescript
setSelectedIds(prev => new Set([...prev, id]));
```

### Dialog Management

Each dialog has:
- `open` state
- `target` state (ID or object)
- `onOpenChange` handler
- `onConfirm` handler

### Error Handling

All mutations have `onError` handlers that show toast notifications.

### Success Handling

All mutations:
1. Show success toast
2. Refetch main queries
3. Invalidate related queries
4. Close dialogs
5. Reset state

---

## Related Files

### Components
- `client/src/components/invoices/InvoiceForm.tsx` - Invoice form component
- `client/src/components/invoices/CreateInvoiceDialog.tsx` - Create dialog
- `client/src/components/invoices/InvoiceUploadReviewDialog.tsx` - Review dialog
- `client/src/components/invoices/BulkInvoiceUploadDialog.tsx` - Bulk upload
- `client/src/components/invoices/MarkAsPaidDialog.tsx` - Mark as paid dialog

### Utilities
- `client/src/lib/invoiceState.ts` - State derivation logic
- `client/src/lib/invoiceActions.ts` - Action model
- `client/src/lib/accountingDate.ts` - Accounting date calculations

### Backend
- `server/invoiceRouter.ts` - tRPC invoice router
- `server/db.ts` - Database queries
- `drizzle/schema.ts` - Database schema

### Pages
- `client/src/pages/InvoiceView.tsx` - Invoice detail/edit page
- `client/src/pages/InvoiceCreate.tsx` - Invoice create page
- `client/src/pages/InvoicesArchived.tsx` - Archived invoices page
- `client/src/pages/InvoicesRubbish.tsx` - Trashed invoices page

---

## Quick Reference

### Key Functions

```typescript
// Get invoice state
const state = getInvoiceState(invoice); // 'REVIEW' | 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID'

// Get available actions
const actions = getInvoiceActions({ invoice, selectionMode: false });

// Check if action is valid
const { valid, reason } = isActionValidForInvoice('markAsSent', invoice);

// Get derived values
const { outstanding, isPaid, isPartial, isOverdue } = getDerivedValues(invoice);

// Format currency
const formatted = formatCurrency(1234.56); // "1.234,56 â‚¬"
```

### Common Patterns

```typescript
// Toggle selection
const toggleSelection = (id: number) => {
  setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return next;
  });
};

// Handle action
const handleAction = (action: InvoiceAction, invoice: Invoice) => {
  switch (action) {
    case 'edit':
      // Navigate or open dialog
      break;
    case 'delete':
      setDeleteTargetId(invoice.id);
      setDeleteDialogOpen(true);
      break;
    // ... other actions
  }
};
```

---

## Conclusion

The Invoices page is a complex, feature-rich component that handles the full invoice lifecycle. While functional, it has opportunities for refactoring, performance optimization, and UX improvements. The codebase follows consistent patterns but would benefit from component extraction and better state management.

For improvements, focus on:
1. **Component extraction** - Break into smaller, focused components
2. **State management** - Consolidate state with reducers or context
3. **Performance** - Optimize filtering, memoization, and queries
4. **UX** - Add loading states, error handling, and better mobile experience
5. **Testing** - Add unit and integration tests for critical paths
