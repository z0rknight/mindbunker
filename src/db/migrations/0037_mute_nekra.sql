CREATE TABLE `decisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`signal_type` text,
	`video_id` integer,
	`client_id` integer,
	`project_id` integer,
	`decision` text NOT NULL,
	`review_at` integer,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`result` text,
	`resolved_at` integer,
	FOREIGN KEY (`video_id`) REFERENCES `video_logs`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "decisions_status_check" CHECK("decisions"."status" in ('OPEN', 'REVIEWED', 'CANCELLED'))
);
--> statement-breakpoint
CREATE INDEX `decisions_status_created_idx` ON `decisions` (`status`,`created_at`);--> statement-breakpoint
ALTER TABLE `video_logs` ADD `video_kind` text DEFAULT 'CLIENT_WORK' NOT NULL CONSTRAINT `video_logs_kind_check` CHECK (`video_kind` in ('CLIENT_WORK', 'SAMPLE', 'INTERNAL'));
