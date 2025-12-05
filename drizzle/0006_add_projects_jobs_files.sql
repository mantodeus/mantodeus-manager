-- Migration: Add Projects, Jobs, and File Metadata tables (FIXED VERSION)
-- Task 1: Database schema and migrations for Projects → Jobs hierarchy
--
-- This migration adds the new project-based structure without modifying
-- legacy tables (jobs, tasks). Data migration happens in Task 5.
--
-- Tables created:
-- - projects: Top-level entity for client projects
-- - project_jobs: Work items nested under projects
-- - file_metadata: S3 file tracking for projects/jobs
--
-- FIXES:
-- - Removed backticks from column names in CREATE TABLE statements
-- - Added IF NOT EXISTS to prevent errors if tables already exist
-- - Simplified ENUM and JSON column definitions
-- - Ensured MySQL 5.7+ and MariaDB 10.2+ compatibility
-- - Added ENGINE and CHARSET specifications

-- ============================================================================
-- PROJECTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS projects (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  client VARCHAR(255),
  description TEXT,
  startDate TIMESTAMP NULL,
  endDate TIMESTAMP NULL,
  address TEXT,
  geo JSON,
  status ENUM('planned', 'active', 'completed', 'archived') NOT NULL DEFAULT 'planned',
  createdBy INT NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX projects_status_idx (status),
  INDEX projects_createdBy_idx (createdBy),
  CONSTRAINT projects_createdBy_users_id_fk FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- PROJECT_JOBS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_jobs (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  projectId INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  description TEXT,
  assignedUsers JSON,
  status ENUM('pending', 'in_progress', 'done', 'cancelled') NOT NULL DEFAULT 'pending',
  startTime TIMESTAMP NULL,
  endTime TIMESTAMP NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX project_jobs_projectId_idx (projectId),
  INDEX project_jobs_status_idx (status),
  INDEX project_jobs_projectId_status_idx (projectId, status),
  CONSTRAINT project_jobs_projectId_projects_id_fk FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- FILE_METADATA TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS file_metadata (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  projectId INT NOT NULL,
  jobId INT,
  s3Key VARCHAR(500) NOT NULL,
  originalName VARCHAR(255) NOT NULL,
  mimeType VARCHAR(100) NOT NULL,
  fileSize INT,
  uploadedBy INT NOT NULL,
  uploadedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX file_metadata_projectId_idx (projectId),
  INDEX file_metadata_jobId_idx (jobId),
  INDEX file_metadata_projectId_jobId_idx (projectId, jobId),
  INDEX file_metadata_uploadedBy_idx (uploadedBy),
  CONSTRAINT file_metadata_projectId_projects_id_fk FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT file_metadata_jobId_project_jobs_id_fk FOREIGN KEY (jobId) REFERENCES project_jobs(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT file_metadata_uploadedBy_users_id_fk FOREIGN KEY (uploadedBy) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
