CREATE TABLE `inspection_findings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inspectionUnitId` int NOT NULL,
	`defectType` varchar(255),
	`severity` varchar(50),
	`notes` text,
	`positionDescriptor` varchar(500),
	`heightMeters` decimal(8,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdByUserId` int NOT NULL,
	`localId` varchar(255),
	`syncStatus` enum('pending','syncing','synced','error') DEFAULT 'pending',
	CONSTRAINT `inspection_findings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inspection_media` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inspectionFindingId` int NOT NULL,
	`originalS3Key` varchar(500),
	`annotatedS3Key` varchar(500),
	`localOriginalPath` varchar(500),
	`localAnnotatedPath` varchar(500),
	`takenAt` timestamp NOT NULL DEFAULT (now()),
	`takenByUserId` int NOT NULL,
	`syncStatus` enum('pending','syncing','synced','error') DEFAULT 'pending',
	CONSTRAINT `inspection_media_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inspection_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`inspectionType` varchar(100) NOT NULL,
	`unitLabelHint` varchar(255),
	`labelPatternHint` varchar(255),
	`suggestedFields` json,
	`suggestedDefects` json,
	`scope` enum('global','company') NOT NULL DEFAULT 'global',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inspection_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inspection_units` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inspectionId` int NOT NULL,
	`label` varchar(255) NOT NULL,
	`sequenceIndex` int NOT NULL,
	`status` varchar(50),
	`localId` varchar(255),
	`syncStatus` enum('pending','syncing','synced','error') DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inspection_units_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inspections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`templateId` int,
	`type` varchar(100),
	`status` varchar(50),
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdByUserId` int NOT NULL,
	`localId` varchar(255),
	`syncStatus` enum('pending','syncing','synced','error') DEFAULT 'pending',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inspections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(120),
	`quantity` decimal(10,2) NOT NULL DEFAULT '0.00',
	`unitPrice` decimal(12,2) NOT NULL DEFAULT '0.00',
	`currency` varchar(3) NOT NULL DEFAULT 'EUR',
	`lineTotal` decimal(12,2) NOT NULL DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoice_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`dateFormat` varchar(20) NOT NULL DEFAULT 'DD.MM.YYYY',
	`timeFormat` varchar(10) NOT NULL DEFAULT '24h',
	`timezone` varchar(50) NOT NULL DEFAULT 'Europe/Berlin',
	`language` varchar(10) NOT NULL DEFAULT 'de',
	`currency` varchar(3) NOT NULL DEFAULT 'EUR',
	`notificationsEnabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_preferences_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `invoices` MODIFY COLUMN `filename` varchar(255);--> statement-breakpoint
ALTER TABLE `invoices` MODIFY COLUMN `fileKey` varchar(500);--> statement-breakpoint
ALTER TABLE `invoices` MODIFY COLUMN `uploadedBy` int;--> statement-breakpoint
ALTER TABLE `company_settings` ADD `logoS3Key` varchar(500);--> statement-breakpoint
ALTER TABLE `company_settings` ADD `logoUrl` text;--> statement-breakpoint
ALTER TABLE `company_settings` ADD `logoWidth` int;--> statement-breakpoint
ALTER TABLE `company_settings` ADD `logoHeight` int;--> statement-breakpoint
ALTER TABLE `invoices` ADD `userId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `clientId` int;--> statement-breakpoint
ALTER TABLE `invoices` ADD `invoiceNumber` varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `invoiceYear` int NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `invoiceCounter` int NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `status` enum('draft','open','paid') DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `issueDate` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `dueDate` timestamp;--> statement-breakpoint
ALTER TABLE `invoices` ADD `sentAt` timestamp;--> statement-breakpoint
ALTER TABLE `invoices` ADD `paidAt` timestamp;--> statement-breakpoint
ALTER TABLE `invoices` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `servicePeriodStart` timestamp;--> statement-breakpoint
ALTER TABLE `invoices` ADD `servicePeriodEnd` timestamp;--> statement-breakpoint
ALTER TABLE `invoices` ADD `referenceNumber` varchar(100);--> statement-breakpoint
ALTER TABLE `invoices` ADD `partialInvoice` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `subtotal` decimal(12,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `vatAmount` decimal(12,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `total` decimal(12,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `archivedAt` timestamp;--> statement-breakpoint
ALTER TABLE `invoices` ADD `trashedAt` timestamp;--> statement-breakpoint
ALTER TABLE `invoices` ADD `pdfFileKey` varchar(500);--> statement-breakpoint
ALTER TABLE `invoices` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoice_number_per_user` UNIQUE(`userId`,`invoiceNumber`);--> statement-breakpoint
ALTER TABLE `inspection_findings` ADD CONSTRAINT `inspection_findings_inspectionUnitId_inspection_units_id_fk` FOREIGN KEY (`inspectionUnitId`) REFERENCES `inspection_units`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inspection_findings` ADD CONSTRAINT `inspection_findings_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inspection_media` ADD CONSTRAINT `inspection_media_inspectionFindingId_inspection_findings_id_fk` FOREIGN KEY (`inspectionFindingId`) REFERENCES `inspection_findings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inspection_media` ADD CONSTRAINT `inspection_media_takenByUserId_users_id_fk` FOREIGN KEY (`takenByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inspection_units` ADD CONSTRAINT `inspection_units_inspectionId_inspections_id_fk` FOREIGN KEY (`inspectionId`) REFERENCES `inspections`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inspections` ADD CONSTRAINT `inspections_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inspections` ADD CONSTRAINT `inspections_templateId_inspection_templates_id_fk` FOREIGN KEY (`templateId`) REFERENCES `inspection_templates`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inspections` ADD CONSTRAINT `inspections_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_invoiceId_invoices_id_fk` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD CONSTRAINT `user_preferences_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `inspection_findings_inspectionUnitId_idx` ON `inspection_findings` (`inspectionUnitId`);--> statement-breakpoint
CREATE INDEX `inspection_findings_createdByUserId_idx` ON `inspection_findings` (`createdByUserId`);--> statement-breakpoint
CREATE INDEX `inspection_findings_localId_idx` ON `inspection_findings` (`localId`);--> statement-breakpoint
CREATE INDEX `inspection_findings_syncStatus_idx` ON `inspection_findings` (`syncStatus`);--> statement-breakpoint
CREATE INDEX `inspection_media_inspectionFindingId_idx` ON `inspection_media` (`inspectionFindingId`);--> statement-breakpoint
CREATE INDEX `inspection_media_takenByUserId_idx` ON `inspection_media` (`takenByUserId`);--> statement-breakpoint
CREATE INDEX `inspection_media_syncStatus_idx` ON `inspection_media` (`syncStatus`);--> statement-breakpoint
CREATE INDEX `inspection_templates_scope_idx` ON `inspection_templates` (`scope`);--> statement-breakpoint
CREATE INDEX `inspection_templates_inspectionType_idx` ON `inspection_templates` (`inspectionType`);--> statement-breakpoint
CREATE INDEX `inspection_units_inspectionId_idx` ON `inspection_units` (`inspectionId`);--> statement-breakpoint
CREATE INDEX `inspection_units_localId_idx` ON `inspection_units` (`localId`);--> statement-breakpoint
CREATE INDEX `inspection_units_syncStatus_idx` ON `inspection_units` (`syncStatus`);--> statement-breakpoint
CREATE INDEX `inspection_units_inspectionId_sequenceIndex_idx` ON `inspection_units` (`inspectionId`,`sequenceIndex`);--> statement-breakpoint
CREATE INDEX `inspections_projectId_idx` ON `inspections` (`projectId`);--> statement-breakpoint
CREATE INDEX `inspections_templateId_idx` ON `inspections` (`templateId`);--> statement-breakpoint
CREATE INDEX `inspections_createdByUserId_idx` ON `inspections` (`createdByUserId`);--> statement-breakpoint
CREATE INDEX `inspections_localId_idx` ON `inspections` (`localId`);--> statement-breakpoint
CREATE INDEX `inspections_syncStatus_idx` ON `inspections` (`syncStatus`);--> statement-breakpoint
CREATE INDEX `user_preferences_userId_idx` ON `user_preferences` (`userId`);--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_clientId_contacts_id_fk` FOREIGN KEY (`clientId`) REFERENCES `contacts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `invoices_archivedAt_idx` ON `invoices` (`archivedAt`);--> statement-breakpoint
CREATE INDEX `invoices_trashedAt_idx` ON `invoices` (`trashedAt`);--> statement-breakpoint
CREATE INDEX `invoices_sentAt_idx` ON `invoices` (`sentAt`);--> statement-breakpoint
CREATE INDEX `invoices_paidAt_idx` ON `invoices` (`paidAt`);