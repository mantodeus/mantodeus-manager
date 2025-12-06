-- Diagnostic and fix script for file_metadata column name typos
-- This script checks if columns named 'projectld' and 'jobld' exist and renames them
-- 
-- Run with: mysql -u <user> -p <database> < scripts/fix-file-metadata-columns.sql
-- Or copy-paste into your MySQL client

SET FOREIGN_KEY_CHECKS=0;

-- Check current column names
SELECT 'Current file_metadata columns:' AS info;
SELECT COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'file_metadata'
ORDER BY ORDINAL_POSITION;

-- Check if typos exist
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'file_metadata' 
      AND COLUMN_NAME = 'projectld'
    ) THEN '⚠️  Column projectld exists - needs to be renamed to projectId'
    ELSE '✅ Column projectId is correct'
  END AS projectId_status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'file_metadata' 
      AND COLUMN_NAME = 'jobld'
    ) THEN '⚠️  Column jobld exists - needs to be renamed to jobId'
    ELSE '✅ Column jobId is correct'
  END AS jobId_status;

-- Fix projectld -> projectId (uncomment if needed)
-- ALTER TABLE `file_metadata` CHANGE COLUMN `projectld` `projectId` INT NOT NULL;

-- Fix jobld -> jobId (uncomment if needed)
-- ALTER TABLE `file_metadata` CHANGE COLUMN `jobld` `jobId` INT NULL;

SET FOREIGN_KEY_CHECKS=1;
