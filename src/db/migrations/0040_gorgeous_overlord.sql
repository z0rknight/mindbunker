ALTER TABLE `video_logs` ADD `queue_position` integer;--> statement-breakpoint
CREATE INDEX `video_logs_queue_position_idx` ON `video_logs` (`queue_position`);