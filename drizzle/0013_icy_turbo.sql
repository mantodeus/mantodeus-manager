CREATE TABLE IF NOT EXISTS `expense_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`expenseId` int NOT NULL,
	`s3Key` varchar(512) NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`originalFilename` varchar(255) NOT NULL,
	`fileSize` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `expense_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`createdBy` int NOT NULL,
	`updatedByUserId` int,
	`status` enum('needs_review','in_order','void') NOT NULL DEFAULT 'needs_review',
	`source` enum('upload','scan','manual') NOT NULL,
	`supplierName` varchar(255) NOT NULL,
	`description` text,
	`expenseDate` timestamp NOT NULL,
	`grossAmountCents` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'EUR',
	`vatMode` enum('none','german','foreign') NOT NULL DEFAULT 'none',
	`vatRate` enum('0','7','19'),
	`vatAmountCents` int,
	`businessUsePct` int NOT NULL DEFAULT 100,
	`category` enum('office_supplies','travel','meals','vehicle','equipment','software','insurance','marketing','utilities','rent','professional_services','shipping','training','subscriptions','repairs','taxes_fees','other'),
	`reviewedByUserId` int,
	`reviewedAt` timestamp,
	`voidedByUserId` int,
	`voidedAt` timestamp,
	`voidReason` enum('duplicate','personal','mistake','wrong_document','other'),
	`voidNote` text,
	`paymentStatus` enum('paid','unpaid') NOT NULL DEFAULT 'unpaid',
	`paymentDate` timestamp,
	`paymentMethod` enum('cash','bank_transfer','card','online'),
	`confidenceScore` decimal(5,2),
	`confidenceReason` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `note_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`noteId` int NOT NULL,
	`s3Key` varchar(512) NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`originalFilename` varchar(255) NOT NULL,
	`fileSize` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `note_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
-- Note: Foreign key constraints are added inline in table creation above or handled by migration 0018
-- Skipping ALTER TABLE ADD CONSTRAINT statements to avoid conflicts with existing constraints
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `expense_files_expenseId_idx` ON `expense_files` (`expenseId`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `expenses_createdBy_status_expenseDate_idx` ON `expenses` (`createdBy`,`status`,`expenseDate`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `expenses_createdBy_expenseDate_idx` ON `expenses` (`createdBy`,`expenseDate`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `expenses_updatedByUserId_idx` ON `expenses` (`updatedByUserId`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `note_files_noteId_idx` ON `note_files` (`noteId`);