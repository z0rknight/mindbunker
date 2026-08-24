CREATE TABLE `billing_allocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`billing_evidence_id` integer NOT NULL,
	`video_id` integer,
	`method` text NOT NULL,
	`amount` real NOT NULL,
	`minutes` integer,
	`currency` text NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`billing_evidence_id`) REFERENCES `billing_evidence`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`video_id`) REFERENCES `video_logs`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "billing_allocations_amount_check" CHECK("billing_allocations"."amount" >= 0),
	CONSTRAINT "billing_allocations_method_check" CHECK("billing_allocations"."method" in ('MANUAL_AMOUNT', 'MANUAL_MINUTES', 'DERIVED_PROPORTION'))
);
--> statement-breakpoint
CREATE INDEX `billing_allocations_evidence_idx` ON `billing_allocations` (`billing_evidence_id`);--> statement-breakpoint
CREATE INDEX `billing_allocations_video_idx` ON `billing_allocations` (`video_id`);--> statement-breakpoint
CREATE TABLE `debts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`creditor` text NOT NULL,
	`original_amount` real NOT NULL,
	`currency` text NOT NULL,
	`notes` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "debts_original_amount_check" CHECK("debts"."original_amount" >= 0),
	CONSTRAINT "debts_status_check" CHECK("debts"."status" in ('ACTIVE', 'PAID'))
);
--> statement-breakpoint
CREATE TABLE `platform_fees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`billing_evidence_id` integer NOT NULL,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`occurred_at` text,
	`source` text NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`billing_evidence_id`) REFERENCES `billing_evidence`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "platform_fees_amount_check" CHECK("platform_fees"."amount" >= 0),
	CONSTRAINT "platform_fees_source_check" CHECK("platform_fees"."source" in ('MANUAL', 'CSV_IMPORT', 'UPWORK_REPORT'))
);
--> statement-breakpoint
CREATE INDEX `platform_fees_evidence_idx` ON `platform_fees` (`billing_evidence_id`);--> statement-breakpoint
CREATE TABLE `reconciliation_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contract_id` integer NOT NULL,
	`date` text NOT NULL,
	`note` text NOT NULL,
	`video_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`contract_id`) REFERENCES `commercial_contracts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`video_id`) REFERENCES `video_logs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `reconciliation_notes_contract_date_idx` ON `reconciliation_notes` (`contract_id`,`date`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`vendor` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`cadence` text NOT NULL,
	`renewal_date` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`category` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "subscriptions_amount_check" CHECK("subscriptions"."amount" >= 0),
	CONSTRAINT "subscriptions_cadence_check" CHECK("subscriptions"."cadence" in ('MONTHLY', 'ANNUAL')),
	CONSTRAINT "subscriptions_status_check" CHECK("subscriptions"."status" in ('ACTIVE', 'CANCELLED', 'TRIAL'))
);
--> statement-breakpoint
CREATE INDEX `subscriptions_renewal_date_idx` ON `subscriptions` (`renewal_date`);--> statement-breakpoint
ALTER TABLE `billing_evidence` ADD `earning_date` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`category` text NOT NULL,
	`date` text NOT NULL,
	`notes` text,
	`currency` text DEFAULT 'USD' NOT NULL,
	`billing_evidence_id` integer,
	`client_id` integer,
	`contract_id` integer,
	`debt_id` integer,
	`subscription_id` integer,
	`created_at` integer,
	FOREIGN KEY (`billing_evidence_id`) REFERENCES `billing_evidence`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`contract_id`) REFERENCES `commercial_contracts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`debt_id`) REFERENCES `debts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "transactions_type_check" CHECK("__new_transactions"."type" in ('income', 'expense', 'owner_pay')),
	CONSTRAINT "transactions_freelance_requires_client_check" CHECK("__new_transactions"."type" != 'income' or lower("__new_transactions"."category") != 'freelance' or "__new_transactions"."client_id" is not null)
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "type", "amount", "category", "date", "notes", "currency", "billing_evidence_id", "created_at") SELECT "id", "type", "amount", "category", "date", "notes", "currency", "billing_evidence_id", "created_at" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `transactions_billing_evidence_idx` ON `transactions` (`billing_evidence_id`);--> statement-breakpoint
CREATE INDEX `transactions_client_idx` ON `transactions` (`client_id`);--> statement-breakpoint
CREATE INDEX `transactions_debt_idx` ON `transactions` (`debt_id`);--> statement-breakpoint
CREATE INDEX `transactions_subscription_idx` ON `transactions` (`subscription_id`);