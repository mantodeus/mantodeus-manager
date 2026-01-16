-- Add weekStartsOn field to user_preferences table
-- Allows users to choose whether the week starts on Monday or Sunday

ALTER TABLE `user_preferences`
  ADD COLUMN `weekStartsOn` VARCHAR(10) NOT NULL DEFAULT 'monday' AFTER `notificationsEnabled`;

-- Update existing users to default to Monday (European standard)
UPDATE `user_preferences`
SET `weekStartsOn` = 'monday'
WHERE `weekStartsOn` IS NULL OR `weekStartsOn` = '';
