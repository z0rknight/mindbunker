CREATE TABLE `asset_checklist_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` integer NOT NULL,
	`item_type` text NOT NULL,
	`status` text DEFAULT 'MISSING' NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `asset_checklist_owner_idx` ON `asset_checklist_items` (`owner_type`,`owner_id`);--> statement-breakpoint
CREATE TABLE `blockers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category` text NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` integer NOT NULL,
	`note` text,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`resolved_at` integer,
	`actor` text DEFAULT 'admin' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `blockers_owner_idx` ON `blockers` (`owner_type`,`owner_id`);--> statement-breakpoint
CREATE INDEX `blockers_open_idx` ON `blockers` (`resolved_at`);--> statement-breakpoint
CREATE TABLE `claims` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`statement` text NOT NULL,
	`type` text NOT NULL,
	`confidence` text DEFAULT 'LOW' NOT NULL,
	`evidence_needed` text,
	`source_refs` text,
	`review_at` integer,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`linked_hypothesis_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`linked_hypothesis_id`) REFERENCES `hypotheses`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `daily_states` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`sleep_hours` real,
	`energy` integer,
	`focus` integer,
	`note` text,
	`caffeine_count` integer,
	`cigarettes_count` integer,
	`movement` integer,
	`evening_note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_states_date_unique` ON `daily_states` (`date`);--> statement-breakpoint
CREATE TABLE `ingestion_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` integer NOT NULL,
	`source` text,
	`destination` text,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	`operator_minutes` integer,
	`machine_minutes` integer,
	`blocked_work` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `video_logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ingestion_events_video_idx` ON `ingestion_events` (`video_id`);--> statement-breakpoint
CREATE TABLE `system_candidate_verdicts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`candidate_key` text NOT NULL,
	`verdict` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_candidate_verdicts_candidate_key_unique` ON `system_candidate_verdicts` (`candidate_key`);--> statement-breakpoint
CREATE TABLE `system_interventions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`problem` text,
	`before` text,
	`after` text,
	`related_friction_category` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `work_sessions` ADD `integrity_state` text DEFAULT 'NORMAL' NOT NULL;--> statement-breakpoint
ALTER TABLE `work_sessions` ADD `split_from_session_id` integer;