-- Invoice Lifecycle v1 Migration
-- Adds partial payments support and share link invalidation
-- MANDATORY: This migration must run before any other invoice lifecycle changes

-- Step 1: Add amountPaid column to invoices table
ALTER TABLE `invoices`
  ADD COLUMN IF NOT EXISTS `amountPaid` DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER `total`;

-- Step 2: Add lastPaymentAt column to invoices table (optional tracking)
ALTER TABLE `invoices`
  ADD COLUMN IF NOT EXISTS `lastPaymentAt` DATETIME NULL AFTER `amountPaid`;

-- Step 3: Add invalidated column to shared_documents table
ALTER TABLE `shared_documents`
  ADD COLUMN IF NOT EXISTS `invalidated` BOOLEAN NOT NULL DEFAULT 0 AFTER `createdAt`;

-- Step 4: Add invalidatedAt column to shared_documents table
ALTER TABLE `shared_documents`
  ADD COLUMN IF NOT EXISTS `invalidatedAt` DATETIME NULL AFTER `invalidated`;

-- Step 5: MANDATORY BACKFILL - Set amountPaid = total for all paid invoices
-- This prevents paid invoices from appearing unpaid after migration
UPDATE `invoices`
SET `amountPaid` = `total`
WHERE `paidAt` IS NOT NULL AND (`amountPaid` = 0 OR `amountPaid` IS NULL);

-- Step 6: Create index for amountPaid (for queries filtering by payment status)
CREATE INDEX IF NOT EXISTS `invoices_amountPaid_idx` ON `invoices` (`amountPaid`);

-- Step 7: Create index for lastPaymentAt (for payment tracking queries)
CREATE INDEX IF NOT EXISTS `invoices_lastPaymentAt_idx` ON `invoices` (`lastPaymentAt`);

-- Step 8: Create index for invalidated in shared_documents (for filtering invalid links)
CREATE INDEX IF NOT EXISTS `shared_documents_invalidated_idx` ON `shared_documents` (`invalidated`);

