-- Invoice archive/rubbish lifecycle fields

SET @has_archivedAt := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'archivedAt'
);
--> statement-breakpoint
SET @add_archivedAt_sql := IF(
  @has_archivedAt = 0,
  'ALTER TABLE `invoices` ADD COLUMN `archivedAt` DATETIME NULL AFTER `updatedAt`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_archivedAt_stmt FROM @add_archivedAt_sql;
--> statement-breakpoint
EXECUTE add_archivedAt_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_archivedAt_stmt;
--> statement-breakpoint

SET @has_trashedAt := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'trashedAt'
);
--> statement-breakpoint
SET @add_trashedAt_sql := IF(
  @has_trashedAt = 0,
  'ALTER TABLE `invoices` ADD COLUMN `trashedAt` DATETIME NULL AFTER `archivedAt`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_trashedAt_stmt FROM @add_trashedAt_sql;
--> statement-breakpoint
EXECUTE add_trashedAt_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_trashedAt_stmt;
--> statement-breakpoint

SET @has_invoices_archivedAt_idx := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND INDEX_NAME = 'invoices_archivedAt_idx'
);
--> statement-breakpoint
SET @add_invoices_archivedAt_idx_sql := IF(
  @has_invoices_archivedAt_idx = 0,
  'CREATE INDEX `invoices_archivedAt_idx` ON `invoices` (`archivedAt`)',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_invoices_archivedAt_idx_stmt FROM @add_invoices_archivedAt_idx_sql;
--> statement-breakpoint
EXECUTE add_invoices_archivedAt_idx_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_invoices_archivedAt_idx_stmt;
--> statement-breakpoint

SET @has_invoices_trashedAt_idx := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND INDEX_NAME = 'invoices_trashedAt_idx'
);
--> statement-breakpoint
SET @add_invoices_trashedAt_idx_sql := IF(
  @has_invoices_trashedAt_idx = 0,
  'CREATE INDEX `invoices_trashedAt_idx` ON `invoices` (`trashedAt`)',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_invoices_trashedAt_idx_stmt FROM @add_invoices_trashedAt_idx_sql;
--> statement-breakpoint
EXECUTE add_invoices_trashedAt_idx_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_invoices_trashedAt_idx_stmt;
