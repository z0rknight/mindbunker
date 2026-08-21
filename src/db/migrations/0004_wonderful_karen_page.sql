CREATE TABLE `crm_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`type` text NOT NULL,
	`actor` text DEFAULT 'system' NOT NULL,
	`description` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `crm_events_client_created_idx` ON `crm_events` (`client_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `gateway_invitations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`opened_at` integer,
	`created_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gateway_invitations_token_hash_unique` ON `gateway_invitations` (`token_hash`);--> statement-breakpoint
CREATE INDEX `gateway_invitations_client_id_idx` ON `gateway_invitations` (`client_id`);--> statement-breakpoint
CREATE TABLE `intake_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`invitation_id` integer NOT NULL,
	`service_interest` text NOT NULL,
	`project_summary` text NOT NULL,
	`objective` text NOT NULL,
	`content_volume` text,
	`references` text,
	`timeline` text,
	`existing_assets` text,
	`notes` text,
	`submitted_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invitation_id`) REFERENCES `gateway_invitations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `intake_submissions_invitation_id_unique` ON `intake_submissions` (`invitation_id`);--> statement-breakpoint
CREATE INDEX `intake_submissions_client_id_idx` ON `intake_submissions` (`client_id`);--> statement-breakpoint
ALTER TABLE `clients` ADD `opportunity_stage` text DEFAULT 'new' NOT NULL;--> statement-breakpoint
UPDATE `clients` SET `opportunity_stage` = 'active' WHERE `status` = 'active' OR `converted` = true;--> statement-breakpoint
ALTER TABLE `clients` ADD `service_interest` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `qualification_notes` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `next_action` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `next_action_date` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `last_interaction_at` integer;
