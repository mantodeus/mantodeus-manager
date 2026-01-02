-- Add JSON columns for multiple emails and phone numbers to contacts table
ALTER TABLE `contacts` ADD COLUMN `emails` json;
--> statement-breakpoint
ALTER TABLE `contacts` ADD COLUMN `phoneNumbers` json;

