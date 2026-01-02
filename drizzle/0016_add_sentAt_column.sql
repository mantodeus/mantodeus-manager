-- Add missing sentAt column to invoices table
-- This column was supposed to be added in migration 0015 but failed due to MySQL syntax issue
-- (MySQL doesn't support "IF NOT EXISTS" for ADD COLUMN)

SET @has_sentAt := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'sentAt'
);
--> statement-breakpoint

SET @add_sentAt_sql := IF(
  @has_sentAt = 0,
  'ALTER TABLE `invoices` ADD COLUMN `sentAt` timestamp NULL AFTER `dueDate`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_sentAt_stmt FROM @add_sentAt_sql;
--> statement-breakpoint
EXECUTE add_sentAt_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_sentAt_stmt;
--> statement-breakpoint

SET @has_sentAt_idx := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND INDEX_NAME = 'invoices_sentAt_idx'
);
--> statement-breakpoint

SET @add_sentAt_idx_sql := IF(
  @has_sentAt_idx = 0,
  'CREATE INDEX `invoices_sentAt_idx` ON `invoices` (`sentAt`)',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_sentAt_idx_stmt FROM @add_sentAt_idx_sql;
--> statement-breakpoint
EXECUTE add_sentAt_idx_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_sentAt_idx_stmt;
