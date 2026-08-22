ALTER TABLE `crm_events` ADD `video_id` integer REFERENCES video_logs(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `crm_events_video_created_idx` ON `crm_events` (`video_id`,`created_at`);
