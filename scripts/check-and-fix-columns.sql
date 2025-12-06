-- Quick check and fix for file_metadata column names
-- Run this after connecting to MySQL: source scripts/check-and-fix-columns.sql

-- Step 1: Check current columns
SELECT '=== Current file_metadata columns ===' AS '';
DESCRIBE file_metadata;

-- Step 2: Check if typos exist
SELECT '=== Checking for typos ===' AS '';
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'file_metadata' 
      AND COLUMN_NAME = 'projectld'
    ) THEN 'FOUND: projectld (needs to be renamed to projectId)'
    ELSE 'OK: projectId column is correct'
  END AS projectId_check;

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'file_metadata' 
      AND COLUMN_NAME = 'jobld'
    ) THEN 'FOUND: jobld (needs to be renamed to jobId)'
    ELSE 'OK: jobId column is correct'
  END AS jobId_check;

-- Step 3: Fix typos (uncomment these lines if typos were found)
-- SET FOREIGN_KEY_CHECKS=0;
-- ALTER TABLE `file_metadata` CHANGE COLUMN `projectld` `projectId` INT NOT NULL;
-- ALTER TABLE `file_metadata` CHANGE COLUMN `jobld` `jobId` INT NULL;
-- SET FOREIGN_KEY_CHECKS=1;

-- Step 4: Verify fix (run after fixing)
-- DESCRIBE file_metadata;
