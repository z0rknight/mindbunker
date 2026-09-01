CREATE TABLE `action_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`priority` text DEFAULT 'P2' NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`due_at` integer,
	`note` text,
	`owner_type` text,
	`owner_id` integer,
	`source` text DEFAULT 'MANUAL' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `action_items_status_priority_idx` ON `action_items` (`status`,`priority`);--> statement-breakpoint
CREATE INDEX `action_items_owner_idx` ON `action_items` (`owner_type`,`owner_id`);--> statement-breakpoint
CREATE TABLE `objectives` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`period` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`target_text` text,
	`current_text` text,
	`notes` text,
	`linked_commitment_id` integer,
	`linked_project_id` integer,
	`linked_client_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`linked_commitment_id`) REFERENCES `commitments`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`linked_project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`linked_client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `production_checklist_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` integer NOT NULL,
	`step` text NOT NULL,
	`status` text DEFAULT 'NOT_STARTED' NOT NULL,
	`toggled_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `video_logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `production_checklist_video_step_unique` ON `production_checklist_items` (`video_id`,`step`);--> statement-breakpoint
ALTER TABLE `projects` ADD `tags` text;--> statement-breakpoint
ALTER TABLE `revisions` ADD `category` text;--> statement-breakpoint
ALTER TABLE `revisions` ADD `minutes_rework` integer;--> statement-breakpoint
ALTER TABLE `video_logs` ADD `tags_override` text;--> statement-breakpoint
ALTER TABLE `video_logs` ADD `video_kind` text DEFAULT 'CLIENT_WORK' NOT NULL;--> statement-breakpoint
ALTER TABLE `video_logs` ADD `idea_stage` text;--> statement-breakpoint
ALTER TABLE `video_logs` ADD `pitch` text;--> statement-breakpoint
ALTER TABLE `video_logs` ADD `intended_format` text;