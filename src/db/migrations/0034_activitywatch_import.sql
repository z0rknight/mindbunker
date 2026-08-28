CREATE TABLE `activitywatch_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`import_id` integer NOT NULL,
	`bucket_id` text NOT NULL,
	`bucket_type` text NOT NULL,
	`hostname` text,
	`started_at` integer NOT NULL,
	`duration_seconds` real NOT NULL,
	`app_name` text,
	`window_title` text,
	`afk_status` text,
	`provenance` text DEFAULT 'ACTIVITYWATCH' NOT NULL,
	`fingerprint` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`import_id`) REFERENCES `activitywatch_imports`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "activitywatch_events_bucket_type_check" CHECK("activitywatch_events"."bucket_type" in ('WINDOW', 'AFK')),
	CONSTRAINT "activitywatch_events_duration_check" CHECK("activitywatch_events"."duration_seconds" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activitywatch_events_fingerprint_unique` ON `activitywatch_events` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `activitywatch_events_bucket_started_idx` ON `activitywatch_events` (`bucket_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `activitywatch_events_import_idx` ON `activitywatch_events` (`import_id`);--> statement-breakpoint
CREATE TABLE `activitywatch_imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bucket_id` text NOT NULL,
	`bucket_type` text NOT NULL,
	`hostname` text,
	`file_fingerprint` text NOT NULL,
	`r2_object_key` text NOT NULL,
	`file_size_bytes` integer NOT NULL,
	`total_events_in_file` integer DEFAULT 0 NOT NULL,
	`new_event_count` integer DEFAULT 0 NOT NULL,
	`duplicate_event_count` integer DEFAULT 0 NOT NULL,
	`rejected_event_count` integer DEFAULT 0 NOT NULL,
	`range_start` integer,
	`range_end` integer,
	`imported_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activitywatch_imports_file_fingerprint_unique` ON `activitywatch_imports` (`file_fingerprint`);--> statement-breakpoint
CREATE INDEX `activitywatch_imports_bucket_idx` ON `activitywatch_imports` (`bucket_id`);