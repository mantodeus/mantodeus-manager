-- Add invoice design customization fields to company_settings table
-- invoiceAccentColor: Hex color for invoice dividers and accents (default: #00ff88)
-- invoiceAccountHolderName: Account holder name for bank details in invoice footer

-- Check and add invoiceAccentColor
SET @has_invoiceAccentColor := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'invoiceAccentColor'
);
SET @add_invoiceAccentColor_sql := IF(
  @has_invoiceAccentColor = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `invoiceAccentColor` VARCHAR(7) NOT NULL DEFAULT ''#00ff88'' AFTER `logoHeight`',
  'SELECT 1'
);
PREPARE add_invoiceAccentColor_stmt FROM @add_invoiceAccentColor_sql;
EXECUTE add_invoiceAccentColor_stmt;
DEALLOCATE PREPARE add_invoiceAccentColor_stmt;

-- Check and add invoiceAccountHolderName
SET @has_invoiceAccountHolderName := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_settings'
    AND COLUMN_NAME = 'invoiceAccountHolderName'
);
SET @add_invoiceAccountHolderName_sql := IF(
  @has_invoiceAccountHolderName = 0,
  'ALTER TABLE `company_settings` ADD COLUMN `invoiceAccountHolderName` VARCHAR(255) NULL AFTER `invoiceAccentColor`',
  'SELECT 1'
);
PREPARE add_invoiceAccountHolderName_stmt FROM @add_invoiceAccountHolderName_sql;
EXECUTE add_invoiceAccountHolderName_stmt;
DEALLOCATE PREPARE add_invoiceAccountHolderName_stmt;

