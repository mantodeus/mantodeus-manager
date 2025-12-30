CREATE TABLE `expense_files` (
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
CREATE TABLE `expenses` (
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
CREATE TABLE `note_files` (
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
ALTER TABLE `expense_files` ADD CONSTRAINT `expense_files_expenseId_expenses_id_fk` FOREIGN KEY (`expenseId`) REFERENCES `expenses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_updatedByUserId_users_id_fk` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_reviewedByUserId_users_id_fk` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_voidedByUserId_users_id_fk` FOREIGN KEY (`voidedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `note_files` ADD CONSTRAINT `note_files_noteId_notes_id_fk` FOREIGN KEY (`noteId`) REFERENCES `notes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `expense_files_expenseId_idx` ON `expense_files` (`expenseId`);--> statement-breakpoint
CREATE INDEX `expenses_createdBy_status_expenseDate_idx` ON `expenses` (`createdBy`,`status`,`expenseDate`);--> statement-breakpoint
CREATE INDEX `expenses_createdBy_expenseDate_idx` ON `expenses` (`createdBy`,`expenseDate`);--> statement-breakpoint
CREATE INDEX `expenses_updatedByUserId_idx` ON `expenses` (`updatedByUserId`);--> statement-breakpoint
CREATE INDEX `note_files_noteId_idx` ON `note_files` (`noteId`);