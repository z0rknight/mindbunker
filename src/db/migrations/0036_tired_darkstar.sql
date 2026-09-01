CREATE TABLE `blockers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` integer NOT NULL,
	`category` text NOT NULL,
	`note` text,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`video_id`) REFERENCES `video_logs`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "blockers_category_check" CHECK("blockers"."category" in ('CLIENT', 'FILES', 'HARDWARE', 'SOFTWARE', 'DECISION', 'PAYMENT', 'INGEST', 'OTHER')),
	CONSTRAINT "blockers_resolution_check" CHECK("blockers"."resolved_at" is null or "blockers"."resolved_at" >= "blockers"."started_at")
);
--> statement-breakpoint
CREATE INDEX `blockers_video_resolved_idx` ON `blockers` (`video_id`,`resolved_at`);--> statement-breakpoint
CREATE TABLE `commitments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`due_at` integer NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`video_id` integer NOT NULL,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `video_logs`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "commitments_status_check" CHECK("commitments"."status" in ('OPEN', 'DONE', 'CANCELLED'))
);
--> statement-breakpoint
CREATE INDEX `commitments_video_status_idx` ON `commitments` (`video_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `commitments_id_video_unique` ON `commitments` (`id`,`video_id`);--> statement-breakpoint
CREATE TABLE `deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` integer NOT NULL,
	`commitment_id` integer,
	`version` integer NOT NULL,
	`status` text DEFAULT 'DELIVERED' NOT NULL,
	`delivery_url` text,
	`note` text,
	`delivered_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `video_logs`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`commitment_id`,`video_id`) REFERENCES `commitments`(`id`,`video_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "deliveries_version_check" CHECK("deliveries"."version" > 0),
	CONSTRAINT "deliveries_status_check" CHECK("deliveries"."status" in ('DELIVERED', 'REDELIVERED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deliveries_video_version_unique` ON `deliveries` (`video_id`,`version`);--> statement-breakpoint
CREATE INDEX `deliveries_commitment_idx` ON `deliveries` (`commitment_id`);--> statement-breakpoint
CREATE TABLE `friction_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` integer NOT NULL,
	`work_session_id` integer,
	`category` text NOT NULL,
	`minutes_lost` integer,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `video_logs`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`work_session_id`) REFERENCES `work_sessions`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "friction_events_category_check" CHECK("friction_events"."category" in ('FILES', 'SOFTWARE', 'CLIENT', 'DECISION', 'QA', 'HARDWARE', 'PROCESS', 'INGEST', 'OTHER')),
	CONSTRAINT "friction_events_minutes_check" CHECK("friction_events"."minutes_lost" is null or ("friction_events"."minutes_lost" >= 0 and "friction_events"."minutes_lost" <= 10080))
);
--> statement-breakpoint
CREATE INDEX `friction_events_video_created_idx` ON `friction_events` (`video_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `friction_events_session_idx` ON `friction_events` (`work_session_id`);--> statement-breakpoint
CREATE TABLE `production_checklist_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` integer NOT NULL,
	`step` text NOT NULL,
	`status` text DEFAULT 'NOT_STARTED' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `video_logs`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "production_checklist_step_check" CHECK("production_checklist_items"."step" in ('ASSEMBLY', 'COLOR', 'AUDIO', 'MOTION', 'CAPTIONS', 'QA', 'EXPORT', 'DELIVERY')),
	CONSTRAINT "production_checklist_status_check" CHECK("production_checklist_items"."status" in ('NOT_STARTED', 'DONE', 'NOT_REQUIRED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `production_checklist_video_step_unique` ON `production_checklist_items` (`video_id`,`step`);--> statement-breakpoint
ALTER TABLE `revisions` ADD `caused_by` text DEFAULT 'UNKNOWN' NOT NULL;--> statement-breakpoint
ALTER TABLE `revisions` ADD `category` text;--> statement-breakpoint
ALTER TABLE `revisions` ADD `minutes_rework` integer;
