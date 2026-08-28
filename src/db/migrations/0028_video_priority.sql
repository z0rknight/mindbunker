ALTER TABLE `video_logs` ADD `is_priority` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `video_logs_project_priority_idx` ON `video_logs` (`project_id`,`is_priority`);