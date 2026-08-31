CREATE TABLE `cash_account_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cash_account_id` integer NOT NULL,
	`balance_amount` real NOT NULL,
	`observed_at` text NOT NULL,
	`source` text DEFAULT 'WISE_CSV' NOT NULL,
	`external_id` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cash_account_id`) REFERENCES `cash_accounts`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cash_account_snapshots_account_observed_source_idx` ON `cash_account_snapshots` (`cash_account_id`,`observed_at`,`source`);--> statement-breakpoint
CREATE INDEX `cash_account_snapshots_account_date_idx` ON `cash_account_snapshots` (`cash_account_id`,`observed_at`);--> statement-breakpoint
CREATE TABLE `cash_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scope` text NOT NULL,
	`currency` text NOT NULL,
	`pocket` text NOT NULL,
	`label` text NOT NULL,
	`external_source` text DEFAULT 'WISE' NOT NULL,
	`external_account_id` text NOT NULL,
	`opening_balance` real NOT NULL,
	`opening_as_of` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "cash_accounts_scope_check" CHECK("cash_accounts"."scope" in ('BUSINESS', 'PERSONAL')),
	CONSTRAINT "cash_accounts_currency_check" CHECK("cash_accounts"."currency" in ('USD', 'BRL')),
	CONSTRAINT "cash_accounts_pocket_check" CHECK("cash_accounts"."pocket" in ('MAIN', 'RESERVE'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cash_accounts_external_idx` ON `cash_accounts` (`external_source`,`external_account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `cash_accounts_scope_currency_pocket_idx` ON `cash_accounts` (`scope`,`currency`,`pocket`);--> statement-breakpoint
CREATE TABLE `cash_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cash_account_id` integer NOT NULL,
	`date` text NOT NULL,
	`occurred_at` text NOT NULL,
	`amount` real NOT NULL,
	`state` text NOT NULL,
	`description` text NOT NULL,
	`counterparty` text,
	`external_source` text DEFAULT 'WISE' NOT NULL,
	`external_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cash_account_id`) REFERENCES `cash_accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "cash_movements_amount_check" CHECK("cash_movements"."amount" != 0),
	CONSTRAINT "cash_movements_state_check" CHECK("cash_movements"."state" in ('RECONCILED', 'AMBIGUOUS', 'EXTERNAL_TRANSFER', 'INTERNAL_TRANSFER', 'FX', 'IGNORE'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cash_movements_account_external_idx` ON `cash_movements` (`cash_account_id`,`external_source`,`external_id`);--> statement-breakpoint
CREATE INDEX `cash_movements_account_date_idx` ON `cash_movements` (`cash_account_id`,`date`);--> statement-breakpoint
ALTER TABLE `fx_conversions` ADD `external_source` text;--> statement-breakpoint
ALTER TABLE `fx_conversions` ADD `external_id` text;--> statement-breakpoint
ALTER TABLE `fx_conversions` ADD `fee_amount` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `fx_conversions` ADD `fee_currency` text;--> statement-breakpoint
ALTER TABLE `fx_conversions` ADD `counts_toward_observed_rate` integer DEFAULT true NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `fx_conversions_external_identity_idx` ON `fx_conversions` (`external_source`,`external_id`);--> statement-breakpoint
ALTER TABLE `personal_transactions` ADD `external_source` text;--> statement-breakpoint
ALTER TABLE `personal_transactions` ADD `external_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `personal_transactions_external_identity_idx` ON `personal_transactions` (`external_source`,`external_id`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `external_source` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `external_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_external_identity_idx` ON `transactions` (`external_source`,`external_id`);