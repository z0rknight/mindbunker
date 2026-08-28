PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_quotes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`amount_cents` integer NOT NULL,
	`content_type_label` text NOT NULL,
	`turnaround_label` text NOT NULL,
	`revisions_included` integer NOT NULL,
	`summary` text,
	`scope_text` text NOT NULL,
	`created_at` integer,
	`sent_at` integer,
	`approved_at` integer,
	`declined_at` integer,
	`project_id` integer,
	`video_id` integer,
	`origin` text DEFAULT 'INTAKE' NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`video_id`) REFERENCES `video_logs`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "quotes_origin_check" CHECK("__new_quotes"."origin" in ('INTAKE', 'MANUAL'))
);
--> statement-breakpoint
INSERT INTO `__new_quotes`("id", "client_id", "status", "currency", "amount_cents", "content_type_label", "turnaround_label", "revisions_included", "summary", "scope_text", "created_at", "sent_at", "approved_at", "declined_at", "project_id", "video_id") SELECT "id", "client_id", "status", "currency", "amount_cents", "content_type_label", "turnaround_label", "revisions_included", "summary", "scope_text", "created_at", "sent_at", "approved_at", "declined_at", "project_id", "video_id" FROM `quotes`;--> statement-breakpoint
DROP TABLE `quotes`;--> statement-breakpoint
ALTER TABLE `__new_quotes` RENAME TO `quotes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `quotes_client_id_idx` ON `quotes` (`client_id`);--> statement-breakpoint
CREATE INDEX `quotes_status_idx` ON `quotes` (`status`);--> statement-breakpoint
CREATE INDEX `quotes_video_id_idx` ON `quotes` (`video_id`);