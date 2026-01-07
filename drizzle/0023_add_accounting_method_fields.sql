-- Add accountingMethod and vatMethod columns to company_settings table
-- These fields control income recognition logic

SET @has_accountingMethod := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'accountingMethod'
);
--> statement-breakpoint

SET @add_accountingMethod_sql := IF(
  @has_accountingMethod = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `accountingMethod` varchar(20) NOT NULL DEFAULT ''EÜR'' AFTER `isKleinunternehmer`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_accountingMethod_stmt FROM @add_accountingMethod_sql;
--> statement-breakpoint
EXECUTE add_accountingMethod_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_accountingMethod_stmt;
--> statement-breakpoint

SET @has_vatMethod := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'vatMethod'
);
--> statement-breakpoint

SET @add_vatMethod_sql := IF(
  @has_vatMethod = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `vatMethod` varchar(10) NULL AFTER `accountingMethod`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_vatMethod_stmt FROM @add_vatMethod_sql;
--> statement-breakpoint
EXECUTE add_vatMethod_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_vatMethod_stmt;

