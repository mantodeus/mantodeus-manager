# LOCKED SPEC v1 - Final Amendments Summary

## 🔒 Status: LOCKED FOR IMPLEMENTATION

**Date:** 2026-01-05
**Spec File:** [invoice_ui_state_management_redesign_LOCKED_v1.plan.md](invoice_ui_state_management_redesign_LOCKED_v1.plan.md)

---

## 📋 What Changed (Final Amendments)

### 1. ✅ Section 5: Review State - Historical Import Exception

**OLD:**
```markdown
## 5. Review State (Uploaded Invoices)

Footer:
- Save
- Cancel

🚫 No lifecycle actions allowed in review
```

**NEW:**
```markdown
## 5. Review State (Uploaded Invoices - EXCEPTION FOR HISTORICAL IMPORTS)

Footer (Uploaded Invoices ONLY):
- Mark as Sent (if not already sent) - Sets historical state
- Mark as Paid (if not already paid) - Sets historical state
- Save - Saves and exits review state
- Delete - Cancels upload, removes invoice

Why: Uploaded invoices are historical records (PDFs from old systems).
     They need immediate state assignment to match historical reality.

Rules:
1. "Mark as Sent/Paid" buttons ONLY appear in REVIEW state
2. These set historical timestamps WITHOUT share link creation
3. After saving review, standard header/footer rules apply
4. NO Cancel button - Only Delete
```

---

### 2. ✅ NEW Section 19: Historical Invoice Import Implementation

Added complete implementation guide for uploaded invoices:

**Backend Mutations:**
- `markAsSent` - Sets `sentAt` without share link (uploaded invoices only)
- `markAsPaid` - Sets `paidAt` + `amountPaid = totalAmount` (uploaded invoices only)

**UI Implementation:**
- Review state: Shows "Mark as Sent/Paid" buttons in footer
- After review: Standard header/footer separation applies
- Delete button always visible (replaces Cancel)

**Validation:**
- Backend rejects `markAsSent`/`markAsPaid` for non-uploaded invoices
- No validation required (historical facts, not new actions)

---

### 3. ✅ Delete Button Logic (No Cancel Button)

**NEW RULE:** No Cancel button exists anywhere in invoice dialogs.

**Delete behavior:**
```typescript
if (isReview) {
  // Hard delete (cancel upload)
  cancelUploadedInvoice();
} else {
  // Soft delete (move to trash - audit safety)
  moveToTrash();
}
```

**Button visibility:**
- Always visible in all states
- Never disabled (uses soft delete for sent/paid invoices)

---

### 4. ✅ Updated Testing Requirements

Added new test sections:

**Historical Invoice Import:**
- [ ] "Mark as Sent/Paid" only appear in REVIEW state
- [ ] Buttons disappear after review state ends
- [ ] Mutations reject non-uploaded invoices
- [ ] Delete works correctly in all states

**Button Layout:**
- [ ] No Cancel button exists anywhere
- [ ] Delete always visible
- [ ] Delete never disabled

---

## 🎯 Key Principles (Unchanged)

1. **Timestamps are source of truth** - No status field drives UI
2. **One clear path forward** - Limited paths backward
3. **No silent money loss** - `PARTIAL → DRAFT` blocked
4. **Builder-proof** - Explicit exceptions documented
5. **Mobile-first** - Primary actions always visible

---

## 📊 Implementation Checklist

Before starting implementation:

- [x] Review Section 5 (historical import exception)
- [x] Review Section 19 (implementation details)
- [x] Understand Delete vs Cancel logic (no Cancel exists)
- [x] Backend mutations verify `uploadId` for historical imports
- [x] UI shows "Mark as Sent/Paid" ONLY in review state for uploaded invoices
- [x] After review, all invoices follow standard layout

---

## ⚠️ Critical Notes

### Uploaded vs Created Invoices

**Uploaded Invoices (Historical):**
- Review state: Mark as Sent/Paid allowed (exception)
- After review: Standard rules apply

**Created Invoices (New):**
- Review state: NO lifecycle actions (standard rule)
- Send flow: Via share link creation (Section 7)

### Why This Exception Exists

Uploaded invoices represent **past events** (already sent via email, postal mail, other systems months/years ago). They need immediate state assignment during review to match historical reality.

After review ends (`needsReview: false`), they behave identically to created invoices.

---

## 🔥 What to Remember

1. **"Mark as Sent/Paid" = Uploaded invoices in REVIEW state ONLY**
2. **No Cancel button anywhere** - Only Delete
3. **Delete uses soft delete for sent/paid** - Audit safety
4. **After review, all invoices follow same rules** - No special cases

---

## 🚀 Ready to Implement

**LOCKED SPEC:** [invoice_ui_state_management_redesign_LOCKED_v1.plan.md](invoice_ui_state_management_redesign_LOCKED_v1.plan.md)

**If anything contradicts this spec during implementation, the spec wins.**
