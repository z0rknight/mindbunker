CREATE TABLE `client_export_reminders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`text` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_export_reminders_client_text_unique` ON `client_export_reminders` (`client_id`,`text`);--> statement-breakpoint
CREATE INDEX `client_export_reminders_client_idx` ON `client_export_reminders` (`client_id`);--> statement-breakpoint
CREATE TABLE `client_protected_terms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`term` text NOT NULL,
	`kind` text,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "client_protected_terms_kind_check" CHECK("client_protected_terms"."kind" is null or "client_protected_terms"."kind" in ('PERSON', 'PROGRAM', 'BRAND', 'PHRASE'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_protected_terms_client_term_unique` ON `client_protected_terms` (`client_id`,`term`);--> statement-breakpoint
CREATE INDEX `client_protected_terms_client_idx` ON `client_protected_terms` (`client_id`);