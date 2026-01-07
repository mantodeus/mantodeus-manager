-- Fix company_settings table: Add all missing columns using MySQL-compatible syntax
-- This migration ensures all columns from the schema exist, even if previous migrations failed

-- Check and add streetName
SET @has_streetName := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'streetName'
);
SET @add_streetName_sql := IF(
  @has_streetName = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `streetName` VARCHAR(255) NULL AFTER `companyName`',
  'SELECT 1'
);
PREPARE add_streetName_stmt FROM @add_streetName_sql;
EXECUTE add_streetName_stmt;
DEALLOCATE PREPARE add_streetName_stmt;

-- Check and add streetNumber
SET @has_streetNumber := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'streetNumber'
);
SET @add_streetNumber_sql := IF(
  @has_streetNumber = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `streetNumber` VARCHAR(50) NULL AFTER `streetName`',
  'SELECT 1'
);
PREPARE add_streetNumber_stmt FROM @add_streetNumber_sql;
EXECUTE add_streetNumber_stmt;
DEALLOCATE PREPARE add_streetNumber_stmt;

-- Check and add postalCode
SET @has_postalCode := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'postalCode'
);
SET @add_postalCode_sql := IF(
  @has_postalCode = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `postalCode` VARCHAR(20) NULL AFTER `streetNumber`',
  'SELECT 1'
);
PREPARE add_postalCode_stmt FROM @add_postalCode_sql;
EXECUTE add_postalCode_stmt;
DEALLOCATE PREPARE add_postalCode_stmt;

-- Check and add city
SET @has_city := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'city'
);
SET @add_city_sql := IF(
  @has_city = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `city` VARCHAR(120) NULL AFTER `postalCode`',
  'SELECT 1'
);
PREPARE add_city_stmt FROM @add_city_sql;
EXECUTE add_city_stmt;
DEALLOCATE PREPARE add_city_stmt;

-- Check and add country
SET @has_country := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'country'
);
SET @add_country_sql := IF(
  @has_country = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `country` VARCHAR(120) NULL AFTER `city`',
  'SELECT 1'
);
PREPARE add_country_stmt FROM @add_country_sql;
EXECUTE add_country_stmt;
DEALLOCATE PREPARE add_country_stmt;

-- Check and add invoiceNumberFormat
SET @has_invoiceNumberFormat := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'invoiceNumberFormat'
);
SET @add_invoiceNumberFormat_sql := IF(
  @has_invoiceNumberFormat = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `invoiceNumberFormat` VARCHAR(50) NULL AFTER `invoicePrefix`',
  'SELECT 1'
);
PREPARE add_invoiceNumberFormat_stmt FROM @add_invoiceNumberFormat_sql;
EXECUTE add_invoiceNumberFormat_stmt;
DEALLOCATE PREPARE add_invoiceNumberFormat_stmt;

-- Check and add logoS3Key
SET @has_logoS3Key := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'logoS3Key'
);
SET @add_logoS3Key_sql := IF(
  @has_logoS3Key = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `logoS3Key` VARCHAR(500) NULL AFTER `nextInvoiceNumber`',
  'SELECT 1'
);
PREPARE add_logoS3Key_stmt FROM @add_logoS3Key_sql;
EXECUTE add_logoS3Key_stmt;
DEALLOCATE PREPARE add_logoS3Key_stmt;

-- Check and add logoUrl
SET @has_logoUrl := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'logoUrl'
);
SET @add_logoUrl_sql := IF(
  @has_logoUrl = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `logoUrl` TEXT NULL AFTER `logoS3Key`',
  'SELECT 1'
);
PREPARE add_logoUrl_stmt FROM @add_logoUrl_sql;
EXECUTE add_logoUrl_stmt;
DEALLOCATE PREPARE add_logoUrl_stmt;

-- Check and add logoWidth
SET @has_logoWidth := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'logoWidth'
);
SET @add_logoWidth_sql := IF(
  @has_logoWidth = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `logoWidth` INT NULL AFTER `logoUrl`',
  'SELECT 1'
);
PREPARE add_logoWidth_stmt FROM @add_logoWidth_sql;
EXECUTE add_logoWidth_stmt;
DEALLOCATE PREPARE add_logoWidth_stmt;

-- Check and add logoHeight
SET @has_logoHeight := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'logoHeight'
);
SET @add_logoHeight_sql := IF(
  @has_logoHeight = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `logoHeight` INT NULL AFTER `logoWidth`',
  'SELECT 1'
);
PREPARE add_logoHeight_stmt FROM @add_logoHeight_sql;
EXECUTE add_logoHeight_stmt;
DEALLOCATE PREPARE add_logoHeight_stmt;

-- Check and add accountingMethod (if migration 0023 wasn't applied)
SET @has_accountingMethod := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'accountingMethod'
);
SET @add_accountingMethod_sql := IF(
  @has_accountingMethod = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `accountingMethod` VARCHAR(20) NOT NULL DEFAULT ''EÜR'' AFTER `isKleinunternehmer`',
  'SELECT 1'
);
PREPARE add_accountingMethod_stmt FROM @add_accountingMethod_sql;
EXECUTE add_accountingMethod_stmt;
DEALLOCATE PREPARE add_accountingMethod_stmt;

-- Check and add vatMethod (if migration 0023 wasn't applied)
SET @has_vatMethod := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'vatMethod'
);
SET @add_vatMethod_sql := IF(
  @has_vatMethod = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `vatMethod` VARCHAR(10) NULL AFTER `accountingMethod`',
  'SELECT 1'
);
PREPARE add_vatMethod_stmt FROM @add_vatMethod_sql;
EXECUTE add_vatMethod_stmt;
DEALLOCATE PREPARE add_vatMethod_stmt;

