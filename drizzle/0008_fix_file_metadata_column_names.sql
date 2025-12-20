-- Migration: Fix file_metadata column name typos
-- This migration fixes typos in column names: projectld -> projectId, jobld -> jobId
-- These typos may have been introduced manually or through a corrupted migration
--
-- IMPORTANT: Before running this migration, check if your table has columns named
-- 'projectld' and 'jobld' instead of 'projectId' and 'jobId'. If so, uncomment
-- the ALTER TABLE statements below. If your columns are already correctly named,
-- this migration will fail - that's okay, just skip it.

SET FOREIGN_KEY_CHECKS=0;
--> statement-breakpoint
-- Uncomment these lines if your table has columns named 'projectld' and 'jobld':
-- ALTER TABLE `file_metadata` CHANGE COLUMN `projectld` `projectId` INT NOT NULL;
-- ALTER TABLE `file_metadata` CHANGE COLUMN `jobld` `jobId` INT NULL;

-- If the columns are already correctly named, you can verify with:
-- DESCRIBE `file_metadata`;
--> statement-breakpoint
SET FOREIGN_KEY_CHECKS=1;
