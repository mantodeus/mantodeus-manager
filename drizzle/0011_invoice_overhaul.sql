-- Invoice data model overhaul for German-compliant numbering and line items
ALTER TABLE `invoices`
  ADD COLUMN IF NOT EXISTS `invoiceYear` INT NOT NULL DEFAULT 0 AFTER `invoiceNumber`,
  ADD COLUMN IF NOT EXISTS `invoiceCounter` INT NOT NULL DEFAULT 0 AFTER `invoiceYear`,
  ADD COLUMN IF NOT EXISTS `issueDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `status`,
  ADD COLUMN IF NOT EXISTS `servicePeriodStart` DATETIME NULL AFTER `notes`,
  ADD COLUMN IF NOT EXISTS `servicePeriodEnd` DATETIME NULL AFTER `servicePeriodStart`,
  ADD COLUMN IF NOT EXISTS `referenceNumber` VARCHAR(100) NULL AFTER `servicePeriodEnd`,
  ADD COLUMN IF NOT EXISTS `partialInvoice` BOOLEAN NOT NULL DEFAULT 0 AFTER `referenceNumber`,
  ADD COLUMN IF NOT EXISTS `clientId` INT NULL AFTER `userId`,
  ADD COLUMN IF NOT EXISTS `contactId` INT NULL AFTER `clientId`,
  MODIFY COLUMN `invoiceNumber` VARCHAR(50) NOT NULL,
  MODIFY COLUMN `status` ENUM('draft','sent','paid') NOT NULL DEFAULT 'draft',
  MODIFY COLUMN `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  MODIFY COLUMN `vatAmount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  MODIFY COLUMN `total` DECIMAL(12,2) NOT NULL DEFAULT 0.00;

CREATE UNIQUE INDEX IF NOT EXISTS `invoice_number_per_user` ON `invoices` (`userId`, `invoiceNumber`);

CREATE TABLE IF NOT EXISTS `invoice_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `invoiceId` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `category` VARCHAR(120) NULL,
  `quantity` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `unitPrice` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'EUR',
  `lineTotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `invoice_items_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE CASCADE
);
