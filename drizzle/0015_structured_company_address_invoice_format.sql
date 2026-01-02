-- Add structured company address fields and invoice number format

SET @has_streetName := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'streetName'
);
--> statement-breakpoint
SET @add_streetName_sql := IF(
  @has_streetName = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `streetName` VARCHAR(255) NULL AFTER `companyName`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_streetName_stmt FROM @add_streetName_sql;
--> statement-breakpoint
EXECUTE add_streetName_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_streetName_stmt;
--> statement-breakpoint

SET @has_streetNumber := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'streetNumber'
);
--> statement-breakpoint
SET @add_streetNumber_sql := IF(
  @has_streetNumber = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `streetNumber` VARCHAR(50) NULL AFTER `streetName`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_streetNumber_stmt FROM @add_streetNumber_sql;
--> statement-breakpoint
EXECUTE add_streetNumber_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_streetNumber_stmt;
--> statement-breakpoint

SET @has_postalCode := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'postalCode'
);
--> statement-breakpoint
SET @add_postalCode_sql := IF(
  @has_postalCode = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `postalCode` VARCHAR(20) NULL AFTER `streetNumber`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_postalCode_stmt FROM @add_postalCode_sql;
--> statement-breakpoint
EXECUTE add_postalCode_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_postalCode_stmt;
--> statement-breakpoint

SET @has_city := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'city'
);
--> statement-breakpoint
SET @add_city_sql := IF(
  @has_city = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `city` VARCHAR(120) NULL AFTER `postalCode`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_city_stmt FROM @add_city_sql;
--> statement-breakpoint
EXECUTE add_city_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_city_stmt;
--> statement-breakpoint

SET @has_country := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'country'
);
--> statement-breakpoint
SET @add_country_sql := IF(
  @has_country = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `country` VARCHAR(120) NULL AFTER `city`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_country_stmt FROM @add_country_sql;
--> statement-breakpoint
EXECUTE add_country_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_country_stmt;
--> statement-breakpoint

SET @has_invoiceNumberFormat := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'invoiceNumberFormat'
);
--> statement-breakpoint
SET @add_invoiceNumberFormat_sql := IF(
  @has_invoiceNumberFormat = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `invoiceNumberFormat` VARCHAR(50) NULL AFTER `invoicePrefix`',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE add_invoiceNumberFormat_stmt FROM @add_invoiceNumberFormat_sql;
--> statement-breakpoint
EXECUTE add_invoiceNumberFormat_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE add_invoiceNumberFormat_stmt;
--> statement-breakpoint

-- Keep legacy address text but map existing data to streetName if empty
UPDATE `company_settings`
SET `streetName` = `address`
WHERE `streetName` IS NULL AND `address` IS NOT NULL AND `address` <> '';
--> statement-breakpoint

-- Update preferences defaults to English
ALTER TABLE `user_preferences`
  MODIFY COLUMN `language` VARCHAR(10) NOT NULL DEFAULT 'en';
--> statement-breakpoint

UPDATE `user_preferences`
SET `language` = 'en'
WHERE `language` IS NULL OR `language` = '';
