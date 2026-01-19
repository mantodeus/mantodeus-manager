# 🔍 ICE-v1.1.1 Integration Audit Report

**Project**: Mantodeus Manager
**Audit Date**: 2026-01-19
**Auditor**: Senior Staff Engineer / Architect
**Scope**: Invoice Completeness Engine (ICE-v1.1.1) vs. Production Codebase

---

## Executive Summary

This audit analyzes the integration of the Invoice Completeness Engine (ICE-v1.1.1) into the Mantodeus Manager production codebase. ICE-v1.1.1 is the constitutional authority for invoice completeness, ensuring §14 UStG compliance and deterministic action gating.

### Critical Findings

1. **§14 UStG Compliance Gap**: Missing recipient address snapshot (HIGH PRIORITY)
2. **Extensive Duplicate Logic**: 8+ validation points duplicating ICE rules
3. **UI/Server Divergence**: UI invents completeness logic independently of ICE
4. **Preview System Risk**: Generates legally incomplete PDFs without validation

---

## 1️⃣ DUPLICATE LOGIC TO DELETE/REPLACE

### Server-Side Validations (server/invoiceRouter.ts)

#### ❌ DELETE: Lines 552-558 – markAsPaid mutation
```typescript
if (!invoice.issueDate) { throw ... }
if (total <= 0) { throw ... }
```
**Duplicates**: ICE rules `ISSUE_DATE_MISSING` + `TOTAL_INVALID`
**Replace With**: `evaluateInvoiceCompleteness()` call, check `allowedActions.includes('SEND')`

#### ❌ DELETE: Lines 277-282 – create mutation
```typescript
.min(1, "At least one item is required")
```
**Duplicates**: ICE rule `NO_VALID_LINE_ITEMS`
**Replace With**: ICE validation in mutation handler

#### ❌ DELETE: Lines 434-440 – update mutation
```typescript
// For created invoices: require at least one item
if (validItems.length === 0) { throw ... }
```
**Duplicates**: ICE rule `NO_VALID_LINE_ITEMS`
**Replace With**: ICE validation

---

### UI-Side Validations

#### ❌ DELETE: client/src/components/invoices/InvoiceForm.tsx:341-350
```typescript
if (!formState.invoiceNumber.trim()) { ... }
if (!validItems.length) { ... }
```
**Duplicates**: ICE rules `INVOICE_NUMBER_MISSING` + `NO_VALID_LINE_ITEMS`
**Replace With**: ICE validation with real-time feedback

#### ❌ DELETE: client/src/components/invoices/InvoiceForm.tsx:401-417 (handleSend)
```typescript
if (!formState.dueDate) { toast.error(...) }
if (total <= 0) { toast.error(...) }
```
**Duplicates**: ICE rules `DUE_DATE_MISSING` + `TOTAL_INVALID`
**Replace With**: Check ICE `allowedActions.includes('SEND')`, display blockers

#### ❌ DELETE: client/src/components/invoices/ShareInvoiceDialog.tsx:66-75
```typescript
if (!invoice.dueDate) { toast.error(...) }
if (total <= 0) { toast.error(...) }
```
**Duplicates**: ICE validation
**Replace With**: ICE completeness check before share link creation

#### ⚠️ PARTIALLY REPLACE: client/src/lib/invoiceActions.ts:40-122
**Current**: `getInvoiceActions()` manually determines available actions based on state
**ICE Should Govern**: Action availability via `allowedActions` array
**Keep**: Cancellation-specific logic (ICE doesn't handle cancelledAt)
**Replace**: Lines 70-93 (markAsSent, markAsPaid availability) with ICE-driven decisions

---

### Zod Schemas (server/invoiceRouter.ts:9-29)

#### ✅ KEEP: lineItemSchema & invoiceMetadataSchema
**Reason**: Zod provides runtime type validation + input sanitization
**Strategy**: Keep both layers (Zod for input validation, ICE for completeness)

---

## 2️⃣ REQUIRED WIRING POINTS

### 🔴 Blocking (Server-Side) – MUST block if ICE blocks

| Location | Function | Call Site | Validation | Behavior |
|----------|----------|-----------|------------|----------|
| **server/invoiceRouter.ts:486-512** | `issue` mutation | Before `db.issueInvoice()` at line 509 | `!allowedActions.includes('SEND')` | **BLOCK**: Throw TRPCError with ICE blockers |
| **server/invoiceRouter.ts:514-563** | `markAsPaid` mutation | Before `db.markInvoiceAsPaid()` at line 560 | `!allowedActions.includes('SEND')` | **BLOCK**: Throw TRPCError |
| **server/pdfRouter.ts:~60-90** | `createShareLink` mutation | Before share link creation | `!allowedActions.includes('SEND')` | **BLOCK**: Throw TRPCError |
| **server/invoiceRouter.ts:274-345** | `create` mutation | After parsing, before `db.createInvoice()` at line 329 | Check stage, warn if not READY_TO_SEND | **ADVISORY ONLY**: Allow save, return warnings |
| **server/invoiceRouter.ts:347-484** | `update` mutation | After parsing, before `db.updateInvoice()` at line 462 | Check stage, warn if incomplete | **ADVISORY ONLY**: Always allow draft updates |

---

### 🟡 Advisory (UI Feedback) – Show warnings, allow save

| Location | Function | Call Site | Purpose |
|----------|----------|-----------|---------|
| **client/src/components/invoices/InvoiceForm.tsx:341** | `handleSave` | At start of function | Show warnings, always allow SAVE |
| **client/src/components/invoices/InvoiceForm.tsx:401** | `handleSend` | Before `issueMutation.mutate()` | **BLOCK in UI**: Disable button + show blockers |
| **client/src/components/invoices/ShareInvoiceDialog.tsx:63** | `handleCreateShareLink` | Before `createShareLinkMutation` | **BLOCK in UI**: Disable button + show blockers |
| **client/src/components/invoices/InvoiceStatusActionsDropdown.tsx** | Render actions | When building dropdown menu | Disable "Send" action if blocked |

---

### 🔵 UI-Only (Completeness Indicators) – Non-blocking visual feedback

| Location | Component | Display |
|----------|-----------|---------|
| **InvoiceForm** | Form header | Progress bar showing `percent`, stage badge |
| **InvoiceView** | Detail page | Completeness card with blockers/warnings |
| **CreateInvoiceWorkspace** | Wizard mode | Wizard step indicator based on `stage` |
| **InvoiceStatusActionsDropdown** | Action tooltips | Show blocker messages on disabled actions |

---

### Implementation Guidance

#### Server-side blocking template:
```typescript
// At mutation entry point (after fetching invoice + company + settings)
const completeness = evaluateInvoiceCompleteness(
  invoiceSnapshot,
  companySnapshot,
  settingsSnapshot
);

if (!completeness.allowedActions.includes('SEND')) {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `Invoice cannot be sent: ${completeness.blockers.map(b => b.message).join(', ')}`,
    cause: { blockers: completeness.blockers }
  });
}
```

#### UI-side advisory template:
```typescript
// In form component
const completeness = evaluateInvoiceCompleteness(snapshot, company, settings);
const canSend = completeness.allowedActions.includes('SEND');

// Show progress
<ProgressBar percent={completeness.percent} stage={completeness.stage} />

// Disable button + show tooltip
<Button disabled={!canSend}>
  {canSend ? 'Send' : `Blocked: ${completeness.blockers[0]?.message}`}
</Button>
```

---

## 3️⃣ DB/SCHEMA MISMATCHES

### ❌ CRITICAL: Recipient Data Structure

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
**Impact**: Cannot populate `InvoiceSnapshot` without JOIN or denormalization

#### Resolution Options:

**Option A (Recommended): Populate snapshot via JOIN**
```typescript
// When calling ICE, resolve client data:
const invoice = await db.getInvoiceById(id);
const client = invoice.clientId ? await db.getContactById(invoice.clientId) : null;

const snapshot: InvoiceSnapshot = {
  ...invoice,
  recipientName: client?.name,
  recipientAddress: client?.address,
};
```

**Option B: Add denormalized columns (audit-safe snapshots)**
```sql
ALTER TABLE invoices
  ADD COLUMN recipientName VARCHAR(255),
  ADD COLUMN recipientAddress TEXT;
```
→ Snapshot recipient data at invoice creation (§14 UStG: recipient address at time of invoice)
→ Protects against contact edits invalidating historical invoices
→ **RECOMMENDED for legal compliance**

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

**Issue**: DB allows both null, ICE blocks SEND if both null
**Impact**: Existing invoices with null periods cannot be sent (correct per §14 UStG)
**Action**: None required – ICE behavior is correct

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

## 4️⃣ ACTION GATING & LIFECYCLE VIOLATIONS

### ❌ Current Violations of ICE Principles

#### 1. UI Invents Completeness Logic (invoiceActions.ts:40-122)
- **Violation**: `getInvoiceActions()` manually determines allowed actions based on state
- **Should**: Query ICE `allowedActions` to determine what's permitted
- **Risk**: UI and ICE decisions diverge, user sees "Send" button when ICE blocks SEND

#### 2. Preview Allowed Without Validation
- **Current**: Preview always works (InvoiceView.tsx:68-110)
- **ICE Rule**: PREVIEW blocked if `NO_VALID_LINE_ITEMS`, `ISSUER_IDENTITY_INCOMPLETE`, `TAX_ID_MISSING`
- **Risk**: User previews invoice that cannot legally be sent, misleading appearance of validity

#### 3. ShareInvoiceDialog Only Checks 2 Fields (lines 66-75)
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

#### 4. No Server-Side ICE Enforcement on Send
- **Current**: `issue` mutation (line 486-512) only checks:
  - Draft status
  - No existing sentAt/paidAt
  - Cancellation reference (if applicable)
- **Missing**: All ICE completeness rules
- **Risk**: API allows sending legally incomplete invoices

#### 5. Revert Logic Ignores Completeness
- **Current**: `revertToDraft` checks `amountPaid === 0` (correct)
- **Missing**: Should re-evaluate ICE completeness after revert
- **Risk**: Invoice reverted to draft may appear "ready" when it's not

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

**Mitigation**:
1. **Option A**: Run ICE in `confirmUploadedInvoice`, show warnings (don't block)
2. **Option B**: Add "Quick Confirm" (skip to DRAFT) vs "Confirm & Send" (requires ICE READY_TO_SEND)
3. **Recommended**: Option A – allow confirming incomplete uploads, block at send time

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

**Mitigation**:
- **Show ICE warnings on save**: Display completeness percent + blockers as advisory
- **Wizard mode**: Guide user through ICE categories (identity → recipient → time → items → legal)
- **Do NOT block save**: DRAFT state is explicitly for incomplete invoices

---

### 🟡 MEDIUM RISK: Cancellation Logic Not in ICE

**Current Behavior**:
- Cancelled invoices blocked by `cancelledAt` timestamp (invoiceActions.ts:65-86)
- Cancellation with sent status makes original invoice read-only (invoiceRouter.ts:498-500)

**ICE Impact**:
- ICE doesn't know about `cancelledAt` or cancellation relationships
- ICE may allow SEND for cancelled invoice

**Mitigation**:
- **Apply cancellation checks BEFORE ICE**:
  ```typescript
  if (invoice.cancelledAt) {
    throw new TRPCError({ message: "Cancelled invoices cannot be sent" });
  }
  const completeness = evaluateInvoiceCompleteness(...);
  ```
- **Order**: Cancellation → ICE → Action

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

### 🟡 MEDIUM RISK: Preview Generation Without ICE Validation

**Scenario**: User clicks "Update Preview" with incomplete data

**Current Behavior**:
- InvoiceView.tsx:113-180 – validates: `invoiceNumber` + at least 1 item
- Generates PDF via `/api/invoices/preview` (pdfRouter.ts:162-242)
- Missing validation: issuer identity, recipient, tax ID, service period

**ICE Impact**:
- ICE blocks PREVIEW if missing: issuer identity, tax ID, valid line items
- User sees PDF with missing/invalid legal data
- **Risk**: User thinks invoice is valid, tries to use generated PDF externally

**Mitigation**:
1. **Option A (Strict)**: Block preview if ICE blocks PREVIEW action
2. **Option B (Permissive)**: Allow preview, show "DRAFT - NOT VALID FOR SENDING" watermark
3. **Recommended**: Option B – preview is a working tool, not a legal document until SEND

---

### 🔴 HIGH RISK: Missing Recipient Snapshot

**Scenario**: User creates invoice with clientId → sends invoice → later edits contact address → historical invoice now shows wrong address

**Current Behavior**:
- Invoice stores `clientId` FK, no denormalized recipient data
- PDF generation JOINs to `contacts` table (pdfRouter.ts:176-186)
- **§14 UStG Violation**: Invoice must snapshot recipient address at time of creation

**ICE Impact**:
- ICE expects `recipientName` + `recipientAddress` strings (snapshot)
- Current DB structure cannot populate ICE snapshot without JOIN
- If contact deleted → invoice cannot be validated by ICE

**Mitigation (CRITICAL for legal compliance)**:
1. **Add columns**:
   ```sql
   ALTER TABLE invoices
     ADD COLUMN recipientName VARCHAR(255),
     ADD COLUMN recipientAddress TEXT;
   ```
2. **Populate on creation/send**:
   ```typescript
   // When creating/sending invoice:
   const client = await db.getContactById(invoice.clientId);
   await db.updateInvoice(invoice.id, {
     recipientName: client.name,
     recipientAddress: client.address,
   });
   ```
3. **Use snapshot for PDF generation** (not live contact data)

---

## 📋 Summary & Recommendations

### Immediate Actions (Before Production)

1. ✅ **Add ICE to server mutations** (issue, markAsPaid, createShareLink) – blocking validation
2. ✅ **Add recipientName/recipientAddress columns** – legal compliance per §14 UStG
3. ✅ **Replace UI validation logic** (InvoiceForm, ShareInvoiceDialog) with ICE calls
4. ✅ **Update invoiceActions.ts** to query ICE for allowed actions

### Advisory Enhancements

5. 🟡 **Add ICE to InvoiceForm** – show completeness progress + warnings (non-blocking)
6. 🟡 **Add ICE to confirmUploadedInvoice** – warn about incomplete uploads
7. 🟡 **Preview watermark** – show "DRAFT" on PDFs for non-READY_TO_SEND invoices

### Code to Delete

- ❌ InvoiceForm.tsx:343-350 (inline validation) → replace with ICE
- ❌ InvoiceForm.tsx:409-417 (send validation) → replace with ICE
- ❌ ShareInvoiceDialog.tsx:66-75 (send validation) → replace with ICE
- ❌ invoiceRouter.ts:552-558 (markAsPaid validation) → replace with ICE
- ❌ Zod min(1) for line items → keep Zod, add ICE on top

### Field Mapping Required

```typescript
// Company snapshot
const companySnapshot: CompanySnapshot = {
  legalName: companySettings.companyName,      // ← name mismatch
  address: companySettings.address,
  taxNumber: companySettings.steuernummer,     // ← name mismatch
  vatId: companySettings.ustIdNr,              // ← name mismatch
};

// Invoice snapshot (with client JOIN)
const client = invoice.clientId
  ? await db.getContactById(invoice.clientId)
  : null;

const invoiceSnapshot: InvoiceSnapshot = {
  ...invoice,
  recipientName: client?.name,                 // ← denormalize
  recipientAddress: client?.address,           // ← denormalize
};

// Settings snapshot
const settingsSnapshot: InvoiceSettingsSnapshot = {
  isKleinunternehmer: companySettings.isKleinunternehmer,
};
```

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

**Audit completed. ICE-v1.1.1 is ready for integration with the action items above.**

---

## Guiding Principles (Constitutional)

1. ICE-v1.1.1 is the single source of truth for invoice completeness
2. UI must never invent its own completeness logic
3. AI may suggest changes, but only ICE governs legality
4. Prefer deletion over duplication
5. §14 UStG compliance is non-negotiable
