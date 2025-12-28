-- Note: `type` and `cancelledInvoiceId` columns already exist from migration 0017_add_cancellation_invoices.sql
-- Only adding new columns for PDF upload feature
ALTER TABLE `invoices` ADD `source` enum('created','uploaded') DEFAULT 'created' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `needsReview` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `originalPdfS3Key` varchar(500);