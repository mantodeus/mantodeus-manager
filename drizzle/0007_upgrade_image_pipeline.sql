-- Migration: Modernize image metadata storage
-- Adds responsive image metadata blobs for both legacy images and new project files.

SET FOREIGN_KEY_CHECKS=0;

ALTER TABLE `images`
  ADD COLUMN `projectId` INT NULL AFTER `taskId`,
  ADD COLUMN `imageMetadata` JSON NULL AFTER `createdAt`;

ALTER TABLE `images`
  ADD CONSTRAINT `images_projectId_projects_id_fk`
  FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`)
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE `file_metadata`
  ADD COLUMN `imageMetadata` JSON NULL AFTER `uploadedAt`;

SET FOREIGN_KEY_CHECKS=1;
