CREATE TABLE `email_contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`client_type` text DEFAULT 'UNCLASSIFIED' NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`relationship_origin` text DEFAULT 'MANUAL' NOT NULL,
	`source` text NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	CONSTRAINT "email_contacts_client_type_check" CHECK("email_contacts"."client_type" in ('UNCLASSIFIED', 'EXPERT_EDUCATOR', 'BRAND_LIFESTYLE', 'AGENCY_STUDIO', 'REAL_ESTATE_ARCHITECTURE', 'SAAS_TECH', 'OTHER')),
	CONSTRAINT "email_contacts_status_check" CHECK("email_contacts"."status" in ('ACTIVE', 'DO_NOT_CONTACT', 'BOUNCED', 'ARCHIVED')),
	CONSTRAINT "email_contacts_origin_check" CHECK("email_contacts"."relationship_origin" in ('PAST_CLIENT', 'INBOUND', 'MANUAL')),
	CONSTRAINT "email_contacts_normalized_email_check" CHECK("email_contacts"."email" = lower(trim("email_contacts"."email")) and "email_contacts"."email" like '%_@_%._%')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_contacts_email_unique` ON `email_contacts` (`email`);--> statement-breakpoint
CREATE INDEX `email_contacts_type_status_idx` ON `email_contacts` (`client_type`,`status`);