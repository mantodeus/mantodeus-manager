CREATE TABLE `company_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`companyName` varchar(255),
	`address` text,
	`email` varchar(320),
	`phone` varchar(20),
	`steuernummer` varchar(50),
	`ustIdNr` varchar(50),
	`iban` varchar(34),
	`bic` varchar(11),
	`isKleinunternehmer` boolean NOT NULL DEFAULT false,
	`vatRate` decimal(5,2) NOT NULL DEFAULT '19.00',
	`invoicePrefix` varchar(10) NOT NULL DEFAULT 'RE',
	`nextInvoiceNumber` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `company_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `company_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `project_checkins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`checkInTime` timestamp NOT NULL,
	`checkOutTime` timestamp,
	`latitude` decimal(10,8),
	`longitude` decimal(11,8),
	`notes` text,
	CONSTRAINT `project_checkins_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shared_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentType` enum('project_report','invoice','inspection') NOT NULL,
	`referenceId` int NOT NULL,
	`s3Key` varchar(500) NOT NULL,
	`shareToken` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shared_documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `shared_documents_shareToken_unique` UNIQUE(`shareToken`)
);
--> statement-breakpoint
ALTER TABLE `file_metadata` ADD `tags` json;--> statement-breakpoint
ALTER TABLE `company_settings` ADD CONSTRAINT `company_settings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_checkins` ADD CONSTRAINT `project_checkins_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_checkins` ADD CONSTRAINT `project_checkins_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shared_documents` ADD CONSTRAINT `shared_documents_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `project_checkins_projectId_idx` ON `project_checkins` (`projectId`);--> statement-breakpoint
CREATE INDEX `project_checkins_userId_idx` ON `project_checkins` (`userId`);--> statement-breakpoint
CREATE INDEX `project_checkins_checkInTime_idx` ON `project_checkins` (`checkInTime`);--> statement-breakpoint
CREATE INDEX `shared_documents_shareToken_idx` ON `shared_documents` (`shareToken`);--> statement-breakpoint
CREATE INDEX `shared_documents_expiresAt_idx` ON `shared_documents` (`expiresAt`);