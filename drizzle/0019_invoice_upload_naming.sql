ALTER TABLE `invoices`
  ADD COLUMN IF NOT EXISTS `originalFileName` VARCHAR(255) NULL AFTER `invoiceNumber`,
  ADD COLUMN IF NOT EXISTS `invoiceName` VARCHAR(255) NULL AFTER `originalFileName`;

CREATE UNIQUE INDEX IF NOT EXISTS `invoice_name_per_user` ON `invoices` (`userId`, `invoiceName`);

-- Backfill invoiceName/originalFileName for existing uploaded invoices.
UPDATE `invoices`
SET
  `originalFileName` = COALESCE(`originalFileName`, `filename`),
  `invoiceName` = CASE
    WHEN `invoiceName` IS NOT NULL THEN `invoiceName`
    WHEN `filename` IS NULL THEN NULL
    WHEN `filename` NOT LIKE '%.%' THEN `filename`
    ELSE LEFT(`filename`, LENGTH(`filename`) - LOCATE('.', REVERSE(`filename`)))
  END
WHERE `source` = 'uploaded';
