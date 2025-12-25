-- Phase 1: Settings (Logo + Preferences)
-- Add logo fields to company_settings table
ALTER TABLE `company_settings`
  ADD COLUMN IF NOT EXISTS `logoS3Key` VARCHAR(500) NULL AFTER `nextInvoiceNumber`,
  ADD COLUMN IF NOT EXISTS `logoUrl` TEXT NULL AFTER `logoS3Key`,
  ADD COLUMN IF NOT EXISTS `logoWidth` INT NULL AFTER `logoUrl`,
  ADD COLUMN IF NOT EXISTS `logoHeight` INT NULL AFTER `logoWidth`;

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

CREATE INDEX IF NOT EXISTS `user_preferences_userId_idx` ON `user_preferences` (`userId`);
