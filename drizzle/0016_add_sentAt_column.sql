-- Add missing sentAt column to invoices table
-- This column was supposed to be added in migration 0015 but failed due to MySQL syntax issue
-- (MySQL doesn't support "IF NOT EXISTS" for ADD COLUMN)

ALTER TABLE `invoices` 
  ADD COLUMN `sentAt` timestamp NULL AFTER `dueDate`;

-- Create index (will fail if index already exists, but that's fine)
CREATE INDEX `invoices_sentAt_idx` ON `invoices` (`sentAt`);

