-- Migration: Refactor invoices table to support invoice workflow
-- Adds invoice data fields (status, items, totals) and makes PDF optional

ALTER TABLE `invoices`
  -- Add new invoice data fields
  ADD COLUMN `invoiceNumber` VARCHAR(50) NULL,
  ADD COLUMN `status` ENUM('draft', 'issued', 'paid', 'cancelled') NOT NULL DEFAULT 'draft',
  ADD COLUMN `invoiceDate` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN `dueDate` TIMESTAMP NULL,
  ADD COLUMN `issuedAt` TIMESTAMP NULL,
  ADD COLUMN `items` JSON NOT NULL DEFAULT ('[]'),
  ADD COLUMN `subtotal` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN `vatAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN `total` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN `notes` TEXT NULL,
  ADD COLUMN `pdfFileKey` VARCHAR(500) NULL,
  ADD COLUMN `userId` INT NOT NULL,
  ADD COLUMN `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Make legacy fields nullable (for backward compatibility)
ALTER TABLE `invoices`
  MODIFY COLUMN `filename` VARCHAR(255) NULL,
  MODIFY COLUMN `fileKey` VARCHAR(500) NULL;

-- Add foreign key for userId
ALTER TABLE `invoices`
  ADD CONSTRAINT `invoices_userId_users_id_fk`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE NO ACTION;

-- Add index for status and userId
CREATE INDEX `invoices_status_idx` ON `invoices` (`status`);
CREATE INDEX `invoices_userId_idx` ON `invoices` (`userId`);
CREATE INDEX `invoices_invoiceNumber_idx` ON `invoices` (`invoiceNumber`);

-- Migrate existing data: set userId from uploadedBy
UPDATE `invoices` SET `userId` = `uploadedBy` WHERE `userId` IS NULL;

-- Set default status for existing invoices (treat as issued if they have a file)
UPDATE `invoices` SET `status` = 'issued' WHERE `fileKey` IS NOT NULL AND `status` = 'draft';

