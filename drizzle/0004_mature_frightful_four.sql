CREATE TABLE `jobDates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`date` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobDates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `jobs` ADD `dateMode` enum('range','individual') DEFAULT 'range' NOT NULL;--> statement-breakpoint
ALTER TABLE `jobDates` ADD CONSTRAINT `jobDates_jobId_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE no action ON UPDATE no action;