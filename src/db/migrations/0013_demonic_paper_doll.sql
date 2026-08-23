ALTER TABLE `clients` ADD `archival_state` text DEFAULT 'ACTIVE_SURFACE' NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `archived_at` integer;