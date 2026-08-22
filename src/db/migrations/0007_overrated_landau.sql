ALTER TABLE `video_logs` ADD `status` text DEFAULT 'PLANNED' NOT NULL;--> statement-breakpoint
UPDATE `video_logs` SET `status` = 'DONE';--> statement-breakpoint
ALTER TABLE `video_logs` ADD `started_at` integer;
