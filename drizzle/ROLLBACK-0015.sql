-- Rollback for 0015_invoice_status_model_refactor.sql
-- WARNING: This will lose the distinction between sent and not-sent open invoices

-- Step 1: Convert status='open' back to status='sent' where sentAt is not null
UPDATE `invoices`
SET `status` = 'sent'
WHERE `status` = 'open' AND `sentAt` IS NOT NULL;

-- Step 2: Keep status='open' as 'draft' where sentAt is null (shouldn't happen, but safety)
UPDATE `invoices`
SET `status` = 'draft'
WHERE `status` = 'open' AND `sentAt` IS NULL;

-- Step 3: Drop indexes
DROP INDEX IF EXISTS `invoices_sentAt_idx` ON `invoices`;
DROP INDEX IF EXISTS `invoices_paidAt_idx` ON `invoices`;

-- Step 4: Drop columns
ALTER TABLE `invoices`
  DROP COLUMN IF EXISTS `sentAt`,
  DROP COLUMN IF EXISTS `paidAt`;

-- Step 5: Modify status enum back (handled by Drizzle schema push)
-- ALTER TABLE `invoices` MODIFY COLUMN `status` ENUM('draft', 'sent', 'paid') NOT NULL DEFAULT 'draft';
