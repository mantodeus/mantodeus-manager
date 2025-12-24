-- Invoice archive/rubbish lifecycle fields
ALTER TABLE `invoices`
  ADD COLUMN IF NOT EXISTS `archivedAt` DATETIME NULL AFTER `updatedAt`,
  ADD COLUMN IF NOT EXISTS `trashedAt` DATETIME NULL AFTER `archivedAt`;

CREATE INDEX IF NOT EXISTS `invoices_archivedAt_idx` ON `invoices` (`archivedAt`);
CREATE INDEX IF NOT EXISTS `invoices_trashedAt_idx` ON `invoices` (`trashedAt`);
