-- Phase 0: Invoice status model refactor
-- Change from status='sent' to status='open' with sentAt timestamp
-- Add sentAt and paidAt timestamps for tracking

-- Step 1: Add new timestamp columns
ALTER TABLE `invoices`
  ADD COLUMN IF NOT EXISTS `sentAt` DATETIME NULL AFTER `dueDate`,
  ADD COLUMN IF NOT EXISTS `paidAt` DATETIME NULL AFTER `sentAt`;

-- Step 2: Create indexes for the new columns
CREATE INDEX IF NOT EXISTS `invoices_sentAt_idx` ON `invoices` (`sentAt`);
CREATE INDEX IF NOT EXISTS `invoices_paidAt_idx` ON `invoices` (`paidAt`);

-- Step 3: Migrate existing data
-- For invoices with status='sent', set sentAt to createdAt (best approximation)
UPDATE `invoices`
SET `sentAt` = `createdAt`
WHERE `status` = 'sent';

-- For invoices with status='paid', set both sentAt and paidAt
UPDATE `invoices`
SET `sentAt` = `createdAt`,
    `paidAt` = `updatedAt`
WHERE `status` = 'paid';

-- Step 4: Update status enum values
-- Change 'sent' to 'open' for all sent invoices
UPDATE `invoices`
SET `status` = 'open'
WHERE `status` = 'sent';

-- Step 5: Modify the status column enum (MariaDB syntax)
-- Note: This will be handled by Drizzle schema push, but documented here for manual rollback
-- ALTER TABLE `invoices` MODIFY COLUMN `status` ENUM('draft', 'open', 'paid') NOT NULL DEFAULT 'draft';
