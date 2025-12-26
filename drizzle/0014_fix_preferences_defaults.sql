-- Fix Phase 1: Update preferences to EU/German defaults
-- Migrate existing MM/DD/YYYY users to DD/MM/YYYY
-- Update schema defaults

-- Update existing users with MM/DD/YYYY to DD/MM/YYYY
UPDATE `user_preferences`
SET `dateFormat` = 'DD/MM/YYYY'
WHERE `dateFormat` = 'MM/DD/YYYY';

-- Update schema defaults (for new users)
ALTER TABLE `user_preferences`
  MODIFY COLUMN `dateFormat` VARCHAR(20) NOT NULL DEFAULT 'DD.MM.YYYY',
  MODIFY COLUMN `timeFormat` VARCHAR(10) NOT NULL DEFAULT '24h',
  MODIFY COLUMN `timezone` VARCHAR(50) NOT NULL DEFAULT 'Europe/Berlin',
  MODIFY COLUMN `language` VARCHAR(10) NOT NULL DEFAULT 'de';
