# Mantodeus Manager — Invoice Lifecycle v1 (LOCKED SPEC)

## 🔒 SPEC STATUS: LOCKED FOR V1

**If anything contradicts this spec during implementation, the spec wins.**---

## 1. Core Principles

- **Mobile-first, builder-proof**
- **Timestamps are the source of truth**
- **No accounting over-engineering**
- **No silent money loss**
- **One clear path forward, limited paths backward**

---

## 2. Source-of-Truth Fields (Database)

### Required

```typescript
needsReview: boolean
sentAt: datetime | null
paidAt: datetime | null
amountPaid: decimal(10,2) NOT NULL DEFAULT 0
totalAmount: decimal(10,2)
dueDate: date | null
```



### Optional (v1, backend tracking only)

```typescript
lastPaymentAt: datetime | null
```



### shared_documents table

```typescript
invalidated: boolean NOT NULL DEFAULT false
invalidatedAt: datetime | null
```

---

## 3. Derived Invoice State (UI-only)

```typescript
function getInvoiceState(invoice) {
  if (invoice.needsReview) return 'REVIEW';
  if (!invoice.sentAt) return 'DRAFT';
  if (invoice.paidAt) return 'PAID';
  if (invoice.amountPaid > 0) return 'PARTIAL';
  return 'SENT';
}
```



### Derived Values (never stored)

```typescript
outstanding = totalAmount - amountPaid
isPaid = outstanding <= 0
isPartial = amountPaid > 0 && outstanding > 0
isOverdue = sentAt !== null && !isPaid && dueDate && dueDate < today
```

❗ **No status field drives UI decisions in v1.**---

## 4. Allowed Transitions (STRICT)

### Forward

- `REVIEW → DRAFT` (Save)
- `DRAFT → SENT` (via Share / Send)
- `SENT → PARTIAL` (Add Payment)
- `PARTIAL → PAID` (Add Payment completing balance)

### Revert (Guarded)

- `SENT → DRAFT` **only if amountPaid === 0**
- `PAID → SENT` (requires typed REVERT, clears paidAt, keeps amountPaid)
- `PARTIAL → DRAFT` ❌ **NOT ALLOWED**

---

## 5. Review State (Uploaded Invoices)

### Footer

- Save
- Cancel

🚫 **No lifecycle actions allowed in review**

🚫 **No sending**

🚫 **No payments**---

## 6. Draft State

- Fully editable
- No payments allowed
- `dueDate` optional while editing
- **Send disabled until `dueDate` is set**

---

## 7. Send / Share Flow (CRITICAL RULES)

### Send Validation (required before send)

```typescript
✅ dueDate must be set (not null)
✅ totalAmount must be > 0
✅ Past due dates ARE allowed (overdue badge triggers immediately)
```



### Share Link Behavior

- Creating a share link **automatically sets `sentAt`** if null
- Default share link expiry: **30 days**
- **Always regenerate PDF with latest invoice data** (no stale PDFs)
- Regenerate token (new URL)
- Regenerating share link **does NOT modify `sentAt`**
- Old links remain valid until expiry

### Share Link Creation Failure

- If PDF generation or link creation fails, **`sentAt` is NOT set**
- User can retry

---

## 8. Sent State

- Invoice becomes **read-only**
- No field edits allowed
- Payments allowed
- Header button shows **Sent** (disabled)
- Badges may appear (see section 11)

---

## 9. Payments (v1 Simple Model)

### Add Payment Dialog

- Amount only (no date picker)
- Auto-sets `lastPaymentAt = now()`
- **Strict validation: `amount ≤ outstanding`**
- No editing or deleting payments in v1

### Backend Logic

```typescript
// Validation
if (amount <= 0) throw error;
if (amount + amountPaid > totalAmount) throw error("Payment would exceed invoice total");

// Update
amountPaid += paymentAmount;
lastPaymentAt = now();
if (amountPaid === totalAmount) {
  paidAt = now();
}
```



### UI Display Safety

```typescript
displayOutstanding = Math.max(0, totalAmount - amountPaid)
```

⚠️ **Backend must prevent negative outstanding**

⚠️ **Clamp is UI safety only, not logic**---

## 10. Paid State

- Fully read-only
- Header button shows **Paid** (disabled)
- Revert requires:
- Confirmation dialog
- Typed **REVERT**
- Clears `paidAt` only (`amountPaid` remains)

---

## 11. Badges (UI)

**Badges are informational only, never lifecycle buttons.**

### PARTIAL

- `amountPaid > 0 && !paidAt`
- Amber badge
- Header button remains **"Sent"**

### OVERDUE

- `sentAt !== null`
- `!paidAt`
- `dueDate < today`
- Red badge

📍 **Badges appear:**

- Invoice list
- Invoice detail header (near title, responsive-safe)

---

## 12. Outstanding Display Rule

```typescript
displayOutstanding = Math.max(0, totalAmount - amountPaid)
```

⚠️ **Backend must prevent negative outstanding**

⚠️ **Clamp is UI safety only, not logic**---

## 13. Revert Confirmation Rules

| Action | Requirement |

|--------|-------------|

| Paid → Sent | Typed **REVERT** |

| Sent → Draft (no payments) | Confirmation dialog only |

| Any revert with payments | Blocked unless Paid → Sent |---

## 14. Database Migration (MANDATORY)

Migration must:

1. Add `amountPaid` (default 0) to `invoices`
2. Add `lastPaymentAt` (nullable) to `invoices`
3. Add `invalidated` (default false) to `shared_documents`
4. Add `invalidatedAt` (nullable) to `shared_documents`
5. **Backfill:**
```sql
UPDATE invoices
SET amountPaid = totalAmount
WHERE paidAt IS NOT NULL AND amountPaid = 0;
```


🚫 **App must not ship without this.**---

## 15. Re-Sending Edited Invoices (v1)

### If invoice has been sent but has not received any payments:

1. User may revert `SENT → DRAFT` (only if `amountPaid === 0`)
2. Reverting to DRAFT:

- **Invalidates all existing share links**
- Old share links return **410 Gone**
- Implementation: Mark all related `shared_documents` as:
    - `invalidated = true`
    - `invalidatedAt = now()`

3. User edits invoice
4. User re-sends invoice:

- New share link is created (new `shared_document` record)
- New PDF is generated with updated data
- **`sentAt` is updated to new timestamp**

### Public Share Endpoint Logic

```typescript
// GET /share/:token
if (sharedDoc.invalidated === true) {
  return 410 Gone
}
if (sharedDoc.expiresAt < now()) {
  return 410 Gone
}
// else serve PDF
```



### Why this model:

- No ambiguity ("which invoice is correct?")
- No multiple PDFs floating around
- Invalidated links can never be reused
- Clean client experience
- Builder-proof mental model

### If invoice has received payments:

- `SENT → DRAFT` revert is **blocked**
- User must revert `PAID → SENT` first (if applicable)
- Cannot edit invoices with money received

---

## 16. Testing Requirements (MINIMUM)

### Migration

- [ ] Paid invoices remain PAID
- [ ] Sent invoices remain SENT
- [ ] No invoice becomes PARTIAL incorrectly
- [ ] Backfill sets `amountPaid = total` for paid invoices

### Lifecycle

- [ ] Cannot send without `dueDate`
- [ ] Cannot send with `totalAmount = 0`
- [ ] Past `dueDate` allowed (triggers immediate overdue badge)
- [ ] Cannot revert to draft if `amountPaid > 0`
- [ ] Payments never exceed total
- [ ] Overdue badge triggers correctly

### Share Flow

- [ ] Send button validates `dueDate` and `totalAmount > 0`
- [ ] Creating share link sets `sentAt` (if null)
- [ ] Regenerating share link does NOT modify `sentAt`
- [ ] Regenerated share link has new PDF with latest data
- [ ] Share link creation failure does NOT set `sentAt`
- [ ] Old share links remain valid until expiry
- [ ] Reverting SENT → DRAFT invalidates all share links (410 Gone)
- [ ] Re-sent invoice creates new share link + PDF
- [ ] `sentAt` updated on re-send

### Payment Logic

- [ ] Adding payment updates `amountPaid`
- [ ] Adding payment that equals outstanding sets `paidAt`
- [ ] Adding payment exceeding outstanding is blocked
- [ ] `lastPaymentAt` auto-set on payment
- [ ] Negative outstanding never displays (clamped to 0)

### Revert Logic

- [ ] `PARTIAL → DRAFT` is blocked
- [ ] `PAID → SENT` requires typed "REVERT"
- [ ] `SENT → DRAFT` works only if `amountPaid === 0`
- [ ] Reverting PAID to SENT keeps `amountPaid`, clears `paidAt`
- [ ] Reverting SENT to DRAFT invalidates all share links

### Mobile

- [ ] Primary lifecycle action always visible
- [ ] No accidental send/payment taps
- [ ] Header buttons don't wrap unpredictably

---

## 17. Explicitly Out of Scope (v1)

- ❌ Payment ledger
- ❌ Payment history table
- ❌ Editing or deleting payments
- ❌ Credit notes / overpayments
- ❌ Late fees / interest
- ❌ Automated reminders
- ❌ Bank sync
- ❌ Audit trail (user tracking)

**All of that can be layered later without breaking this model.**---

## 18. Audit Trail (Deferred to v2)

V1 does **not** track:

- ❌ Who sent the invoice
- ❌ Who added payments
- ❌ Who reverted status
- ❌ Edit history

This is **intentionally deferred** to prevent v1 scope creep. Future audit requirements will be addressed when financial compliance demands it.---

## FINAL STATUS

🔒 **LOCKED FOR V1**