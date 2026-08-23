ALTER TABLE `work_sessions` ADD `source` text DEFAULT 'WEB_TIMER' NOT NULL;--> statement-breakpoint
ALTER TABLE `work_sessions` ADD `updated_at` integer;