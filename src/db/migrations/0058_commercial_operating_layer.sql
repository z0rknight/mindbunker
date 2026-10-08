CREATE TABLE `commercial_capacity_state` (
	`id` integer PRIMARY KEY NOT NULL DEFAULT 1,
	`state` text NOT NULL DEFAULT 'OPEN',
	`recurring_seats` integer NOT NULL DEFAULT 1,
	`hero_projects` integer NOT NULL DEFAULT 0,
	`reason` text,
	`actor` text NOT NULL DEFAULT 'operator',
	`updated_at` integer NOT NULL DEFAULT (unixepoch()),
	CONSTRAINT `commercial_capacity_singleton_check` CHECK (`commercial_capacity_state`.`id` = 1),
	CONSTRAINT `commercial_capacity_state_check` CHECK (`commercial_capacity_state`.`state` in ('OPEN', 'LIMITED', 'WAITLIST', 'PAUSED')),
	CONSTRAINT `commercial_capacity_recurring_check` CHECK (`commercial_capacity_state`.`recurring_seats` between 0 and 3),
	CONSTRAINT `commercial_capacity_hero_check` CHECK (`commercial_capacity_state`.`hero_projects` between 0 and 1)
);
--> statement-breakpoint
INSERT INTO `commercial_capacity_state` (`id`, `state`, `recurring_seats`, `hero_projects`, `actor`)
VALUES (1, 'OPEN', 1, 0, 'migration-default');
--> statement-breakpoint
ALTER TABLE `quotes` ADD `offer_type` text CHECK (`offer_type` IS NULL OR `offer_type` in ('RECURRING_PARTNERSHIP', 'HERO_EDIT', 'VSL_LAUNCH', 'NEEDS_DISCOVERY', 'NOT_A_FIT'));
--> statement-breakpoint
ALTER TABLE `quotes` ADD `public_token_hash` text;
--> statement-breakpoint
ALTER TABLE `quotes` ADD `public_published_at` integer;
--> statement-breakpoint
ALTER TABLE `quotes` ADD `public_expires_at` integer;
--> statement-breakpoint
ALTER TABLE `quotes` ADD `public_revoked_at` integer;
--> statement-breakpoint
ALTER TABLE `quotes` ADD `payment_url` text;
--> statement-breakpoint
ALTER TABLE `quotes` ADD `payment_label` text;
--> statement-breakpoint
ALTER TABLE `quotes` ADD `strategic_exception_note` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_public_token_hash_unique` ON `quotes` (`public_token_hash`);
--> statement-breakpoint
CREATE INDEX `quotes_public_expiry_idx` ON `quotes` (`public_expires_at`);
