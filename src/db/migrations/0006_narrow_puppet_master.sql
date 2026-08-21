CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`deadline` text,
	`notes` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `projects_client_status_idx` ON `projects` (`client_id`,`status`);--> statement-breakpoint
CREATE INDEX `projects_deadline_idx` ON `projects` (`deadline`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_video_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`title` text,
	`client_id` integer,
	`project_id` integer,
	`revisions_count` integer DEFAULT 0 NOT NULL,
	`delivered` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_video_logs`("id", "date", "title", "client_id", "project_id", "revisions_count", "delivered", "notes", "created_at", "updated_at") SELECT "id", "date", NULL, "client_id", NULL, "revisions_count", "delivered", "notes", "created_at", NULL FROM `video_logs`;--> statement-breakpoint
DROP TABLE `video_logs`;--> statement-breakpoint
ALTER TABLE `__new_video_logs` RENAME TO `video_logs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `video_logs_project_created_idx` ON `video_logs` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `video_logs_client_created_idx` ON `video_logs` (`client_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `clients` ADD `instagram_username` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `instagram_bio` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `instagram_profile_picture_url` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `instagram_profile_updated_at` integer;
