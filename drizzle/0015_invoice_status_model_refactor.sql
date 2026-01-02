-- Phase 0: Invoice status model refactor
-- Change from status='sent' to status='open' with sentAt timestamp
-- Add sentAt and paidAt timestamps for tracking

-- Step 1: Add new timestamp columns if missing
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
  'ALTER TABLE `invoices` ADD COLUMN `sentAt` DATETIME NULL AFTER `dueDate`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_sentAt_stmt FROM @add_sentAt_sql;
--> statement-breakpoint
EXECUTE add_sentAt_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_sentAt_stmt;
--> statement-breakpoint

SET @has_paidAt := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND COLUMN_NAME = 'paidAt'
);
--> statement-breakpoint
SET @add_paidAt_sql := IF(
  @has_paidAt = 0,
  'ALTER TABLE `invoices` ADD COLUMN `paidAt` DATETIME NULL AFTER `sentAt`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_paidAt_stmt FROM @add_paidAt_sql;
--> statement-breakpoint
EXECUTE add_paidAt_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_paidAt_stmt;
--> statement-breakpoint

-- Step 2: Create indexes for the new columns
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
--> statement-breakpoint

SET @has_paidAt_idx := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'invoices'
    AND INDEX_NAME = 'invoices_paidAt_idx'
);
--> statement-breakpoint
SET @add_paidAt_idx_sql := IF(
  @has_paidAt_idx = 0,
  'CREATE INDEX `invoices_paidAt_idx` ON `invoices` (`paidAt`)',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_paidAt_idx_stmt FROM @add_paidAt_idx_sql;
--> statement-breakpoint
EXECUTE add_paidAt_idx_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_paidAt_idx_stmt;
--> statement-breakpoint

-- Step 3: Migrate existing data
-- For invoices with status='sent', set sentAt to createdAt (best approximation)
UPDATE `invoices`
SET `sentAt` = `createdAt`
WHERE `status` = 'sent';
--> statement-breakpoint

-- For invoices with status='paid', set both sentAt and paidAt
UPDATE `invoices`
SET `sentAt` = `createdAt`,
    `paidAt` = `updatedAt`
WHERE `status` = 'paid';
--> statement-breakpoint

-- Step 4: Update status enum values
-- Change 'sent' to 'open' for all sent invoices
UPDATE `invoices`
SET `status` = 'open'
WHERE `status` = 'sent';
--> statement-breakpoint

-- Step 5: Modify the status column enum (MariaDB syntax)
-- Note: This will be handled by Drizzle schema push, but documented here for manual rollback
-- ALTER TABLE `invoices` MODIFY COLUMN `status` ENUM('draft', 'open', 'paid') NOT NULL DEFAULT 'draft';
