-- Add structured company address fields and invoice number format
ALTER TABLE `company_settings`
  ADD COLUMN IF NOT EXISTS `streetName` VARCHAR(255) NULL AFTER `companyName`,
  ADD COLUMN IF NOT EXISTS `streetNumber` VARCHAR(50) NULL AFTER `streetName`,
  ADD COLUMN IF NOT EXISTS `postalCode` VARCHAR(20) NULL AFTER `streetNumber`,
  ADD COLUMN IF NOT EXISTS `city` VARCHAR(120) NULL AFTER `postalCode`,
  ADD COLUMN IF NOT EXISTS `country` VARCHAR(120) NULL AFTER `city`,
  ADD COLUMN IF NOT EXISTS `invoiceNumberFormat` VARCHAR(50) NULL AFTER `invoicePrefix`;

-- Keep legacy address text but map existing data to streetName if empty
UPDATE `company_settings`
SET `streetName` = `address`
WHERE `streetName` IS NULL AND `address` IS NOT NULL AND `address` <> '';

-- Update preferences defaults to English
ALTER TABLE `user_preferences`
  MODIFY COLUMN `language` VARCHAR(10) NOT NULL DEFAULT 'en';

UPDATE `user_preferences`
SET `language` = 'en'
WHERE `language` IS NULL OR `language` = '';
