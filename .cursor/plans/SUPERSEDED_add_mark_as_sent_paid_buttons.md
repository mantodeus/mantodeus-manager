# ⚠️ PLAN SUPERSEDED

**Old Plan:** [add_mark_as_sent_paid_buttons_to_uploaded_invoice_dialog_4257ebfb.plan.md](add_mark_as_sent_paid_buttons_to_uploaded_invoice_dialog_4257ebfb.plan.md)

**Replaced By:** [invoice_ui_state_management_redesign_LOCKED_v1.plan.md](invoice_ui_state_management_redesign_LOCKED_v1.plan.md) - **Section 19: Historical Invoice Import**

---

## Why This Plan Was Superseded

The old plan had **incorrect button visibility logic**:

### ❌ OLD (Incorrect)
```typescript
// Show buttons when NOT in review
{!isReview && (
  <Button onClick={handleMarkAsSent}>Mark as Sent</Button>
)}
```

### ✅ NEW (Correct)
```typescript
// Show buttons ONLY in review state for uploaded invoices
{isReview && isUploaded && (
  <Button onClick={handleMarkAsSent}>Mark as Sent</Button>
)}
```

---

## What Changed

1. **Button visibility:** `!isReview` → `isReview` (buttons ONLY in review state)
2. **After review:** Standard header/footer separation applies (Section 13)
3. **Cancel button:** Removed entirely - Only Delete button exists
4. **Delete logic:** Always uses soft delete for sent/paid (audit safety)

---

## Where to Find Correct Implementation

**LOCKED SPEC v1:**
- Section 5: Review State exception for uploaded invoices
- Section 19: Complete implementation guide with backend mutations, UI layout, and testing

**Summary:** [LOCKED_SPEC_AMENDMENTS.md](LOCKED_SPEC_AMENDMENTS.md)

---

## DO NOT USE THIS OLD PLAN

Use only: [invoice_ui_state_management_redesign_LOCKED_v1.plan.md](invoice_ui_state_management_redesign_LOCKED_v1.plan.md)

**If anything contradicts the LOCKED spec, the spec wins.**
