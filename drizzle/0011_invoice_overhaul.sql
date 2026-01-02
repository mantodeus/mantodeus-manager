-- Invoice data model overhaul for German-compliant numbering and line items

SET @has_invoiceYear := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'invoiceYear'
);
--> statement-breakpoint
SET @add_invoiceYear_sql := IF(
  @has_invoiceYear = 0,
  'ALTER TABLE `invoices` ADD COLUMN `invoiceYear` INT NOT NULL DEFAULT 0 AFTER `invoiceNumber`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_invoiceYear_stmt FROM @add_invoiceYear_sql;
--> statement-breakpoint
EXECUTE add_invoiceYear_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_invoiceYear_stmt;
--> statement-breakpoint

SET @has_invoiceCounter := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'invoiceCounter'
);
--> statement-breakpoint
SET @add_invoiceCounter_sql := IF(
  @has_invoiceCounter = 0,
  'ALTER TABLE `invoices` ADD COLUMN `invoiceCounter` INT NOT NULL DEFAULT 0 AFTER `invoiceYear`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_invoiceCounter_stmt FROM @add_invoiceCounter_sql;
--> statement-breakpoint
EXECUTE add_invoiceCounter_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_invoiceCounter_stmt;
--> statement-breakpoint

SET @has_issueDate := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'issueDate'
);
--> statement-breakpoint
SET @add_issueDate_sql := IF(
  @has_issueDate = 0,
  'ALTER TABLE `invoices` ADD COLUMN `issueDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `status`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_issueDate_stmt FROM @add_issueDate_sql;
--> statement-breakpoint
EXECUTE add_issueDate_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_issueDate_stmt;
--> statement-breakpoint

SET @has_servicePeriodStart := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'servicePeriodStart'
);
--> statement-breakpoint
SET @add_servicePeriodStart_sql := IF(
  @has_servicePeriodStart = 0,
  'ALTER TABLE `invoices` ADD COLUMN `servicePeriodStart` DATETIME NULL AFTER `notes`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_servicePeriodStart_stmt FROM @add_servicePeriodStart_sql;
--> statement-breakpoint
EXECUTE add_servicePeriodStart_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_servicePeriodStart_stmt;
--> statement-breakpoint

SET @has_servicePeriodEnd := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'servicePeriodEnd'
);
--> statement-breakpoint
SET @add_servicePeriodEnd_sql := IF(
  @has_servicePeriodEnd = 0,
  'ALTER TABLE `invoices` ADD COLUMN `servicePeriodEnd` DATETIME NULL AFTER `servicePeriodStart`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_servicePeriodEnd_stmt FROM @add_servicePeriodEnd_sql;
--> statement-breakpoint
EXECUTE add_servicePeriodEnd_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_servicePeriodEnd_stmt;
--> statement-breakpoint

SET @has_referenceNumber := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'referenceNumber'
);
--> statement-breakpoint
SET @add_referenceNumber_sql := IF(
  @has_referenceNumber = 0,
  'ALTER TABLE `invoices` ADD COLUMN `referenceNumber` VARCHAR(100) NULL AFTER `servicePeriodEnd`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_referenceNumber_stmt FROM @add_referenceNumber_sql;
--> statement-breakpoint
EXECUTE add_referenceNumber_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_referenceNumber_stmt;
--> statement-breakpoint

SET @has_partialInvoice := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'partialInvoice'
);
--> statement-breakpoint
SET @add_partialInvoice_sql := IF(
  @has_partialInvoice = 0,
  'ALTER TABLE `invoices` ADD COLUMN `partialInvoice` BOOLEAN NOT NULL DEFAULT 0 AFTER `referenceNumber`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_partialInvoice_stmt FROM @add_partialInvoice_sql;
--> statement-breakpoint
EXECUTE add_partialInvoice_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_partialInvoice_stmt;
--> statement-breakpoint

SET @has_clientId := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'clientId'
);
--> statement-breakpoint
SET @add_clientId_sql := IF(
  @has_clientId = 0,
  'ALTER TABLE `invoices` ADD COLUMN `clientId` INT NULL AFTER `userId`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_clientId_stmt FROM @add_clientId_sql;
--> statement-breakpoint
EXECUTE add_clientId_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_clientId_stmt;
--> statement-breakpoint

SET @has_contactId := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'contactId'
);
--> statement-breakpoint
SET @add_contactId_sql := IF(
  @has_contactId = 0,
  'ALTER TABLE `invoices` ADD COLUMN `contactId` INT NULL AFTER `clientId`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_contactId_stmt FROM @add_contactId_sql;
--> statement-breakpoint
EXECUTE add_contactId_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_contactId_stmt;
--> statement-breakpoint

ALTER TABLE `invoices`
  MODIFY COLUMN `invoiceNumber` VARCHAR(50) NOT NULL,
  MODIFY COLUMN `status` ENUM('draft','sent','paid') NOT NULL DEFAULT 'draft',
  MODIFY COLUMN `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  MODIFY COLUMN `vatAmount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  MODIFY COLUMN `total` DECIMAL(12,2) NOT NULL DEFAULT 0.00;
--> statement-breakpoint

SET @has_invoice_number_per_user_idx := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND INDEX_NAME = 'invoice_number_per_user'
);
--> statement-breakpoint
SET @add_invoice_number_per_user_idx_sql := IF(
  @has_invoice_number_per_user_idx = 0,
  'CREATE UNIQUE INDEX `invoice_number_per_user` ON `invoices` (`userId`, `invoiceNumber`)',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_invoice_number_per_user_idx_stmt FROM @add_invoice_number_per_user_idx_sql;
--> statement-breakpoint
EXECUTE add_invoice_number_per_user_idx_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_invoice_number_per_user_idx_stmt;
--> statement-breakpoint

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
