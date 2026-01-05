---
name: ""
overview: ""
todos: []
---

# Add Mark as Sent/Paid Buttons to Uploaded Invoice Dialog (Section 19 Implementation)

## Overview

Implement Section 19 of the LOCKED spec: "Historical Invoice Import (Uploaded Invoices Implementation)". Add "Mark as Sent" and "Mark as Paid" buttons that ONLY appear in REVIEW state for uploaded invoices. Replace "Cancel" with "Delete" button for all states. After review state ends, uploaded invoices follow standard header/footer layout.

## Critical Requirements from Section 19

1. **Buttons ONLY in REVIEW state** (`needsReview: true`) for uploaded invoices
2. **No validation required** - these set historical timestamps
3. **No share link creation** - direct timestamp setting
4. **No Cancel button** - only Delete button exists
5. **Delete logic**: Hard delete in review, soft delete (trash) after review

## Changes Required

### 1. Backend: Update markAsSent and markAsPaid Mutations

**File:** `server/invoiceRouter.ts`

#### Update checkInvoiceNeedsReview Exception

Modify `markAsSent` and `markAsPaid` to allow uploaded invoices in review state:

```typescript
// In markAsSent mutation (line ~671)
// BEFORE: checkInvoiceNeedsReview(invoice, "sent");
// AFTER: Allow uploaded invoices in review state
if (invoice.source === "uploaded" && invoice.needsReview) {
  // Allow - this is the historical import use case
} else {
  checkInvoiceNeedsReview(invoice, "sent");
}

// In markAsPaid mutation (line ~510)
// BEFORE: checkInvoiceNeedsReview(invoice, "marked as paid");
// AFTER: Allow uploaded invoices in review state
if (invoice.source === "uploaded" && invoice.needsReview) {
  // Allow - this is the historical import use case
} else {
  checkInvoiceNeedsReview(invoice, "marked as paid");
}
```



#### Verify markAsPaid Sets amountPaid

Ensure `markAsPaid` sets `amountPaid = totalAmount` (per Section 19):

- Check `db.markInvoiceAsPaid()` implementation
- If not set, update to set `amountPaid = invoice.totalAmount`

### 2. Frontend: Update InvoiceUploadReviewDialog

**File:** `client/src/components/InvoiceUploadReviewDialog.tsx`

#### Add New Mutations

Add mutations after existing mutations (around line ~141):

```typescript
const markAsSentMutation = trpc.invoices.markAsSent.useMutation({
  onSuccess: () => {
    toast.success("Invoice marked as sent");
    utils.invoices.get.invalidate({ id: invoiceId! });
    utils.invoices.list.invalidate();
  },
  onError: (error) => {
    toast.error("Failed to mark as sent: " + error.message);
  },
});

const markAsPaidMutation = trpc.invoices.markAsPaid.useMutation({
  onSuccess: () => {
    toast.success("Invoice marked as paid");
    utils.invoices.get.invalidate({ id: invoiceId! });
    utils.invoices.list.invalidate();
  },
  onError: (error) => {
    toast.error("Failed to mark as paid: " + error.message);
  },
});

const moveToTrashMutation = trpc.invoices.moveToTrash.useMutation({
  onSuccess: () => {
    toast.success("Invoice moved to trash");
    onOpenChange(false);
    utils.invoices.list.invalidate();
    onSuccess?.();
  },
  onError: (error) => {
    toast.error("Failed to delete invoice: " + error.message);
  },
});
```



#### Add Handler Functions

Add handlers after existing handlers (around line ~310):

```typescript
const handleMarkAsSent = async () => {
  if (!invoiceId) return;
  await markAsSentMutation.mutateAsync({ id: invoiceId });
};

const handleMarkAsPaid = async () => {
  if (!invoiceId) return;
  await markAsPaidMutation.mutateAsync({ id: invoiceId });
};

const handleDelete = async () => {
  if (!invoiceId || !invoice) return;
  
  if (isReview) {
    // In review state: Cancel upload (hard delete)
    await cancelMutation.mutateAsync({ id: invoiceId });
  } else {
    // After review: Move to trash (soft delete)
    await moveToTrashMutation.mutateAsync({ id: invoiceId });
  }
};
```



#### Replace Footer Button Section

Replace the footer button section (lines ~524-569) with Section 19 layout:**For REVIEW state (uploaded invoices only):**

```typescript
{isReview && invoice?.source === "uploaded" && (
  <div className={cn(
    "pt-4 border-t",
    isMobile ? "flex flex-col gap-2 w-full" : "flex flex-col gap-2"
  )}>
    {/* Mark as Sent (only if not already sent) */}
    {!invoice.sentAt && (
      <Button 
        onClick={handleMarkAsSent} 
        disabled={isLoading || markAsSentMutation.isPending}
        className={isMobile ? "w-full" : ""}
      >
        {markAsSentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Mark as Sent
      </Button>
    )}

    {/* Mark as Paid (only if not already paid) */}
    {!invoice.paidAt && (
      <Button 
        onClick={handleMarkAsPaid} 
        disabled={isLoading || markAsPaidMutation.isPending}
        className={isMobile ? "w-full" : ""}
      >
        {markAsPaidMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Mark as Paid
      </Button>
    )}

    {/* Save */}
    <Button 
      onClick={handleSave} 
      disabled={isLoading || !isFormValid}
      className={isMobile ? "w-full" : ""}
    >
      {(confirmMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Save
    </Button>

    {/* Delete (NO Cancel button) */}
    <Button
      variant="destructive"
      onClick={handleDelete}
      disabled={isLoading || cancelMutation.isPending}
      className={isMobile ? "w-full" : ""}
    >
      {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Delete
    </Button>
  </div>
)}
```

**For AFTER review state (needsReview: false):**

Keep existing footer logic but:

- Replace "Cancel" with "Delete" button
- Update `handleCancel` to call `handleDelete` instead
- Delete button uses `moveToTrashMutation` for all non-review states

### 3. Remove Cancel Button Logic

**File:** `client/src/components/InvoiceUploadReviewDialog.tsx`

- Remove `handleCancel` function (or rename to `handleDelete`)
- Remove all references to "Cancel" button
- Ensure Delete button is always visible

### 4. Update Loading State

Update `isLoading` to include new mutations:

```typescript
const isLoading = 
  confirmMutation.isPending || 
  updateMutation.isPending || 
  cancelMutation.isPending || 
  revertToDraftMutation.isPending || 
  revertToSentMutation.isPending ||
  markAsSentMutation.isPending ||
  markAsPaidMutation.isPending ||
  moveToTrashMutation.isPending;
```



## Implementation Details

### Button Visibility Rules

**REVIEW state (uploaded invoices only):**

- "Mark as Sent": `isReview && invoice.source === "uploaded" && !invoice.sentAt`
- "Mark as Paid": `isReview && invoice.source === "uploaded" && !invoice.paidAt`
- "Save": Always visible when not read-only
- "Delete": Always visible

**After REVIEW (needsReview: false):**

- Standard header/footer layout applies
- "Delete" replaces "Cancel"
- Revert buttons appear per existing logic

### Delete Button Behavior

- **Review state**: Calls `cancelUploadedInvoice` (hard delete, removes S3 file)
- **Draft state**: Calls `moveToTrash` (soft delete)
- **Sent/Paid state**: Calls `moveToTrash` (soft delete for audit safety)
- **Never disabled**: Always allows deletion (uses appropriate method)

### Validation

- **Mark as Sent**: No validation (historical fact)
- **Mark as Paid**: No validation (historical fact)
- Both only work for uploaded invoices
- Both only visible in review state

## Testing Checklist

- [ ] "Mark as Sent" button appears ONLY in review state for uploaded invoices
- [ ] "Mark as Sent" sets `sentAt` timestamp without creating share link
- [ ] "Mark as Sent" button disappears after being clicked
- [ ] "Mark as Paid" button appears ONLY in review state for uploaded invoices
- [ ] "Mark as Paid" sets `paidAt` and `amountPaid = totalAmount`
- [ ] "Mark as Paid" button disappears after being clicked
- [ ] "Delete" button replaces "Cancel" in all states
- [ ] "Delete" in review state: hard deletes (cancels upload)
- [ ] "Delete" in draft/sent/paid state: soft deletes (moves to trash)
- [ ] Buttons do NOT appear for created invoices
- [ ] After saving review, buttons disappear and standard layout applies
- [ ] Backend allows markAsSent/markAsPaid for uploaded invoices in review
- [ ] All mutations properly invalidate queries and show toasts

## Alignment with LOCKED Spec

- ✅ Section 5: Review State exception for uploaded invoices
- ✅ Section 19: Complete implementation guide
- ✅ Buttons ONLY in review state (not after)
- ✅ No validation required (historical facts)
- ✅ No share link creation
- ✅ Delete replaces Cancel entirely