-- Rollback for Phase 1: Settings (Logo + Preferences)
-- Run this ONLY if you need to undo the migration

-- Remove logo columns from company_settings
ALTER TABLE `company_settings`
  DROP COLUMN IF EXISTS `logoS3Key`,
  DROP COLUMN IF EXISTS `logoUrl`,
  DROP COLUMN IF EXISTS `logoWidth`,
  DROP COLUMN IF EXISTS `logoHeight`;

-- Drop user_preferences table
DROP TABLE IF EXISTS `user_preferences`;
