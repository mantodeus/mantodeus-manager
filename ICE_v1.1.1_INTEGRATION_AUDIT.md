# 🔍 ICE-v1.1.2 Integration Audit Report — Clarified Doctrine Edition

**Project**: Mantodeus Manager
**Audit Date**: 2026-01-19
**Auditor**: Senior Staff Engineer / Architect
**Scope**: Invoice Completeness Engine (ICE-v1.1.2) Integration
**Doctrine**: Legal Finality vs. Draft Visualization

---

## Executive Doctrine Statement (Authoritative)

**ICE is the constitutional authority for legal finality (SEND).**
**ICE is not the authority for draft visualization (PREVIEW).**

- **Preview** is a working artifact for iteration and inspection
- **Send** is a legal action with §14 UStG compliance requirements

All integration decisions below follow this doctrine.

---

## Critical Findings

1. **§14 UStG Compliance Gap**: Missing recipient address snapshot (HIGH PRIORITY)
2. **Extensive Duplicate Logic**: 8+ validation points duplicating ICE rules
3. **UI/Server Divergence**: UI invents completeness logic independently of ICE
4. **ICE Scope Refinement Required**: PREVIEW blocking must be minimal (renderability only)

---

## 🔄 Step 0: ICE-v1.1.1 → v1.1.2 Refinement

**PREREQUISITE: Update ICE rule `affects` arrays before integration**

### Semantic Distinction

| Action | Purpose | Authority |
|--------|---------|-----------|
| **SEND** | Legal finality, creates binding invoice | **ICE is absolute** |
| **PREVIEW** | Draft visualization, working document | **ICE is minimal** |
| **SAVE** | Persist incomplete draft | **Always allowed** |

### Required Rule Changes

#### ❌ REMOVE PREVIEW from these rules:
```typescript
// BEFORE (v1.1.1)
{
  id: 'INVOICE_NUMBER_MISSING',
  affects: ['PREVIEW', 'SEND'],  // ← blocks both
}

// AFTER (v1.1.2)
{
  id: 'INVOICE_NUMBER_MISSING',
  affects: ['SEND'],  // ← blocks only SEND
}
```

**Rules to modify:**
- `INVOICE_NUMBER_MISSING`: Remove PREVIEW, keep SEND ✓
- `ISSUE_DATE_MISSING`: Remove PREVIEW, keep SEND ✓
- `TAX_ID_MISSING` (blocker variant): Remove PREVIEW, keep SEND ✓
- `DUE_DATE_MISSING`: Already SEND-only ✓ (no change)
- `SERVICE_PERIOD_*`: Already SEND-only ✓ (no change)
- `RECIPIENT_INCOMPLETE`: Already SEND-only ✓ (no change)
- `TOTAL_INVALID`: Already SEND-only ✓ (no change)

#### ✅ KEEP PREVIEW blocking for these rules:
```typescript
{
  id: 'NO_VALID_LINE_ITEMS',
  affects: ['PREVIEW', 'SEND'],  // ← keep both (nothing to render)
}

{
  id: 'ISSUER_IDENTITY_INCOMPLETE',
  affects: ['PREVIEW', 'SEND'],  // ← keep both (dangerously misleading)
}
```

**Rationale:**
- **NO_VALID_LINE_ITEMS**: Cannot render empty invoice → technical impossibility
- **ISSUER_IDENTITY_INCOMPLETE**: Would visually resemble legal document without issuer identity → dangerously misleading

All other completeness issues are **legal blockers, not renderability blockers**.

---

## 📐 Clarified Action Semantics

### SEND (Legal Finality) — Absolute ICE Authority

**Governed exclusively by:** `allowedActions.includes('SEND')`

**Blocking requirements:**
- Must pass all 13 ICE rules
- No UI overrides
- No policy exceptions
- No watermarks as substitutes

**Lifecycle check order:**
1. Cancellation/archival/payment locks (reject immediately)
2. ICE completeness evaluation
3. SEND action execution

---

### PREVIEW (Draft Visualization) — Minimal ICE Authority

**Purpose:** Working document for draft inspection, layout verification, internal review

**ICE blocks PREVIEW only for:**
- `NO_VALID_LINE_ITEMS` → nothing to render
- `ISSUER_IDENTITY_INCOMPLETE` → dangerously misleading

**ICE does NOT block PREVIEW for:**
- Missing invoice number
- Missing due date
- Missing service period
- Missing tax ID
- Missing recipient (shows placeholder)
- Kleinunternehmer validation issues

These are surfaced as **warnings**, not blocks.

---

### Watermark Policy (Mandatory)

**If `completeness.stage !== 'READY_TO_SEND'`:**

All preview outputs must display:

```
┌─────────────────────────────────────┐
│  DRAFT — NOT LEGALLY VALID          │
│  Complete all required fields       │
│  before sending                     │
└─────────────────────────────────────┘
```

**Implementation locations:**
- PDF generation service (server/templates/invoice.ts)
- PDF preview modal (client-side)
- Share preview flows
- Print preview

**Display alongside watermark:**
- ICE blockers (what's missing)
- ICE warnings (Kleinunternehmer advisories)
- Completeness percent

---

## 1️⃣ DUPLICATE LOGIC TO DELETE/REPLACE

### Server-Side Validations (server/invoiceRouter.ts)

#### ❌ DELETE: Lines 552-558 – markAsPaid mutation
```typescript
if (!invoice.issueDate) { throw ... }
if (total <= 0) { throw ... }
```
**Duplicates**: ICE rules `ISSUE_DATE_MISSING` + `TOTAL_INVALID`
**Replace With**: `evaluateInvoiceCompleteness()` call, check `!allowedActions.includes('SEND')`

#### ❌ DELETE: Lines 277-282 – create mutation
```typescript
.min(1, "At least one item is required")
```
**Duplicates**: ICE rule `NO_VALID_LINE_ITEMS`
**Replace With**: ICE validation (advisory on create, blocking on send)

#### ❌ DELETE: Lines 434-440 – update mutation
```typescript
// For created invoices: require at least one item
if (validItems.length === 0) { throw ... }
```
**Duplicates**: ICE rule `NO_VALID_LINE_ITEMS`
**Replace With**: ICE validation (never block SAVE, always allow draft updates)

---

### UI-Side Validations

#### ❌ DELETE: client/src/components/invoices/InvoiceForm.tsx:341-350
```typescript
if (!formState.invoiceNumber.trim()) { ... }
if (!validItems.length) { ... }
```
**Duplicates**: ICE rules `INVOICE_NUMBER_MISSING` + `NO_VALID_LINE_ITEMS`
**Replace With**: ICE validation with real-time feedback, never block SAVE

#### ❌ DELETE: client/src/components/invoices/InvoiceForm.tsx:401-417 (handleSend)
```typescript
if (!formState.dueDate) { toast.error(...) }
if (total <= 0) { toast.error(...) }
```
**Duplicates**: ICE rules `DUE_DATE_MISSING` + `TOTAL_INVALID`
**Replace With**: Check `!allowedActions.includes('SEND')`, display all ICE blockers

#### ❌ DELETE: client/src/components/invoices/ShareInvoiceDialog.tsx:66-75
```typescript
if (!invoice.dueDate) { toast.error(...) }
if (total <= 0) { toast.error(...) }
```
**Duplicates**: Partial ICE validation (missing 11 other rules)
**Replace With**: Full ICE completeness check before share link creation

#### ⚠️ PARTIALLY REPLACE: client/src/lib/invoiceActions.ts:40-122
**Current**: `getInvoiceActions()` manually determines available actions
**ICE Should Govern**: Action availability via `allowedActions` array
**Keep**: Cancellation-specific logic (lifecycle, not completeness)
**Replace**: Lines 70-93 (markAsSent, markAsPaid availability) with ICE-driven decisions

---

### Zod Schemas (server/invoiceRouter.ts:9-29)

#### ✅ KEEP: lineItemSchema & invoiceMetadataSchema
**Reason**: Zod provides runtime type validation + input sanitization
**Strategy**: Two-layer validation
- **Zod layer**: Type safety, input sanitization, SQL injection prevention
- **ICE layer**: Business rules, legal completeness, §14 UStG compliance

---

## 2️⃣ REQUIRED WIRING POINTS

### 🔴 Blocking (Server-Side) – MUST block if ICE blocks SEND

| Location | Function | Call Site | Validation | Behavior |
|----------|----------|-----------|------------|----------|
| **server/invoiceRouter.ts:486-512** | `issue` mutation | Before `db.issueInvoice()` at line 509 | Check lifecycle → check `!allowedActions.includes('SEND')` | **BLOCK**: Throw TRPCError with ICE blockers |
| **server/invoiceRouter.ts:514-563** | `markAsPaid` mutation | Before `db.markInvoiceAsPaid()` at line 560 | Check lifecycle → check `!allowedActions.includes('SEND')` | **BLOCK**: Throw TRPCError |
| **server/pdfRouter.ts:~60-90** | `createShareLink` (final) | Before share link creation | Check lifecycle → check `!allowedActions.includes('SEND')` | **BLOCK**: Throw TRPCError |

**Implementation template:**
```typescript
// 1. Lifecycle checks FIRST
if (invoice.cancelledAt) {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Cancelled invoices cannot be sent"
  });
}

// 2. ICE evaluation SECOND
const completeness = evaluateInvoiceCompleteness(
  invoiceSnapshot,
  companySnapshot,
  settingsSnapshot
);

// 3. SEND gating THIRD
if (!completeness.allowedActions.includes('SEND')) {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `Invoice cannot be sent: ${completeness.blockers.map(b => b.message).join(', ')}`,
    cause: {
      blockers: completeness.blockers,
      stage: completeness.stage,
      percent: completeness.percent
    }
  });
}
```

---

### 🟢 Non-Blocking (Server-Side) – Advisory only

| Location | Function | Behavior |
|----------|----------|----------|
| **server/invoiceRouter.ts:274-345** | `create` mutation | Run ICE, return warnings in response, never block SAVE |
| **server/invoiceRouter.ts:347-484** | `update` mutation | Run ICE, return warnings in response, never block SAVE |
| **server/invoiceRouter.ts:906-1003** | `confirmUploadedInvoice` | Run ICE, return warnings, never block confirmation |
| **server/pdfRouter.ts:162-242** | `preview` endpoint | Check `allowedActions.includes('PREVIEW')`, apply watermark if incomplete |

---

### 🟡 Advisory (UI Feedback) – Show warnings, enable iteration

| Location | Function | Call Site | Purpose |
|----------|----------|-----------|---------|
| **client/src/components/invoices/InvoiceForm.tsx:341** | `handleSave` | At start of function | Run ICE, show warnings, always allow SAVE |
| **client/src/components/invoices/InvoiceForm.tsx:401** | `handleSend` | Before `issueMutation.mutate()` | **BLOCK in UI**: Disable button if `!allowedActions.includes('SEND')`, show all blockers |
| **client/src/components/invoices/ShareInvoiceDialog.tsx:63** | `handleCreateShareLink` | Before `createShareLinkMutation` | **BLOCK in UI**: Disable button if `!allowedActions.includes('SEND')`, show all blockers |
| **client/src/components/invoices/InvoiceStatusActionsDropdown.tsx** | Render actions | When building dropdown menu | Disable "Send" action if ICE blocks, show tooltip with blockers |

---

### 🔵 UI-Only (Completeness Indicators) – Non-blocking visual feedback

| Location | Component | Display |
|----------|-----------|---------|
| **InvoiceForm** | Form header | Progress bar (`percent`), stage badge, blocker count |
| **InvoiceView** | Detail page | Completeness card with blockers/warnings, action recommendations |
| **CreateInvoiceWorkspace** | Wizard mode | Step indicator based on `stage`, category completion |
| **InvoiceStatusActionsDropdown** | Action tooltips | Show blocker messages on disabled actions |

---

## 3️⃣ DB/SCHEMA MISMATCHES

### ❌ CRITICAL: Recipient Data Structure (§14 UStG Compliance)

#### ICE expects:
```typescript
invoice.recipientName?: string
invoice.recipientAddress?: string
```

#### Current DB structure:
```typescript
invoices.clientId → contacts.id (FK relationship)
// No direct recipientName/recipientAddress columns
```

**Issue**: ICE requires denormalized recipient snapshot, current DB uses normalized FK
**Impact**: Cannot populate `InvoiceSnapshot` without JOIN; §14 UStG requires snapshot at time of invoice issuance
**Legal Risk**: If contact is edited after invoice sent, historical invoice shows wrong address

#### Resolution (MANDATORY):

**Add denormalized columns:**
```sql
ALTER TABLE invoices
  ADD COLUMN recipientName VARCHAR(255),
  ADD COLUMN recipientAddress TEXT;
```

**Populate on SEND (not on save):**
```typescript
// In issue mutation, before db.issueInvoice():
if (invoice.clientId) {
  const client = await db.getContactById(invoice.clientId);
  await db.updateInvoice(invoice.id, {
    recipientName: client.name,
    recipientAddress: client.address,
  });
}
```

**Use snapshot for PDF generation:**
```typescript
// In PDF template:
const recipientName = invoice.recipientName || client?.name || "Unknown";
const recipientAddress = invoice.recipientAddress || client?.address || "";
```

**Migration path for existing invoices:**
```sql
-- Backfill existing sent invoices
UPDATE invoices i
JOIN contacts c ON i.clientId = c.id
SET i.recipientName = c.name,
    i.recipientAddress = c.address
WHERE i.sentAt IS NOT NULL
  AND i.recipientName IS NULL;
```

---

### ⚠️ MEDIUM: Company Field Name Mismatches

| ICE Field | DB Field | Status |
|-----------|----------|--------|
| `company.legalName` | `companySettings.companyName` | ❌ **MISMATCH** |
| `company.address` | `companySettings.address` | ✅ Match |
| `company.taxNumber` | `companySettings.steuernummer` | ❌ **MISMATCH** |
| `company.vatId` | `companySettings.ustIdNr` | ❌ **MISMATCH** |

#### Resolution: Map fields when creating `CompanySnapshot`
```typescript
const companySnapshot: CompanySnapshot = {
  legalName: companySettings.companyName,
  address: companySettings.address,
  taxNumber: companySettings.steuernummer,
  vatId: companySettings.ustIdNr,
};
```

---

### ⚠️ MEDIUM: Service Period Nullability

**ICE logic (SERVICE_PERIOD_INVALID rule):**
- If both `null` → block SEND ("Service date or period is required")
- If only `servicePeriodEnd` set → block SEND ("requires a start date")
- If end < start → block SEND

**Current DB:**
- `servicePeriodStart: timestamp (nullable)` ✅
- `servicePeriodEnd: timestamp (nullable)` ✅

**Status**: ✅ DB structure supports ICE requirements
**Impact**: Existing invoices with null periods cannot be sent (correct per §14 UStG)

---

### ✅ Invoice Fields – All Match

| ICE Field | DB Field | Status |
|-----------|----------|--------|
| `invoiceNumber` | `invoices.invoiceNumber` | ✅ |
| `issueDate` | `invoices.issueDate` | ✅ |
| `dueDate` | `invoices.dueDate` | ✅ |
| `servicePeriodStart` | `invoices.servicePeriodStart` | ✅ |
| `servicePeriodEnd` | `invoices.servicePeriodEnd` | ✅ |
| `total` | `invoices.total` | ✅ |
| `items[].name` | `invoice_items.name` | ✅ |
| `items[].quantity` | `invoice_items.quantity` | ✅ |
| `items[].unitPrice` | `invoice_items.unitPrice` | ✅ |

---

### ✅ Settings – Exact Match

| ICE Field | DB Field | Status |
|-----------|----------|--------|
| `settings.isKleinunternehmer` | `companySettings.isKleinunternehmer` | ✅ |

---

## 4️⃣ ACTION GATING & LIFECYCLE CORRECTNESS

### ❌ Current Violations of ICE Principles

#### 1. UI Invents Completeness Logic (invoiceActions.ts:40-122)
- **Violation**: `getInvoiceActions()` manually determines allowed actions based on state
- **Should**: Query ICE `allowedActions` to determine what's permitted
- **Risk**: UI and ICE decisions diverge, user sees "Send" button when ICE blocks SEND

#### 2. ShareInvoiceDialog Only Checks 2 Fields (lines 66-75)
- **Current**: Only validates `dueDate` + `total > 0`
- **ICE**: 13 rules must pass for SEND action
- **Missing Checks**:
  - Issuer legal name/address
  - Tax ID (non-Kleinunternehmer)
  - Service period
  - Recipient name/address
  - Line item validity
  - Invoice number
- **Risk**: Creates share link for legally incomplete invoice

#### 3. No Server-Side ICE Enforcement on Send
- **Current**: `issue` mutation (line 486-512) only checks:
  - Draft status
  - No existing sentAt/paidAt
  - Cancellation reference (if applicable)
- **Missing**: All ICE completeness rules
- **Risk**: API allows sending legally incomplete invoices

#### 4. No Lifecycle-Before-ICE Ordering
- **Current**: ICE is not called at all in mutations
- **Should**: Lifecycle checks → ICE → Action
- **Risk**: ICE evaluates cancelled/archived invoices unnecessarily

---

### ✅ Current Logic That Aligns With ICE

#### 1. Draft Save Always Allowed
- **Current**: Update mutation allows draft edits without validation (line 373)
- **ICE**: SAVE always in `allowedActions`
- **Status**: ✅ Correct

#### 2. Payment Blocks Revert to Draft
- **Current**: `revertToDraft` blocked if `amountPaid > 0` (line 105 in invoiceActions.ts)
- **ICE**: N/A (ICE doesn't model payment state)
- **Status**: ✅ Correct (business rule outside ICE scope)

#### 3. Uploaded Invoice Historical Import
- **Current**: `markAsPaid` allows uploaded invoices to skip sentAt (line 536-548)
- **ICE**: Would still require `issueDate` + `total > 0` for SEND
- **Current Validation**: Lines 552-558 enforce this ✅
- **Status**: ✅ ICE rules align with current behavior

---

## 5️⃣ INTEGRATION RISKS & EDGE CASES

### 🔴 HIGH RISK: Uploaded Invoices (source: "uploaded")

**Scenario**: User uploads PDF → OCR extracts partial data → user confirms without filling required fields

**Current Behavior**:
- `confirmUploadedInvoice` (line 906-1003) requires `issueDate` + `totalAmount`
- Does NOT validate: recipient, service period, line items, issuer identity, tax ID

**ICE Impact**:
- User confirms upload → invoice moves to DRAFT state
- Tries to send → ICE blocks with multiple blockers
- User confused: "I already confirmed this invoice"

**Mitigation (Clarified UX Messaging):**

**Update UI messaging:**
```typescript
// In InvoiceUploadReviewDialog:
<Alert>
  Confirmation validates OCR parsing correctness, not legal completeness.
  You'll need to complete all required fields before sending.
</Alert>
```

**Run ICE in confirmUploadedInvoice (advisory only):**
```typescript
// After confirmation, before response:
const completeness = evaluateInvoiceCompleteness(...);
return {
  success: true,
  invoice,
  completenessWarnings: completeness.blockers, // Show in UI
  stage: completeness.stage,
  percent: completeness.percent,
};
```

**Show completeness immediately after confirmation:**
```typescript
// In InvoiceView after upload confirmation:
{completenessWarnings.length > 0 && (
  <Alert variant="warning">
    Complete {completenessWarnings.length} required fields before sending:
    <ul>{completenessWarnings.map(w => <li>{w.message}</li>)}</ul>
  </Alert>
)}
```

---

### 🟡 MEDIUM RISK: Draft Invoices Can Save Invalid Data

**Scenario**: User creates invoice with minimal data → saves draft → expects to send later

**Current Behavior**:
- InvoiceForm only validates: `invoiceNumber` + at least 1 item (lines 343-350)
- Missing: issuer identity, recipient, service period, tax ID

**ICE Impact**:
- User saves draft with invalid data (correct per ICE – SAVE always allowed)
- Tries to send later → ICE blocks with multiple issues
- User must fix multiple fields before sending

**Mitigation:**
- **Show ICE completeness card on every save** (non-blocking)
- **Wizard mode**: Guide user through ICE categories (identity → recipient → time → items → legal)
- **Do NOT block save**: DRAFT state is explicitly for incomplete invoices
- **Progressive disclosure**: Show "Next: Complete recipient info" after saving

---

### 🟡 MEDIUM RISK: Cancellation Logic Not in ICE

**Current Behavior**:
- Cancelled invoices blocked by `cancelledAt` timestamp (invoiceActions.ts:65-86)
- Cancellation with sent status makes original invoice read-only (invoiceRouter.ts:498-500)

**ICE Impact**:
- ICE doesn't know about `cancelledAt` or cancellation relationships
- ICE may allow SEND for cancelled invoice

**Mitigation (Lifecycle-Before-ICE Ordering):**
```typescript
// In issue mutation:
// 1. LIFECYCLE CHECKS FIRST
if (invoice.cancelledAt) {
  throw new TRPCError({ message: "Cancelled invoices cannot be sent" });
}
if (invoice.archivedAt) {
  throw new TRPCError({ message: "Archived invoices cannot be sent" });
}

// 2. ICE EVALUATION SECOND
const completeness = evaluateInvoiceCompleteness(...);
if (!completeness.allowedActions.includes('SEND')) {
  throw new TRPCError({ message: "Invoice incomplete", cause: completeness.blockers });
}

// 3. ACTION EXECUTION THIRD
await db.issueInvoice(invoice.id);
```

**Order**: Lifecycle → ICE → Action

---

### 🟢 LOW RISK: Minified Builds

**ICE Design**:
- Rule IDs are string literals: `"INVOICE_NUMBER_MISSING"`, `"ISSUE_DATE_MISSING"`
- No reliance on `Function.name` or reflection

**Status**: ✅ Safe for minification/obfuscation

---

### 🟢 LOW RISK: Offline/Partial Data

**Current Architecture**:
- No offline mode detected
- Form state may be partially filled (uncontrolled inputs)

**ICE Behavior**:
- Handles `undefined` and `null` gracefully
- Empty strings treated as missing (e.g., `!invoiceNumber?.trim()`)

**Status**: ✅ ICE handles partial data correctly

---

### 🟡 MEDIUM RISK: Preview Watermark Implementation

**Scenario**: User previews incomplete invoice, exports PDF, uses externally

**ICE Impact**:
- Preview is allowed for incomplete invoices (per doctrine)
- Must have visible "DRAFT — NOT LEGALLY VALID" watermark
- Must not visually resemble final invoice

**Mitigation (Presentation Layer):**
```typescript
// In server/templates/invoice.ts:
export function generateInvoiceHTML({
  invoice,
  completeness, // NEW: pass ICE result
  ...
}: InvoiceTemplateData) {
  const isDraft = completeness.stage !== 'READY_TO_SEND';

  return {
    html: `
      ${isDraft ? `
        <div class="watermark">
          DRAFT — NOT LEGALLY VALID
        </div>
      ` : ''}
      ${renderInvoiceContent(...)}
    `,
    metadata: {
      isDraft,
      blockers: completeness.blockers,
    }
  };
}
```

**CSS styling:**
```css
.watermark {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-45deg);
  font-size: 72px;
  color: rgba(255, 0, 0, 0.2);
  font-weight: bold;
  pointer-events: none;
  z-index: 9999;
}
```

---

### 🔴 HIGH RISK: Missing Recipient Snapshot (§14 UStG)

**Scenario**: User creates invoice with clientId → sends invoice → later edits contact address → historical invoice now shows wrong address

**Current Behavior**:
- Invoice stores `clientId` FK, no denormalized recipient data
- PDF generation JOINs to `contacts` table (pdfRouter.ts:176-186)
- **§14 UStG Violation**: Invoice must snapshot recipient address at time of issuance

**ICE Impact**:
- ICE expects `recipientName` + `recipientAddress` strings (snapshot)
- Current DB structure cannot populate ICE snapshot without JOIN
- If contact deleted → invoice cannot be validated by ICE

**Mitigation (See Section 3 - CRITICAL)**

---

## 📋 Summary & Recommendations

### Step 0: ICE Code Changes (PREREQUISITE)

✅ **Update ICE-v1.1.1 → v1.1.2** (modify `affects` arrays):
- Remove PREVIEW from: `INVOICE_NUMBER_MISSING`, `ISSUE_DATE_MISSING`, `TAX_ID_MISSING`
- Keep PREVIEW for: `NO_VALID_LINE_ITEMS`, `ISSUER_IDENTITY_INCOMPLETE`

---

### Immediate Actions (Before Production)

1. ✅ **Add recipientName/recipientAddress columns** – §14 UStG compliance (CRITICAL)
2. ✅ **Add lifecycle-before-ICE checks** to all mutations (cancelled, archived, paid)
3. ✅ **Add ICE to server mutations** (issue, markAsPaid, createShareLink) – blocking validation
4. ✅ **Replace UI validation logic** (InvoiceForm, ShareInvoiceDialog) with ICE calls
5. ✅ **Update invoiceActions.ts** to query ICE for allowed actions
6. ✅ **Implement watermark system** for draft previews

---

### Advisory Enhancements

7. 🟡 **Add ICE to InvoiceForm** – show completeness progress + warnings (non-blocking)
8. 🟡 **Add ICE to confirmUploadedInvoice** – warn about incomplete uploads with clear messaging
9. 🟡 **Update upload confirmation UI** – clarify "confirmation ≠ legal readiness"

---

### Code to Delete

- ❌ InvoiceForm.tsx:343-350 (inline validation) → replace with ICE
- ❌ InvoiceForm.tsx:409-417 (send validation) → replace with ICE
- ❌ ShareInvoiceDialog.tsx:66-75 (send validation) → replace with ICE
- ❌ invoiceRouter.ts:552-558 (markAsPaid validation) → replace with ICE
- ❌ Zod min(1) for line items → keep Zod, add ICE on top

---

### Field Mapping Required

```typescript
// Helper function to create ICE snapshots:
export async function createICESnapshots(invoiceId: number) {
  const invoice = await db.getInvoiceById(invoiceId);
  const companySettings = await db.getCompanySettings(invoice.userId);

  // Resolve client (use snapshot if exists, fallback to JOIN)
  let recipientName = invoice.recipientName;
  let recipientAddress = invoice.recipientAddress;

  if (!recipientName && invoice.clientId) {
    const client = await db.getContactById(invoice.clientId);
    recipientName = client?.name;
    recipientAddress = client?.address;
  }

  const invoiceSnapshot: InvoiceSnapshot = {
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    servicePeriodStart: invoice.servicePeriodStart,
    servicePeriodEnd: invoice.servicePeriodEnd,
    recipientName,
    recipientAddress,
    items: invoice.items?.map(item => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    total: invoice.total,
  };

  const companySnapshot: CompanySnapshot = {
    legalName: companySettings.companyName,
    address: companySettings.address,
    taxNumber: companySettings.steuernummer,
    vatId: companySettings.ustIdNr,
  };

  const settingsSnapshot: InvoiceSettingsSnapshot = {
    isKleinunternehmer: companySettings.isKleinunternehmer,
  };

  return { invoiceSnapshot, companySnapshot, settingsSnapshot };
}
```

---

## 🧭 Constitutional Summary (Final)

1. **ICE is the single source of truth for legal finality (SEND)**
2. **SEND is non-negotiable and ICE-gated**
3. **PREVIEW is a tooling concern with minimal ICE constraints**
4. **Draft previews must be visibly marked as non-legal**
5. **Business lifecycle rules are evaluated before ICE**
6. **UI must never invent legality rules**
7. **Confirmation validates parsing, not completeness**
8. **§14 UStG compliance is non-negotiable**

---

## Appendix: File Reference Index

### Server-Side Files
- `server/invoiceRouter.ts` – All invoice mutations (1,456 lines)
- `server/db.ts` – 40+ invoice database functions (lines 1311-2493)
- `server/pdfRouter.ts` – PDF generation and share links
- `server/templates/invoice.ts` – Invoice PDF template
- `drizzle/schema.ts` – Database schema (lines 328-421 for invoices)

### Client-Side Files
- `client/src/lib/invoiceState.ts` – Invoice state logic
- `client/src/lib/invoiceActions.ts` – Invoice action rules
- `client/src/components/invoices/InvoiceForm.tsx` – Main form (63KB)
- `client/src/components/invoices/InvoiceStatusActionsDropdown.tsx` – Lifecycle actions
- `client/src/components/invoices/ShareInvoiceDialog.tsx` – Invoice sharing
- `client/src/components/invoices/InvoiceUploadZone.tsx` – Upload handling
- `client/src/pages/InvoiceView.tsx` – Invoice detail view

---

**Audit completed. ICE-v1.1.2 is ready for integration with the clarified doctrine above.**

**Version**: ICE-v1.1.2 — Legal Authority Clarification
**No architectural rollback required. Only rule `affects` arrays and integration wiring need updating.**
