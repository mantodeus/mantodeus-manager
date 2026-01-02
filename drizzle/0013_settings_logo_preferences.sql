-- Phase 1: Settings (Logo + Preferences)
-- Add logo fields to company_settings table

SET @has_logoS3Key := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'logoS3Key'
);
--> statement-breakpoint
SET @add_logoS3Key_sql := IF(
  @has_logoS3Key = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `logoS3Key` VARCHAR(500) NULL AFTER `nextInvoiceNumber`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_logoS3Key_stmt FROM @add_logoS3Key_sql;
--> statement-breakpoint
EXECUTE add_logoS3Key_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_logoS3Key_stmt;
--> statement-breakpoint

SET @has_logoUrl := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'logoUrl'
);
--> statement-breakpoint
SET @add_logoUrl_sql := IF(
  @has_logoUrl = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `logoUrl` TEXT NULL AFTER `logoS3Key`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_logoUrl_stmt FROM @add_logoUrl_sql;
--> statement-breakpoint
EXECUTE add_logoUrl_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_logoUrl_stmt;
--> statement-breakpoint

SET @has_logoWidth := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'logoWidth'
);
--> statement-breakpoint
SET @add_logoWidth_sql := IF(
  @has_logoWidth = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `logoWidth` INT NULL AFTER `logoUrl`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_logoWidth_stmt FROM @add_logoWidth_sql;
--> statement-breakpoint
EXECUTE add_logoWidth_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_logoWidth_stmt;
--> statement-breakpoint

SET @has_logoHeight := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'logoHeight'
);
--> statement-breakpoint
SET @add_logoHeight_sql := IF(
  @has_logoHeight = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `logoHeight` INT NULL AFTER `logoWidth`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_logoHeight_stmt FROM @add_logoHeight_sql;
--> statement-breakpoint
EXECUTE add_logoHeight_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_logoHeight_stmt;
--> statement-breakpoint

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS `user_preferences` (
  `id` SERIAL PRIMARY KEY,
  `userId` INT NOT NULL UNIQUE,
  `dateFormat` VARCHAR(20) NOT NULL DEFAULT 'MM/DD/YYYY',
  `timeFormat` VARCHAR(10) NOT NULL DEFAULT '12h',
  `timezone` VARCHAR(50) NOT NULL DEFAULT 'UTC',
  `language` VARCHAR(10) NOT NULL DEFAULT 'en',
  `currency` VARCHAR(3) NOT NULL DEFAULT 'EUR',
  `notificationsEnabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `user_preferences_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint

SET @has_user_preferences_userId_idx := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_preferences'
    AND INDEX_NAME = 'user_preferences_userId_idx'
);
--> statement-breakpoint
SET @add_user_preferences_userId_idx_sql := IF(
  @has_user_preferences_userId_idx = 0,
  'CREATE INDEX `user_preferences_userId_idx` ON `user_preferences` (`userId`)',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_user_preferences_userId_idx_stmt FROM @add_user_preferences_userId_idx_sql;
--> statement-breakpoint
EXECUTE add_user_preferences_userId_idx_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_user_preferences_userId_idx_stmt;
