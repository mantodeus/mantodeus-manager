-- Add cancellation invoice support

SET @has_type := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'type'
);
--> statement-breakpoint

SET @add_type_sql := IF(
  @has_type = 0,
  "ALTER TABLE `invoices` ADD COLUMN `type` ENUM('standard', 'cancellation') NOT NULL DEFAULT 'standard' AFTER `status`",
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_type_stmt FROM @add_type_sql;
--> statement-breakpoint
EXECUTE add_type_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_type_stmt;
--> statement-breakpoint

SET @has_cancelledInvoiceId := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'cancelledInvoiceId'
);
--> statement-breakpoint

SET @add_cancelledInvoiceId_sql := IF(
  @has_cancelledInvoiceId = 0,
  'ALTER TABLE `invoices` ADD COLUMN `cancelledInvoiceId` int NULL AFTER `type`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_cancelledInvoiceId_stmt FROM @add_cancelledInvoiceId_sql;
--> statement-breakpoint
EXECUTE add_cancelledInvoiceId_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_cancelledInvoiceId_stmt;
--> statement-breakpoint

-- Enforce one cancellation per original invoice
SET @has_cancelledInvoiceId_idx := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND INDEX_NAME = 'invoices_cancelledInvoiceId_unique'
);
--> statement-breakpoint

SET @add_cancelledInvoiceId_idx_sql := IF(
  @has_cancelledInvoiceId_idx = 0,
  'CREATE UNIQUE INDEX `invoices_cancelledInvoiceId_unique` ON `invoices` (`cancelledInvoiceId`)',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_cancelledInvoiceId_idx_stmt FROM @add_cancelledInvoiceId_idx_sql;
--> statement-breakpoint
EXECUTE add_cancelledInvoiceId_idx_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_cancelledInvoiceId_idx_stmt;
--> statement-breakpoint

-- Link cancellation invoice to original invoice
SET @has_cancelledInvoiceId_fk := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND CONSTRAINT_NAME = 'invoices_cancelledInvoiceId_fk'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
--> statement-breakpoint

SET @add_cancelledInvoiceId_fk_sql := IF(
  @has_cancelledInvoiceId_fk = 0,
  'ALTER TABLE `invoices` ADD CONSTRAINT `invoices_cancelledInvoiceId_fk` FOREIGN KEY (`cancelledInvoiceId`) REFERENCES `invoices` (`id`)',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_cancelledInvoiceId_fk_stmt FROM @add_cancelledInvoiceId_fk_sql;
--> statement-breakpoint
EXECUTE add_cancelledInvoiceId_fk_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_cancelledInvoiceId_fk_stmt;
