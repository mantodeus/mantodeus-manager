-- Expenses Module - Phase 1 Foundation
-- Adds expenses and expense_files tables

CREATE TABLE IF NOT EXISTS `expenses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `createdBy` INT NOT NULL,
  `updatedByUserId` INT NULL,
  `status` ENUM('needs_review','in_order','void') NOT NULL DEFAULT 'needs_review',
  `source` ENUM('upload','scan','manual') NOT NULL,
  `supplierName` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `expenseDate` DATE NOT NULL,
  `grossAmountCents` INT NOT NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'EUR',
  `vatMode` ENUM('none','german','foreign') NOT NULL DEFAULT 'none',
  `vatRate` ENUM('0','7','19') NULL,
  `vatAmountCents` INT NULL,
  `businessUsePct` INT NOT NULL DEFAULT 100,
  `category` ENUM(
    'office_supplies',
    'travel',
    'meals',
    'vehicle',
    'equipment',
    'software',
    'insurance',
    'marketing',
    'utilities',
    'rent',
    'professional_services',
    'shipping',
    'training',
    'subscriptions',
    'repairs',
    'taxes_fees',
    'other'
  ) NULL,
  `reviewedByUserId` INT NULL,
  `reviewedAt` DATETIME NULL,
  `voidedByUserId` INT NULL,
  `voidedAt` DATETIME NULL,
  `voidReason` ENUM('duplicate','personal','mistake','wrong_document','other') NULL,
  `voidNote` TEXT NULL,
  `paymentStatus` ENUM('paid','unpaid') NOT NULL DEFAULT 'unpaid',
  `paymentDate` DATE NULL,
  `paymentMethod` ENUM('cash','bank_transfer','card','online') NULL,
  `confidenceScore` FLOAT NULL,
  `confidenceReason` VARCHAR(255) NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `expenses_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE NO ACTION,
  CONSTRAINT `expenses_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE NO ACTION,
  CONSTRAINT `expenses_reviewedByUserId_fkey` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE NO ACTION,
  CONSTRAINT `expenses_voidedByUserId_fkey` FOREIGN KEY (`voidedByUserId`) REFERENCES `users`(`id`) ON DELETE NO ACTION
);
--> statement-breakpoint

SET @has_expenses_createdBy_status_expenseDate_idx := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'expenses'
    AND INDEX_NAME = 'expenses_createdBy_status_expenseDate_idx'
);
--> statement-breakpoint
SET @add_expenses_createdBy_status_expenseDate_idx_sql := IF(
  @has_expenses_createdBy_status_expenseDate_idx = 0,
  'CREATE INDEX `expenses_createdBy_status_expenseDate_idx` ON `expenses` (`createdBy`, `status`, `expenseDate`)',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_expenses_createdBy_status_expenseDate_idx_stmt FROM @add_expenses_createdBy_status_expenseDate_idx_sql;
--> statement-breakpoint
EXECUTE add_expenses_createdBy_status_expenseDate_idx_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_expenses_createdBy_status_expenseDate_idx_stmt;
--> statement-breakpoint

SET @has_expenses_createdBy_expenseDate_idx := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'expenses'
    AND INDEX_NAME = 'expenses_createdBy_expenseDate_idx'
);
--> statement-breakpoint
SET @add_expenses_createdBy_expenseDate_idx_sql := IF(
  @has_expenses_createdBy_expenseDate_idx = 0,
  'CREATE INDEX `expenses_createdBy_expenseDate_idx` ON `expenses` (`createdBy`, `expenseDate`)',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_expenses_createdBy_expenseDate_idx_stmt FROM @add_expenses_createdBy_expenseDate_idx_sql;
--> statement-breakpoint
EXECUTE add_expenses_createdBy_expenseDate_idx_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_expenses_createdBy_expenseDate_idx_stmt;
--> statement-breakpoint

SET @has_expenses_updatedByUserId_idx := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'expenses'
    AND INDEX_NAME = 'expenses_updatedByUserId_idx'
);
--> statement-breakpoint
SET @add_expenses_updatedByUserId_idx_sql := IF(
  @has_expenses_updatedByUserId_idx = 0,
  'CREATE INDEX `expenses_updatedByUserId_idx` ON `expenses` (`updatedByUserId`)',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_expenses_updatedByUserId_idx_stmt FROM @add_expenses_updatedByUserId_idx_sql;
--> statement-breakpoint
EXECUTE add_expenses_updatedByUserId_idx_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_expenses_updatedByUserId_idx_stmt;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `expense_files` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `expenseId` INT NOT NULL,
  `s3Key` VARCHAR(512) NOT NULL,
  `mimeType` VARCHAR(128) NOT NULL,
  `originalFilename` VARCHAR(255) NOT NULL,
  `fileSize` INT NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `expense_files_expenseId_fkey` FOREIGN KEY (`expenseId`) REFERENCES `expenses`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint

SET @has_expense_files_expenseId_idx := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'expense_files'
    AND INDEX_NAME = 'expense_files_expenseId_idx'
);
--> statement-breakpoint
SET @add_expense_files_expenseId_idx_sql := IF(
  @has_expense_files_expenseId_idx = 0,
  'CREATE INDEX `expense_files_expenseId_idx` ON `expense_files` (`expenseId`)',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_expense_files_expenseId_idx_stmt FROM @add_expense_files_expenseId_idx_sql;
--> statement-breakpoint
EXECUTE add_expense_files_expenseId_idx_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_expense_files_expenseId_idx_stmt;
