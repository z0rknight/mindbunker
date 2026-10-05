ALTER TABLE `captures` ADD `context_snapshot_json` text;--> statement-breakpoint
ALTER TABLE `captures` ADD `canonical_work_session_id` integer REFERENCES work_sessions(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `captures_canonical_work_session_idx` ON `captures` (`canonical_work_session_id`);
