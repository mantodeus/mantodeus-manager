-- Migration: Link projects to contacts and preserve date selections
-- Adds clientId foreign key + scheduledDates JSON list for multi-day projects

ALTER TABLE `projects`
  ADD COLUMN `clientId` INT NULL,
  ADD COLUMN `scheduledDates` JSON NULL;
--> statement-breakpoint
CREATE INDEX `projects_clientId_idx` ON `projects` (`clientId`);
--> statement-breakpoint
ALTER TABLE `projects`
  ADD CONSTRAINT `projects_clientId_contacts_id_fk`
    FOREIGN KEY (`clientId`) REFERENCES `contacts`(`id`)
    ON DELETE SET NULL ON UPDATE NO ACTION;
