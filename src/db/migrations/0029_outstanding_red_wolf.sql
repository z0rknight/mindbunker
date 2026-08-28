CREATE TABLE `quotes` (
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
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`video_id`) REFERENCES `video_logs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `quotes_client_id_idx` ON `quotes` (`client_id`);--> statement-breakpoint
CREATE INDEX `quotes_status_idx` ON `quotes` (`status`);--> statement-breakpoint
CREATE INDEX `quotes_video_id_idx` ON `quotes` (`video_id`);