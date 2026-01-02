-- Add index for supplier history queries (Fix #2: Kill N+1 Query Explosion)
CREATE INDEX IF NOT EXISTS `expenses_createdBy_supplierName_idx` ON `expenses` (`createdBy`, `supplierName`);
