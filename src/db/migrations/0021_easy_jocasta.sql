CREATE TABLE `assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`video_id` integer,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`review_url` text,
	`delivery_url` text,
	`published_url` text,
	`thumbnail_url` text,
	`delivered_at` text,
	`notes` text,
	`source` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`video_id`) REFERENCES `video_logs`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "assets_type_check" CHECK("assets"."type" in ('FINAL_DELIVERABLE', 'CLIENT_REVIEW', 'UTILITY_ASSET', 'AI_INPUT', 'SOURCE_PREP', 'BONUS_EXTRA')),
	CONSTRAINT "assets_status_check" CHECK("assets"."status" in ('DRAFT', 'READY', 'DELIVERED'))
);
--> statement-breakpoint
CREATE INDEX `assets_project_idx` ON `assets` (`project_id`);--> statement-breakpoint
CREATE INDEX `assets_video_idx` ON `assets` (`video_id`);--> statement-breakpoint
CREATE TABLE `operating_reserve_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`target_amount` real,
	`currency` text DEFAULT 'USD' NOT NULL,
	`notes` text,
	`updated_at` integer,
	CONSTRAINT "operating_reserve_settings_singleton_check" CHECK("operating_reserve_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `source_media_references` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`approx_size_label` text,
	`location` text,
	`profile` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `source_media_references_project_idx` ON `source_media_references` (`project_id`);--> statement-breakpoint
ALTER TABLE `video_logs` ADD `review_url` text;--> statement-breakpoint
ALTER TABLE `video_logs` ADD `published_url` text;