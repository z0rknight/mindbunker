CREATE TABLE `captures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`context` text NOT NULL,
	`counterparty_label` text,
	`channel` text,
	`event_type` text DEFAULT 'OTHER' NOT NULL,
	`note` text,
	`started_at` integer,
	`ended_at` integer,
	`outcome` text DEFAULT 'UNRESOLVED' NOT NULL,
	`source` text DEFAULT 'WEB_QUICK_CAPTURE' NOT NULL,
	`sensor_device_id` integer,
	`local_capture_id` text,
	`promoted_client_id` integer,
	`promoted_project_id` integer,
	`promoted_video_id` integer,
	`promoted_work_session_id` integer,
	`dismissed_at` integer,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`sensor_device_id`) REFERENCES `sensor_devices`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`promoted_client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`promoted_project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`promoted_video_id`) REFERENCES `video_logs`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`promoted_work_session_id`) REFERENCES `work_sessions`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "captures_ended_after_started_check" CHECK("captures"."ended_at" is null or "captures"."started_at" is null or "captures"."ended_at" >= "captures"."started_at")
);
--> statement-breakpoint
CREATE INDEX `captures_outcome_created_idx` ON `captures` (`outcome`,`created_at`);--> statement-breakpoint
CREATE INDEX `captures_context_idx` ON `captures` (`context`);--> statement-breakpoint
CREATE UNIQUE INDEX `captures_sensor_device_local_unique` ON `captures` (`sensor_device_id`,`local_capture_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `captures_promoted_work_session_unique` ON `captures` (`promoted_work_session_id`);