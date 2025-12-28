-- Rollback for 0017_add_cancellation_invoices.sql

-- Drop foreign key constraint
ALTER TABLE `invoices`
  DROP FOREIGN KEY `invoices_cancelledInvoiceId_fk`;

-- Drop unique index
DROP INDEX `invoices_cancelledInvoiceId_unique` ON `invoices`;

-- Drop columns
ALTER TABLE `invoices`
  DROP COLUMN `cancelledInvoiceId`,
  DROP COLUMN `type`;
