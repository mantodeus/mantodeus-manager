SET @has_originalFileName := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'originalFileName'
);
--> statement-breakpoint
SET @add_originalFileName_sql := IF(
  @has_originalFileName = 0,
  'ALTER TABLE `invoices` ADD COLUMN `originalFileName` VARCHAR(255) NULL AFTER `invoiceNumber`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_originalFileName_stmt FROM @add_originalFileName_sql;
--> statement-breakpoint
EXECUTE add_originalFileName_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_originalFileName_stmt;
--> statement-breakpoint

SET @has_invoiceName := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'invoiceName'
);
--> statement-breakpoint
SET @add_invoiceName_sql := IF(
  @has_invoiceName = 0,
  'ALTER TABLE `invoices` ADD COLUMN `invoiceName` VARCHAR(255) NULL AFTER `originalFileName`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_invoiceName_stmt FROM @add_invoiceName_sql;
--> statement-breakpoint
EXECUTE add_invoiceName_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_invoiceName_stmt;
--> statement-breakpoint

SET @has_invoice_name_per_user_idx := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND INDEX_NAME = 'invoice_name_per_user'
);
--> statement-breakpoint
SET @add_invoice_name_per_user_idx_sql := IF(
  @has_invoice_name_per_user_idx = 0,
  'CREATE UNIQUE INDEX `invoice_name_per_user` ON `invoices` (`userId`, `invoiceName`)',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_invoice_name_per_user_idx_stmt FROM @add_invoice_name_per_user_idx_sql;
--> statement-breakpoint
EXECUTE add_invoice_name_per_user_idx_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_invoice_name_per_user_idx_stmt;
--> statement-breakpoint

-- Backfill invoiceName/originalFileName for existing uploaded invoices.
UPDATE `invoices`
SET
  `originalFileName` = COALESCE(`originalFileName`, `filename`),
  `invoiceName` = CASE
    WHEN `invoiceName` IS NOT NULL THEN `invoiceName`
    WHEN `filename` IS NULL THEN NULL
    WHEN `filename` NOT LIKE '%.%' THEN `filename`
    ELSE LEFT(`filename`, LENGTH(`filename`) - LOCATE('.', REVERSE(`filename`)))
  END
WHERE `source` = 'uploaded';
