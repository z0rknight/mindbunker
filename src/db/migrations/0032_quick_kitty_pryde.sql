CREATE TABLE `cash_balance_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scope` text NOT NULL,
	`currency` text NOT NULL,
	`balance_amount` real NOT NULL,
	`observed_at` text NOT NULL,
	`source` text DEFAULT 'WISE_MANUAL' NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "cash_balance_snapshots_scope_check" CHECK("cash_balance_snapshots"."scope" in ('BUSINESS', 'PERSONAL')),
	CONSTRAINT "cash_balance_snapshots_currency_check" CHECK("cash_balance_snapshots"."currency" in ('USD', 'BRL'))
);
--> statement-breakpoint
CREATE INDEX `cash_balance_snapshots_scope_currency_idx` ON `cash_balance_snapshots` (`scope`,`currency`,`observed_at`);