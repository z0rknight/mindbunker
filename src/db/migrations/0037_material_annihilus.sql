CREATE TABLE `decisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`statement` text NOT NULL,
	`context` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` integer NOT NULL,
	`commitment_id` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`delivered_at` integer DEFAULT (unixepoch()) NOT NULL,
	`delivery_url` text,
	`note` text,
	`status` text DEFAULT 'DELIVERED' NOT NULL,
	`actor` text DEFAULT 'admin' NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `video_logs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`commitment_id`) REFERENCES `commitments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `deliveries_video_idx` ON `deliveries` (`video_id`,`delivered_at`);--> statement-breakpoint
CREATE TABLE `experiments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hypothesis_id` integer,
	`success_condition` text NOT NULL,
	`result` text,
	`verdict` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`hypothesis_id`) REFERENCES `hypotheses`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `friction_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category` text NOT NULL,
	`client_id` integer,
	`project_id` integer,
	`video_id` integer,
	`work_session_id` integer,
	`note` text,
	`minutes_lost` integer,
	`actor` text DEFAULT 'admin' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`video_id`) REFERENCES `video_logs`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`work_session_id`) REFERENCES `work_sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `friction_events_video_idx` ON `friction_events` (`video_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `friction_events_category_idx` ON `friction_events` (`category`,`created_at`);--> statement-breakpoint
CREATE TABLE `hypotheses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`statement` text NOT NULL,
	`evidence_needed` text,
	`review_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `qa_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` integer NOT NULL,
	`result` text NOT NULL,
	`checklist` text,
	`override_reason` text,
	`caused_by` text,
	`actor` text DEFAULT 'admin' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `video_logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `qa_events_video_idx` ON `qa_events` (`video_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `video_lifecycle_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` integer NOT NULL,
	`stage` text NOT NULL,
	`note` text,
	`actor` text DEFAULT 'admin' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `video_logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `video_lifecycle_events_video_idx` ON `video_lifecycle_events` (`video_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `projects` ADD `next_action` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `waiting_on` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `contract_type` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `fixed_price_cents` integer;--> statement-breakpoint
ALTER TABLE `video_logs` ADD `next_action` text;--> statement-breakpoint
ALTER TABLE `video_logs` ADD `waiting_on` text;