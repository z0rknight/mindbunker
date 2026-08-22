PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_crm_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer,
	`video_id` integer,
	`type` text NOT NULL,
	`actor` text DEFAULT 'system' NOT NULL,
	`description` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`video_id`) REFERENCES `video_logs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_crm_events`("id", "client_id", "video_id", "type", "actor", "description", "created_at") SELECT "id", "client_id", "video_id", "type", "actor", "description", "created_at" FROM `crm_events`;--> statement-breakpoint
DROP TABLE `crm_events`;--> statement-breakpoint
ALTER TABLE `__new_crm_events` RENAME TO `crm_events`;--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;--> statement-breakpoint
CREATE INDEX `crm_events_client_created_idx` ON `crm_events` (`client_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `crm_events_video_created_idx` ON `crm_events` (`video_id`,`created_at`);
