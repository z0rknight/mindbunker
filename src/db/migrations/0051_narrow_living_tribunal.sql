CREATE TABLE `client_production_memory` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`name` text NOT NULL,
	`use_case` text,
	`status` text,
	`approval_evidence` text,
	`preference_notes` text,
	`recipe_notes` text,
	`template_location` text,
	`reference_video_id` integer,
	`reference_url` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reference_video_id`) REFERENCES `video_logs`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "client_production_memory_status_check" CHECK("client_production_memory"."status" is null or "client_production_memory"."status" in ('OBSERVED', 'OPERATOR_CONVENTION', 'CLIENT_APPROVED', 'HISTORICAL'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_production_memory_client_name_unique` ON `client_production_memory` (`client_id`,`name`);--> statement-breakpoint
CREATE INDEX `client_production_memory_client_idx` ON `client_production_memory` (`client_id`);