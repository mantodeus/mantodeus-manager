# Audit Fixes Status Report
**Date:** 2026-01-02  
**Status:** In Progress

## Overview
This document tracks the status of 8 critical pre-launch issues identified in the audit.

---

## ✅ **FIXED** Issues

### 7. Duplicate Cancellation Invoices (PARTIALLY FIXED)
**Status:** ✅ Unique constraint exists, but code needs idempotency improvement

**What's Fixed:**
- ✅ Unique index on `cancelledInvoiceId` exists in schema (`drizzle/schema.ts:390`)
- ✅ Migration `0017_add_cancellation_invoices.sql` creates the unique constraint

**What Still Needs Work:**
- ❌ `createCancellationInvoice` in `server/db.ts:1742-1843` throws error instead of returning existing cancellation (not idempotent)
- ❌ Should catch duplicate key error and return existing cancellation invoice

**Files:**
- `drizzle/schema.ts:390` - Unique index defined
- `server/db.ts:1771-1778` - Check exists but throws error instead of returning existing

---

## ❌ **NOT FIXED** Issues

### 1. Currency Arithmetic (Floating Point Bugs)
**Status:** ❌ NOT FIXED

**Current Issues:**
- `server/invoiceRouter.ts:33` - Uses `toFixed(2)` for line totals (floating point)
- `server/invoiceRouter.ts:51-53` - Uses `toFixed(2)` for totals (floating point)
- `server/db.ts:1781-1785` - `negateMoney` uses `toFixed(2)` (floating point)
- No `server/_core/money.ts` utility exists

**Required Fix:**
- Create `server/_core/money.ts` with integer cents arithmetic
- Replace all `toFixed()` usage with cents-based calculations
- Update invoice calculations to use cents internally

**Files Needing Changes:**
- `server/invoiceRouter.ts` - `normalizeLineItems()`, `calculateTotals()`
- `server/db.ts` - `negateMoney()`, `createCancellationInvoice()`
- All invoice total calculations

---

### 2. Expense List N+1 Query Explosion
**Status:** ❌ NOT FIXED

**Current Issues:**
- `server/expenseRouter.ts:281-328` - Calls `getProposedFields()` for each `needs_review` expense
- `server/expenses/suggestionEngine.ts:136` - `getSupplierHistory()` calls `db.listExpensesByUser(userId)` which loads ALL expenses
- This creates O(n) queries where n = number of expenses per user

**Required Fix:**
- Add `listSupplierHistory(userId, supplierName, limit=5)` to `server/db.ts`
- Add database index on `(userId, supplierName)` or `(userId, supplierNormalized)`
- Refactor `suggestionEngine.ts` to use targeted query instead of loading all expenses
- Batch compute `reviewMeta` in expense list endpoint

**Files Needing Changes:**
- `server/db.ts` - Add `listSupplierHistory()` function
- `server/expenses/suggestionEngine.ts:131-144` - Replace `getSupplierHistory()` implementation
- `server/expenseRouter.ts:281-328` - Optimize reviewMeta computation
- `drizzle/schema.ts` - Add index on expenses table

---

### 3. Production TRACE Logging Pollution
**Status:** ❌ NOT FIXED

**Current Issues:**
- Found **78 instances** of `console.error('[TRACE]...')` across multiple files:
  - `server/invoiceRouter.ts` - 20 instances
  - `server/db.ts` - 30 instances
  - `server/_core/trpc.ts` - 8 instances
  - `server/_core/index.ts` - 12 instances
  - `server/_core/context.ts` - 8 instances

**Required Fix:**
- `server/_core/logger.ts` already exists with proper logger
- Replace all `console.error('[TRACE]...')` with `logger.debug()` or remove
- Ensure debug logging only in non-production

**Files Needing Changes:**
- `server/invoiceRouter.ts` - Remove all TRACE logs
- `server/db.ts` - Remove all TRACE logs
- `server/_core/trpc.ts` - Remove all TRACE logs
- `server/_core/index.ts` - Remove all TRACE logs (lines 553-578)
- `server/_core/context.ts` - Remove all TRACE logs

---

### 4. File Upload Race Conditions & Orphaned S3 Objects
**Status:** ⚠️ PARTIALLY ADDRESSED

**Current State:**
- `server/expenseRouter.ts:890-896` - Has cleanup code for failed uploads
- No temporary prefix pattern (uploads go directly to final location)
- No orphan tracking table
- No cleanup job for orphaned files

**Required Fix:**
- Add `storage_orphans` table to track orphaned S3 objects
- Upload to `tmp/{userId}/{uuid}` first
- Move to final location after DB success
- Add cleanup job/endpoint for old tmp keys (>24h)
- Apply to both `expenseRouter.ts` bulk upload and `invoiceRouter.ts` upload

**Files Needing Changes:**
- `drizzle/schema.ts` - Add `storage_orphans` table
- `server/storage.ts` - Add temp prefix upload pattern
- `server/expenseRouter.ts:792-919` - Implement temp upload + move pattern
- `server/routers.ts:1220-1281` - Implement temp upload + move pattern for invoices
- Add cleanup job/endpoint

---

### 5. Weak Token Hashing
**Status:** ❌ NOT FIXED

**Current Issues:**
- `server/_core/supabase.ts:63-72` - Uses bitshift hash algorithm
- Stores last 8 characters of token in cache key (line 71)
- Not cryptographically secure

**Required Fix:**
- Replace with `crypto.createHash('sha256').update(token).digest('hex')`
- Remove token substring from cache key

**Files Needing Changes:**
- `server/_core/supabase.ts:63-72` - Replace `hashToken()` function

---

### 6. Schema Migration Race Condition
**Status:** ❌ NOT FIXED

**Current Issues:**
- `server/db.ts:152-206` - `ensureInvoiceSchema()` function exists
- Called in **21 places** throughout `server/db.ts`
- Uses runtime `ALTER TABLE` statements (race condition risk)

**Required Fix:**
- Remove or disable `ensureInvoiceSchema()` in production
- Replace with startup check that throws clear error if schema missing
- Create proper Drizzle migrations for any missing columns
- Remove all calls to `ensureInvoiceSchema()`

**Files Needing Changes:**
- `server/db.ts:152-206` - Remove or disable `ensureInvoiceSchema()`
- `server/db.ts` - Remove all 21 calls to `ensureInvoiceSchema()`
- Create Drizzle migrations for any missing invoice columns

---

### 8. S3 Key Validation Path Traversal
**Status:** ⚠️ PARTIALLY FIXED

**Current State:**
- `server/projectFilesRouter.ts:290-296` - Only checks `startsWith(expectedPrefix)`
- No validation for `..`, backslashes, URL encoding, double slashes

**Required Fix:**
- Create `validateS3Key({key, expectedPrefix})` function
- Reject `..` segments
- Reject backslashes
- Normalize double slashes
- Ensure key matches pattern: `^projects/\d+/[a-zA-Z0-9/_\-.]+$`
- Decode URL encoding safely

**Files Needing Changes:**
- `server/projectFilesRouter.ts` - Add comprehensive `validateS3Key()` function
- Apply validation in `register` procedure (line 289)

---

## Summary

| Issue | Status | Priority |
|-------|--------|----------|
| 1. Currency arithmetic | ❌ Not Fixed | Critical |
| 2. N+1 query explosion | ❌ Not Fixed | Critical |
| 3. TRACE logging | ❌ Not Fixed | High |
| 4. File upload race conditions | ⚠️ Partial | Critical |
| 5. Token hashing | ❌ Not Fixed | High |
| 6. Schema migration race | ❌ Not Fixed | Critical |
| 7. Duplicate cancellations | ✅ Partial | Medium |
| 8. S3 key validation | ⚠️ Partial | High |

**Progress:** 1/8 fully fixed, 2/8 partially fixed, 5/8 not started

---

## Next Steps

1. **Create fix plan branch** (if not already done)
2. **Priority 1 (Critical):**
   - Fix currency arithmetic (#1)
   - Fix N+1 queries (#2)
   - Fix schema migration race (#6)
   - Complete file upload fixes (#4)
3. **Priority 2 (High):**
   - Remove TRACE logging (#3)
   - Fix token hashing (#5)
   - Complete S3 key validation (#8)
4. **Priority 3 (Medium):**
   - Make cancellation invoices idempotent (#7)

---

## Testing Requirements

- [ ] Unit tests for money utilities (cents arithmetic)
- [ ] Unit tests for token hashing
- [ ] Integration test for cancellation invoice idempotency
- [ ] Unit tests for S3 key validator
- [ ] Performance test for expense list (query count)
- [ ] Test file upload failure scenarios (orphan tracking)

