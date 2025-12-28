ALTER TABLE `invoices` ADD `type` enum('standard','cancellation') DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `cancelledInvoiceId` int;--> statement-breakpoint
ALTER TABLE `invoices` ADD `source` enum('created','uploaded') DEFAULT 'created' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `needsReview` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `originalPdfS3Key` varchar(500);--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_cancelledInvoiceId_unique` UNIQUE(`cancelledInvoiceId`);--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_cancelledInvoiceId_invoices_id_fk` FOREIGN KEY (`cancelledInvoiceId`) REFERENCES `invoices`(`id`) ON DELETE no action ON UPDATE no action;