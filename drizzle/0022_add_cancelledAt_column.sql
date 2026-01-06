-- Add cancelledAt column to invoices table
-- This column may already exist from a previous migration or manual change
-- (MySQL doesn't support "IF NOT EXISTS" for ADD COLUMN)

SET @has_cancelledAt := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'cancelledAt'
);
--> statement-breakpoint

SET @add_cancelledAt_sql := IF(
  @has_cancelledAt = 0,
  'ALTER TABLE `invoices` ADD COLUMN `cancelledAt` timestamp NULL AFTER `trashedAt`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_cancelledAt_stmt FROM @add_cancelledAt_sql;
--> statement-breakpoint
EXECUTE add_cancelledAt_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_cancelledAt_stmt;
--> statement-breakpoint

SET @has_cancelledAt_idx := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND INDEX_NAME = 'invoices_cancelledAt_idx'
);
--> statement-breakpoint

SET @add_cancelledAt_idx_sql := IF(
  @has_cancelledAt_idx = 0,
  'CREATE INDEX `invoices_cancelledAt_idx` ON `invoices` (`cancelledAt`)',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_cancelledAt_idx_stmt FROM @add_cancelledAt_idx_sql;
--> statement-breakpoint
EXECUTE add_cancelledAt_idx_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_cancelledAt_idx_stmt;

