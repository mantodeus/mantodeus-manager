ALTER TABLE `invoices` MODIFY COLUMN `filename` varchar(255);--> statement-breakpoint
ALTER TABLE `invoices` MODIFY COLUMN `fileKey` varchar(500);--> statement-breakpoint
ALTER TABLE `invoices` MODIFY COLUMN `uploadedBy` int;--> statement-breakpoint
ALTER TABLE `invoices` ADD `invoiceNumber` varchar(50);--> statement-breakpoint
ALTER TABLE `invoices` ADD `status` enum('draft','issued','paid','cancelled') DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `invoiceDate` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `dueDate` timestamp;--> statement-breakpoint
ALTER TABLE `invoices` ADD `issuedAt` timestamp;--> statement-breakpoint
ALTER TABLE `invoices` ADD `items` json DEFAULT ('[]') NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `subtotal` decimal(10,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `vatAmount` decimal(10,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `total` decimal(10,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `pdfFileKey` varchar(500);--> statement-breakpoint
ALTER TABLE `invoices` ADD `userId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;