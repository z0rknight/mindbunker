CREATE TABLE `caffeine_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`occurred_at` integer NOT NULL,
	`servings` integer DEFAULT 1 NOT NULL,
	`source` text DEFAULT 'QUICK_LOG' NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "caffeine_events_servings_check" CHECK("caffeine_events"."servings" > 0)
);
--> statement-breakpoint
CREATE INDEX `caffeine_events_occurred_at_idx` ON `caffeine_events` (`occurred_at`);--> statement-breakpoint
CREATE TABLE `screen_time_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`device` text NOT NULL,
	`total_minutes` integer NOT NULL,
	`source` text DEFAULT 'MANUAL_APPLE_SCREEN_TIME_SNAPSHOT' NOT NULL,
	`raw_payload` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "screen_time_snapshots_period_check" CHECK("screen_time_snapshots"."period_end" >= "screen_time_snapshots"."period_start"),
	CONSTRAINT "screen_time_snapshots_total_minutes_check" CHECK("screen_time_snapshots"."total_minutes" >= 0)
);
--> statement-breakpoint
CREATE INDEX `screen_time_snapshots_period_idx` ON `screen_time_snapshots` (`period_start`,`period_end`);