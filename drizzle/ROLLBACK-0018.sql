-- Rollback for Expenses Module - Phase 1 Foundation
-- Run this ONLY if you need to undo the migration

-- Drop expense_files table first (due to foreign key)
DROP TABLE IF EXISTS `expense_files`;

-- Drop expenses table
DROP TABLE IF EXISTS `expenses`;

