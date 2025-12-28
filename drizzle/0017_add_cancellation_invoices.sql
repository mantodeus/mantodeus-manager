-- Add cancellation invoice support
ALTER TABLE `invoices`
  ADD COLUMN `type` ENUM('standard', 'cancellation') NOT NULL DEFAULT 'standard' AFTER `status`,
  ADD COLUMN `cancelledInvoiceId` int NULL AFTER `type`;

-- Enforce one cancellation per original invoice
CREATE UNIQUE INDEX `invoices_cancelledInvoiceId_unique` ON `invoices` (`cancelledInvoiceId`);

-- Link cancellation invoice to original invoice
ALTER TABLE `invoices`
  ADD CONSTRAINT `invoices_cancelledInvoiceId_fk`
  FOREIGN KEY (`cancelledInvoiceId`) REFERENCES `invoices` (`id`);
