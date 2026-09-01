CREATE TABLE `commitments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` integer NOT NULL,
	`description` text NOT NULL,
	`due_at` integer,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`source` text DEFAULT 'MANUAL' NOT NULL,
	`actor` text DEFAULT 'admin' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	CONSTRAINT "commitments_owner_type_check" CHECK("commitments"."owner_type" in ('CLIENT', 'PROJECT', 'VIDEO')),
	CONSTRAINT "commitments_status_check" CHECK("commitments"."status" in ('OPEN', 'DONE', 'CANCELLED'))
);
--> statement-breakpoint
CREATE INDEX `commitments_owner_idx` ON `commitments` (`owner_type`,`owner_id`);--> statement-breakpoint
CREATE INDEX `commitments_status_due_idx` ON `commitments` (`status`,`due_at`);--> statement-breakpoint
ALTER TABLE `revisions` ADD `caused_by` text DEFAULT 'UNKNOWN' NOT NULL;