ALTER TABLE `clients` ADD `portal_password_hash` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `portal_password_set_at` integer;--> statement-breakpoint
ALTER TABLE `clients` ADD `portal_reset_token_hash` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `portal_reset_expires_at` integer;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_video_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`title` text,
	`client_id` integer,
	`project_id` integer,
	`status` text DEFAULT 'PLANNED' NOT NULL,
	`started_at` integer,
	`revisions_count` integer DEFAULT 0 NOT NULL,
	`delivered` integer DEFAULT true NOT NULL,
	`delivery_url` text,
	`notes` text,
	`cover_url` text,
	`orientation` text,
	`content_type` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "video_logs_orientation_check" CHECK("__new_video_logs"."orientation" is null or "__new_video_logs"."orientation" in ('LANDSCAPE', 'VERTICAL', 'SQUARE')),
	CONSTRAINT "video_logs_content_type_check" CHECK("__new_video_logs"."content_type" is null or "__new_video_logs"."content_type" in ('short-form', 'long-form', 'mini-doc', 'testimonial', 'other'))
);
--> statement-breakpoint
INSERT INTO `__new_video_logs`("id", "date", "title", "client_id", "project_id", "status", "started_at", "revisions_count", "delivered", "delivery_url", "notes", "created_at", "updated_at") SELECT "id", "date", "title", "client_id", "project_id", "status", "started_at", "revisions_count", "delivered", "delivery_url", "notes", "created_at", "updated_at" FROM `video_logs`;--> statement-breakpoint
DROP TABLE `video_logs`;--> statement-breakpoint
ALTER TABLE `__new_video_logs` RENAME TO `video_logs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `video_logs_project_created_idx` ON `video_logs` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `video_logs_client_created_idx` ON `video_logs` (`client_id`,`created_at`);