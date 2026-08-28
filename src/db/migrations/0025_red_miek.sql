CREATE TABLE `fx_conversions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`brl_amount` real NOT NULL,
	`usd_amount` real NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "fx_conversions_brl_amount_check" CHECK("fx_conversions"."brl_amount" > 0),
	CONSTRAINT "fx_conversions_usd_amount_check" CHECK("fx_conversions"."usd_amount" > 0)
);
--> statement-breakpoint
CREATE INDEX `fx_conversions_date_idx` ON `fx_conversions` (`date`);--> statement-breakpoint
CREATE TABLE `fx_manual_rates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`month` text NOT NULL,
	`rate` real NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "fx_manual_rates_rate_check" CHECK("fx_manual_rates"."rate" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fx_manual_rates_month_idx` ON `fx_manual_rates` (`month`);--> statement-breakpoint
CREATE TABLE `personal_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`category` text NOT NULL,
	`currency` text NOT NULL,
	`date` text NOT NULL,
	`notes` text,
	`owner_pay_transaction_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_pay_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "personal_transactions_type_check" CHECK("personal_transactions"."type" in ('opening_balance', 'owner_pay_receipt', 'income', 'expense')),
	CONSTRAINT "personal_transactions_amount_check" CHECK("personal_transactions"."amount" >= 0),
	CONSTRAINT "personal_transactions_owner_pay_link_check" CHECK(("personal_transactions"."type" = 'owner_pay_receipt') = ("personal_transactions"."owner_pay_transaction_id" is not null))
);
--> statement-breakpoint
CREATE INDEX `personal_transactions_date_idx` ON `personal_transactions` (`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `personal_transactions_owner_pay_txn_idx` ON `personal_transactions` (`owner_pay_transaction_id`);