# Invoice Pages - Complete Information for Desktop & Mobile

This document contains all information about invoice-related pages: upload, create, edit, headers, and components for both desktop and mobile views.

---

## Table of Contents

1. [Invoice List Page (Invoices.tsx)](#invoice-list-page)
2. [Invoice Create Page](#invoice-create-page)
3. [Invoice Edit/Detail Page](#invoice-editdetail-page)
4. [Upload Components](#upload-components)
5. [Core Form Component](#core-form-component)
6. [Header Structures](#header-structures)
7. [Layout Patterns](#layout-patterns)

---

## Invoice List Page

**File:** `client/src/pages/Invoices.tsx`

### Desktop Header Structure

```typescript
// Desktop: Glass control surface header (lines 1971-2093)
<div className="glass-control-surface">
  <PageHeader
    title="Invoices"
    subtitle={/* Contextual subtitle with stats */}
    onSearch={() => setIsSearchOpen(true)}
    onFilter={() => setIsFilterOpen(true)}
    onSettings={() => navigate("/settings")}
    primaryActions={
      <>
        <Button onClick={() => setBulkUploadOpen(true)}>
          <Upload /> Upload
        </Button>
        <Button onClick={() => navigate("/invoices/new")}>
          <Plus /> Create Invoice
        </Button>
      </>
    }
  />
</div>
```

### Mobile Header Structure

```typescript
// Mobile: PageHeader component (lines 2094-2130)
<PageHeader
  title="Invoices"
  subtitle={`${invoiceStats.total} this year Â· ${invoiceStats.paid} paid Â· ${invoiceStats.due} due`}
  onSearch={() => setIsSearchOpen(true)}
  onFilter={() => setIsFilterOpen(true)}
  onSettings={() => navigate("/settings")}
  primaryActions={
    <div className="flex flex-row sm:contents gap-2 w-full sm:w-auto">
      <Button
        variant="outline"
        onClick={() => setBulkUploadOpen(true)}
        className="h-10 flex-1 sm:flex-initial"
      >
        <Upload /> Upload
      </Button>
      <Button
        onClick={() => navigate("/invoices/new")}
        className="h-10 flex-1 sm:flex-initial"
      >
        <Plus /> Create Invoice
      </Button>
    </div>
  }
/>
```

### Upload Functionality

**Bulk Upload Handler:**
```typescript
// Lines 1566-1602
const handleBulkUpload = async (files: File[]) => {
  // Converts files to base64
  // Calls: trpc.invoices.uploadInvoicesBulk.useMutation
  // Preserves file order (first selected = first uploaded)
};
```

**Upload Button Locations:**
- Desktop: In `primaryActions` of PageHeader (right side)
- Mobile: In `primaryActions` of PageHeader (stacked, full width on mobile)

**Upload Dialog:**
```typescript
// Lines 2690-2695
<BulkInvoiceUploadDialog
  open={bulkUploadOpen}
  onOpenChange={setBulkUploadOpen}
  onUpload={handleBulkUpload}
  isUploading={bulkUploadMutation.isPending}
/>
```

---

## Invoice Create Page

**File:** `client/src/pages/InvoiceCreate.tsx`

### Structure

```typescript
export default function InvoiceCreate() {
  const [dialogOpen, setDialogOpen] = useState(true);
  
  return (
    <div className="min-h-full w-full">
      <CreateInvoiceDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) navigate("/invoices");
        }}
        onSuccess={async () => {
          await utils.invoices.list.invalidate();
          navigate("/invoices");
        }}
      />
    </div>
  );
}
```

### Create Invoice Dialog Component

**File:** `client/src/components/invoices/CreateInvoiceDialog.tsx`

#### Mobile Layout

```typescript
// Mobile: Full-screen layout (lines 169-274)
<div className="flex min-h-full w-full flex-col">
  {/* PageHeader-like structure */}
  <div className="flex-shrink-0" style={{ marginBottom: 'var(--space-page-gap, 24px)' }}>
    <div className="flex items-center gap-3" style={{ paddingTop: isMobile ? '0' : '1rem' }}>
      {/* Back button (ArrowLeft) */}
      <Button variant="icon" size="icon" onClick={handleClose}>
        <ArrowLeft />
      </Button>
      
      {/* Title */}
      <h1 className="text-2xl md:text-3xl font-light">Create Invoice</h1>
      
      {/* Save button */}
      <Button type="submit" form="invoice-form">
        {isLoading ? <Loader2 /> : "Save"}
      </Button>
    </div>
  </div>

  {/* Fade-out separator */}
  <div className="separator-fade" />

  {/* InvoiceForm with preview button */}
  <InvoiceForm
    mode="create"
    contacts={contacts}
    onClose={handleClose}
    onSuccess={handleSuccess}
    hideFooterSave={true}
    renderBeforeFooter={
      <Button onClick={handleUpdatePreview}>
        <Eye /> {showInlinePreview ? "Hide Preview" : "Preview"}
      </Button>
    }
  />
</div>
```

#### Desktop Layout

**Uses:** `CreateInvoiceWorkspace` component (full-page workspace)

---

## Create Invoice Workspace (Desktop)

**File:** `client/src/components/invoices/CreateInvoiceWorkspace.tsx`

### Desktop Layout Structure

```typescript
// Desktop: Split layout with portals (lines 364-553)
<>
  {/* Backdrop overlay */}
  {createPortal(
    <div className="fixed z-[100] bg-black/50 backdrop-blur-md" />,
    document.body
  )}

  {/* Preview Panel - Left side (40vw) */}
  {createPortal(
    <div
      className="fixed z-[110] bg-background border-r shadow-lg rounded-lg"
      style={{
        top: "1.5rem",
        left: "1.5rem",
        width: "calc(40vw - 2rem)",
        height: "calc(100vh - 3rem)",
      }}
    >
      <div className="flex flex-col h-full">
        <div className="p-4 border-b">
          <h2>Preview</h2>
        </div>
        <div className="flex-1 overflow-auto">
          {/* PDF iframe preview */}
        </div>
      </div>
    </div>,
    document.body
  )}

  {/* Form Panel - Right side (60vw) */}
  {createPortal(
    <div
      className="fixed z-[110] bg-background shadow-lg rounded-lg"
      style={{
        top: "1.5rem",
        right: "1.5rem",
        bottom: "1.5rem",
        left: "calc(0.5rem + 40vw)",
        width: "calc(60vw - 2rem)",
      }}
    >
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <h1 className="text-3xl font-regular">Create Invoice</h1>
          <div className="flex items-center gap-3">
            <Button type="submit" form="invoice-form">Save</Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X />
            </Button>
          </div>
        </div>

        {/* Fade-out separator */}
        <div className="separator-fade" />

        {/* InvoiceForm */}
        <InvoiceForm
          mode="create"
          contacts={contacts}
          onClose={onClose}
          onSuccess={handleSuccess}
          hideFooterSave={true}
          renderBeforeFooter={
            <Button onClick={handleUpdatePreview}>
              <Eye /> Update Preview
            </Button>
          }
        />
      </div>
    </div>,
    document.body
  )}
</>
```

---

## Invoice Edit/Detail Page

**File:** `client/src/pages/InvoiceView.tsx`

### Layout Logic

#### Desktop Draft Invoices (Split Layout)

**Condition:** `!isMobile && invoice.source === "created" && isDraft`

```typescript
// Lines 228-421: Windowed modal with portals
<>
  {/* Backdrop overlay */}
  {createPortal(/* backdrop */, document.body)}

  {/* Preview Panel - Left (40vw) */}
  {createPortal(
    <div style={{ /* fixed positioning, 40vw width */ }}>
      {/* Preview iframe */}
    </div>,
    document.body
  )}

  {/* Form Panel - Right (60vw) */}
  {createPortal(
    <div style={{ /* fixed positioning, 60vw width */ }}>
      {/* Header with status dropdown */}
      <div className="flex items-start justify-between">
        <h1>Edit Invoice</h1>
        <div className="flex items-center gap-3">
          <InvoiceStatusActionsDropdown invoice={invoice} />
          <Button variant="ghost" size="icon" onClick={() => navigate("/invoices")}>
            <X />
          </Button>
        </div>
      </div>

      {/* InvoiceForm */}
      <InvoiceForm mode="edit" invoiceId={invoiceId} />
    </div>,
    document.body
  )}
</>
```

#### Desktop Non-Draft (Windowed)

**Condition:** `!isMobile && invoice.source === "created" && !isDraft`

Same structure as draft, but with different preview behavior.

#### Mobile or Non-Draft Single Column

**Condition:** `isMobile || !isDraft`

```typescript
// Lines 424-678
<div className="min-h-full w-full">
  {/* PageHeader-like structure */}
  <div style={{ marginBottom: 'var(--space-page-gap, 24px)' }}>
    {/* TitleRow */}
    <div className="flex items-start justify-between gap-4">
      <h1 className="text-2xl md:text-3xl font-light">Edit Invoice</h1>
      
      {/* Icon Cluster */}
      <div className="flex items-center gap-3">
        {!isMobile && (
          <InvoiceStatusActionsDropdown invoice={invoice} />
        )}
        <Link href="/invoices">
          <Button variant="icon" size="icon">
            <ArrowLeft />
          </Button>
        </Link>
      </div>
    </div>

    {/* ActionRow - Status badge (mobile only) */}
    {isMobile && (
      <div style={{ marginTop: 'var(--space-header-actions, 16px)' }}>
        <InvoiceStatusActionsDropdown invoice={invoice} />
      </div>
    )}
  </div>

  {/* Fade-out separator */}
  <div className="separator-fade" />

  {/* InvoiceForm */}
  <InvoiceForm
    mode="edit"
    invoiceId={invoiceId}
    contacts={contacts}
    onClose={() => navigate("/invoices")}
    onSuccess={async () => {
      toast.success("Invoice updated");
      await utils.invoices.list.invalidate();
    }}
    renderBeforeFooter={
      <Button onClick={handleUpdatePreview}>
        <Eye /> Update Preview
      </Button>
    }
  />
</div>
```

#### Uploaded Invoices (Review Dialog)

**Condition:** `invoice.source === "uploaded"`

**Always redirects to:** `InvoiceUploadReviewDialog` (never shows full InvoiceForm)

```typescript
// Lines 184-217
if (invoice && invoice.source === "uploaded") {
  return (
    <div className="min-h-full w-full">
      <InvoiceUploadReviewDialog
        open={reviewDialogOpen}
        onOpenChange={(open) => {
          setReviewDialogOpen(open);
          if (!open) navigate("/invoices");
        }}
        invoiceId={invoiceId}
        parsedData={null}
        onSuccess={async () => {
          await utils.invoices.list.invalidate();
          navigate("/invoices");
        }}
      />
    </div>
  );
}
```

---

## Upload Components

### Bulk Invoice Upload Dialog

**File:** `client/src/components/invoices/BulkInvoiceUploadDialog.tsx`

#### Mobile Layout

```typescript
// Mobile: Full-screen layout (lines 296-302)
if (isMobile) {
  if (!open) return null;
  return (
    <div className="flex min-h-full w-full flex-col">
      {/* PageHeader-like structure */}
      <div className="flex-shrink-0" style={{ marginBottom: 'var(--space-page-gap, 24px)' }}>
        <div className="flex items-center gap-3">
          <Button variant="icon" size="icon" onClick={handleClose}>
            <ArrowLeft />
          </Button>
          <h1 className="text-2xl md:text-3xl font-light">Upload Invoices</h1>
        </div>
      </div>

      {/* Fade-out separator */}
      <div className="separator-fade" />

      {/* Upload zone and file list */}
      <div className="pt-2 overflow-y-auto flex-1">
        <InvoiceUploadZone
          onUpload={handleFilesSelected}
          isUploading={isUploading}
          maxFiles={MAX_FILES}
        />
        {/* File list and errors */}
      </div>

      {/* Footer buttons */}
      <div className="flex flex-col gap-2 pt-4 pb-4">
        <Button variant="outline" onClick={handleClose}>Cancel</Button>
        <Button onClick={handleUpload}>
          <Upload /> Upload {selectedFiles.length} file(s)
        </Button>
      </div>
    </div>
  );
}
```

#### Desktop Layout

```typescript
// Desktop: Dialog component (lines 307-316)
return (
  <Dialog open={open} onOpenChange={handleClose}>
    <DialogContent className="flex flex-col p-0 max-w-2xl" showCloseButton={false}>
      {/* Same content structure as mobile */}
    </DialogContent>
  </Dialog>
);
```

### Invoice Upload Zone

**File:** `client/src/components/invoices/InvoiceUploadZone.tsx`

**Features:**
- Drag & drop support
- File picker button
- PDF validation
- Max 10 files
- Loading state

---

## Invoice Upload Review Dialog

**File:** `client/src/components/InvoiceUploadReviewDialog.tsx`

### Desktop Layout (Split)

```typescript
// Desktop: Windowed modal with portals (lines 1414-1527)
<>
  {/* Backdrop overlay */}
  {createPortal(/* backdrop */, document.body)}

  {/* Preview Panel - Left (40vw) */}
  {createPortal(
    <div style={{ /* fixed, 40vw width */ }}>
      {/* PDF preview iframe */}
    </div>,
    document.body
  )}

  {/* Form Panel - Right (60vw) */}
  {createPortal(
    <div style={{ /* fixed, 60vw width */ }}>
      {/* Header with status badge and three-dot menu */}
      <div className="flex items-center gap-3">
        <Button variant="icon" onClick={handleClose}>
          <X />
        </Button>
        <h1 className="text-2xl md:text-3xl font-light">
          {isReview ? "Review Invoice" : "Edit Invoice"}
        </h1>
        <div className="flex items-center gap-2">
          {renderStatusButton(invoice)}
          <DropdownMenu>
            {/* Three-dot menu for actions */}
          </DropdownMenu>
        </div>
      </div>

      {/* Form fields */}
      <div className="space-y-4">
        <Select value={clientId} /* Client select */ />
        <Input value={invoiceNumber} /* Invoice number */ />
        <Input value={totalAmount} /* Total amount */ />
        <Input type="date" value={issueDate} /* Invoice date */ />
        <Input type="date" value={dueDate} /* Due date */ />
      </div>

      {/* Footer buttons (review state only) */}
      {isReview && (
        <div className="flex gap-2">
          <Button onClick={handleMarkAsSent}>Mark as Sent</Button>
          <Button onClick={handleMarkAsPaid}>Mark as Paid</Button>
          <Button onClick={handleSave}>Save</Button>
          <Button variant="destructive" onClick={handleDelete}>Delete</Button>
        </div>
      )}
    </div>,
    document.body
  )}
</>
```

### Mobile Layout

```typescript
// Mobile: Fullscreen layout (lines 1530-1582)
<>
  {/* Same header structure as desktop */}
  <div className="flex min-h-full w-full flex-col">
    {/* PageHeader-like structure */}
    <div className="flex-shrink-0" style={{ marginBottom: 'var(--space-page-gap, 24px)' }}>
      <div className="flex items-center gap-3">
        <Button variant="icon" onClick={handleClose}>
          <ArrowLeft />
        </Button>
        <h1 className="text-2xl md:text-3xl font-light">
          {isReview ? "Review Invoice" : "Edit Invoice"}
        </h1>
        <div className="flex items-center gap-2">
          {renderStatusButton(invoice)}
          <DropdownMenu>
            {/* Three-dot menu */}
          </DropdownMenu>
        </div>
      </div>
    </div>

    {/* Fade-out separator */}
    <div className="separator-fade" />

    {/* Form fields (scrollable) */}
    <div className="space-y-4 pt-2 overflow-y-auto flex-1">
      {/* Same form fields as desktop */}
      
      {/* Preview button (mobile only) */}
      {isMobile && (
        <Button onClick={handlePreviewPDF}>
          <Eye /> Preview
        </Button>
      )}
    </div>

    {/* Footer buttons (review state only) */}
    {isReview && (
      <div className="flex flex-col gap-2 pt-4 pb-4">
        <Button onClick={handleMarkAsSent}>Mark as Sent</Button>
        <Button onClick={handleMarkAsPaid}>Mark as Paid</Button>
        <Button onClick={handleSave}>Save</Button>
        <Button variant="destructive" onClick={handleDelete}>Delete</Button>
      </div>
    )}
  </div>
</>
```

---

## Core Form Component

**File:** `client/src/components/invoices/InvoiceForm.tsx`

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
  hideFooterSave?: boolean;
  getLoadingStateRef?: React.MutableRefObject<(() => boolean) | null>;
}
```

### Form Fields

1. **Invoice Number** - Auto-generated, can override
2. **Client** - Dropdown select from contacts
3. **Issue Date** - Required, defaults to today
4. **Due Date** - Optional, required before sending
5. **Service Period Start/End** - Optional dates
6. **Line Items** - Dynamic list (edited via modal)
7. **Partial Invoice** - Boolean switch
8. **Anmerkungen (Notes)** - Textarea
9. **Bedingungen (Terms)** - Textarea
10. **Order/Reference Number** - Text input

### Footer Buttons

```typescript
{/* Footer buttons */}
<div className="flex flex-col gap-2 pt-4 border-t">
  {/* Custom content before footer */}
  {renderBeforeFooter}
  
  {/* Send button (draft only) */}
  {!isCreate && invoice && invoiceState === 'DRAFT' && !isCancelled && (
    <Button onClick={handleSend}>
      <Send /> Send
    </Button>
  )}
  
  {/* Delete and Save buttons */}
  {!hideFooterSave && (
    <div className="flex gap-2 pt-2 border-t">
      {!isCreate && invoice && (
        <Button variant="destructive-outline" onClick={handleDelete}>
          Delete
        </Button>
      )}
      <Button type="submit" form="invoice-form" disabled={isReadOnly}>
        {isLoading ? <Loader2 /> : "Save"}
      </Button>
    </div>
  )}
</div>
```

---

## Header Structures

### PageHeader Component

**File:** `client/src/components/PageHeader.tsx`

#### Default Variant (List Pages)

```typescript
<PageHeader
  title="Invoices"
  subtitle="Optional subtitle"
  onSearch={() => {}}
  onFilter={() => {}}
  onSettings={() => {}}
  primaryActions={<Button>Action</Button>}
/>
```

**Structure:**
- TitleRow: Title (left) + Icon Cluster (right)
- SubtitleRow: Full-width subtitle
- ActionRow: Primary actions (right-aligned desktop, stacked mobile)

#### Detail Variant

```typescript
<PageHeader
  variant="detail"
  title="Edit Invoice"
  subtitle="Optional subtitle"
  leading={<Button><ChevronLeft /></Button>}
  primaryActions={<Button>Action</Button>}
/>
```

**Structure:**
- TitleRow: Leading (back button) + Title
- SubtitleRow: Full-width subtitle
- ActionRow: Primary actions

### Custom Header Patterns

**Used in dialogs and workspaces:**

```typescript
{/* PageHeader-like structure */}
<div className="flex-shrink-0" style={{ marginBottom: 'var(--space-page-gap, 24px)' }}>
  {/* TitleRow */}
  <div className="flex items-center gap-3">
    <Button variant="icon" size="icon" onClick={onClose}>
      <ArrowLeft /> {/* Mobile */} or <X /> {/* Desktop */}
    </Button>
    <h1 className="text-2xl md:text-3xl font-light">Title</h1>
    {/* Optional: Save button or other actions */}
  </div>
</div>

{/* Fade-out separator */}
<div className="separator-fade" style={{ marginTop: '12px', marginBottom: '12px' }} />
```

---

## Layout Patterns

### Desktop Split Layout (Create/Edit)

**Used in:**
- `CreateInvoiceWorkspace` (create)
- `InvoiceView` (edit, draft only)
- `InvoiceUploadReviewDialog` (review uploaded)

**Structure:**
- Backdrop overlay (z-100)
- Preview panel: Left side, 40vw width, fixed positioning
- Form panel: Right side, 60vw width, fixed positioning
- Both panels: z-110, rounded corners, shadow

### Mobile Full-Screen Layout

**Used in:**
- `CreateInvoiceDialog` (create)
- `InvoiceView` (edit, non-draft)
- `BulkInvoiceUploadDialog` (upload)
- `InvoiceUploadReviewDialog` (review)

**Structure:**
- Full-screen container: `flex min-h-full w-full flex-col`
- Header: Fixed at top with back button
- Content: Scrollable (`overflow-y-auto flex-1`)
- Footer: Fixed at bottom (if needed)

### Desktop Windowed Modal

**Used in:**
- `InvoiceView` (edit, all states)
- `InvoiceUploadReviewDialog` (review)

**Structure:**
- Portal-based rendering to `document.body`
- Backdrop: `fixed z-[100]`, blocks background scroll
- Content panels: `fixed z-[110]`, positioned with calc()

---

## Key Features Summary

### Upload
- **Bulk upload:** Up to 10 PDF files at once
- **Single upload:** Via `InvoiceUploadZone` component
- **Validation:** PDF only, max 50MB per file
- **Processing:** AI OCR extraction via `documents.process`

### Create
- **Desktop:** Split layout (preview left, form right)
- **Mobile:** Full-screen with inline preview toggle
- **Auto-numbering:** From company settings
- **Preview:** Real-time PDF generation

### Edit
- **Created invoices:** Full form editing
- **Uploaded invoices:** Review dialog (limited fields)
- **Draft state:** Split layout on desktop
- **Sent/Paid state:** Read-only fields

### Headers
- **List page:** PageHeader with search/filter/settings icons
- **Create/Edit:** Custom header with back button and title
- **Mobile:** Stacked primary actions
- **Desktop:** Horizontal primary actions

---

## File Reference

| Component | File Path |
|-----------|-----------|
| Invoice List Page | `client/src/pages/Invoices.tsx` |
| Invoice Create Page | `client/src/pages/InvoiceCreate.tsx` |
| Invoice View Page | `client/src/pages/InvoiceView.tsx` |
| Invoice Form | `client/src/components/invoices/InvoiceForm.tsx` |
| Create Dialog (Mobile) | `client/src/components/invoices/CreateInvoiceDialog.tsx` |
| Create Workspace (Desktop) | `client/src/components/invoices/CreateInvoiceWorkspace.tsx` |
| Bulk Upload Dialog | `client/src/components/invoices/BulkInvoiceUploadDialog.tsx` |
| Upload Zone | `client/src/components/invoices/InvoiceUploadZone.tsx` |
| Review Dialog | `client/src/components/InvoiceUploadReviewDialog.tsx` |
| Page Header | `client/src/components/PageHeader.tsx` |
| Dashboard Layout | `client/src/components/DashboardLayout.tsx` |

---

## Responsive Breakpoints

- **Mobile:** `useIsMobile()` hook (typically < 768px)
- **Desktop:** `!isMobile` (typically >= 768px)

## Z-Index Layers

- Backdrop: `z-[100]`
- Content panels: `z-[110]`
- Dialogs: `z-[120]` (via Dialog component)
- Preview modals: `z-50` (via PDFPreviewModal)

---

*Last Updated: 2024-12-17*
