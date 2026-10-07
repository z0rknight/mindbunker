CREATE TABLE `film_roll_subjects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`film_roll_id` integer NOT NULL,
	`label` text NOT NULL,
	`shot_count` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`film_roll_id`) REFERENCES `film_rolls`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "film_roll_subjects_shot_count_check" CHECK("film_roll_subjects"."shot_count" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `film_roll_subjects_roll_label_unique` ON `film_roll_subjects` (`film_roll_id`,`label`);--> statement-breakpoint
CREATE INDEX `film_roll_subjects_label_idx` ON `film_roll_subjects` (`label`);--> statement-breakpoint
CREATE TABLE `film_rolls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'BUILDING' NOT NULL,
	`captured_from` text NOT NULL,
	`captured_to` text,
	`rating` integer DEFAULT 0 NOT NULL,
	`aesthetic` text,
	`tags` text,
	`soundtrack` text,
	`storage_reference` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	CONSTRAINT "film_rolls_status_check" CHECK("film_rolls"."status" in ('BUILDING', 'READY', 'ARCHIVED')),
	CONSTRAINT "film_rolls_rating_check" CHECK("film_rolls"."rating" >= 0 and "film_rolls"."rating" <= 5)
);
--> statement-breakpoint
CREATE INDEX `film_rolls_captured_rating_idx` ON `film_rolls` (`captured_from`,`rating`);