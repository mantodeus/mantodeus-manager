-- Migration: Add Projects, Jobs, and File Metadata tables
-- Task 1: Database schema and migrations for Projects → Jobs hierarchy
--
-- This migration adds the new project-based structure without modifying
-- legacy tables (jobs, tasks). Data migration happens in Task 5.
--
-- Tables created:
-- - projects: Top-level entity for client projects
-- - project_jobs: Work items nested under projects
-- - file_metadata: S3 file tracking for projects/jobs

-- ============================================================================
-- PROJECTS TABLE
-- ============================================================================
-- Primary key: Auto-increment INT (consistent with existing tables)
-- Indexes: status, createdBy

CREATE TABLE `projects` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `client` VARCHAR(255),
  `description` TEXT,
  `startDate` TIMESTAMP,
  `endDate` TIMESTAMP,
  `address` TEXT,
  `geo` JSON,
  `status` ENUM('planned', 'active', 'completed', 'archived') NOT NULL DEFAULT 'planned',
  `createdBy` INT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `projects_status_idx` (`status`),
  INDEX `projects_createdBy_idx` (`createdBy`),
  CONSTRAINT `projects_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
);
--> statement-breakpoint
-- ============================================================================
-- PROJECT_JOBS TABLE
-- ============================================================================
-- Named project_jobs to avoid conflict with legacy jobs table.
-- Can be renamed to jobs after legacy migration is complete.
-- 
-- Indexes: projectId, status, (projectId, status)
-- ON DELETE CASCADE: Deleting a project deletes its jobs

CREATE TABLE `project_jobs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `projectId` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `category` VARCHAR(100),
  `description` TEXT,
  `assignedUsers` JSON,
  `status` ENUM('pending', 'in_progress', 'done', 'cancelled') NOT NULL DEFAULT 'pending',
  `startTime` TIMESTAMP,
  `endTime` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `project_jobs_projectId_idx` (`projectId`),
  INDEX `project_jobs_status_idx` (`status`),
  INDEX `project_jobs_projectId_status_idx` (`projectId`, `status`),
  CONSTRAINT `project_jobs_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
);
--> statement-breakpoint
-- ============================================================================
-- FILE_METADATA TABLE
-- ============================================================================
-- Tracks files uploaded to S3 for projects/jobs.
-- S3 key pattern: projects/{projectId}/jobs/{jobId}/{timestamp}-{uuid}-{originalFileName}
-- If jobId is null: projects/{projectId}/_project/{timestamp}-{uuid}-{originalFileName}
--
-- Indexes: projectId, jobId, (projectId, jobId), uploadedBy
-- ON DELETE CASCADE: Deleting project/job cleans up file metadata

CREATE TABLE `file_metadata` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `projectId` INT NOT NULL,
  `jobId` INT,
  `s3Key` VARCHAR(500) NOT NULL,
  `originalName` VARCHAR(255) NOT NULL,
  `mimeType` VARCHAR(100) NOT NULL,
  `fileSize` INT,
  `uploadedBy` INT NOT NULL,
  `uploadedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `file_metadata_projectId_idx` (`projectId`),
  INDEX `file_metadata_jobId_idx` (`jobId`),
  INDEX `file_metadata_projectId_jobId_idx` (`projectId`, `jobId`),
  INDEX `file_metadata_uploadedBy_idx` (`uploadedBy`),
  CONSTRAINT `file_metadata_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `file_metadata_jobId_project_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `project_jobs` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `file_metadata_uploadedBy_users_id_fk` FOREIGN KEY (`uploadedBy`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
);
