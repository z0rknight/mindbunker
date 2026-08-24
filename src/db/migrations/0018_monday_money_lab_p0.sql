CREATE TABLE `billing_evidence` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contract_id` integer NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`billable_minutes` integer NOT NULL,
	`rate` real NOT NULL,
	`gross_amount` real NOT NULL,
	`currency` text NOT NULL,
	`source` text NOT NULL,
	`external_reference` text,
	`idempotency_key` text NOT NULL,
	`imported_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`contract_id`) REFERENCES `commercial_contracts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "billing_evidence_period_check" CHECK("billing_evidence"."period_end" >= "billing_evidence"."period_start"),
	CONSTRAINT "billing_evidence_minutes_check" CHECK("billing_evidence"."billable_minutes" >= 0),
	CONSTRAINT "billing_evidence_source_check" CHECK("billing_evidence"."source" in ('MANUAL', 'CSV_IMPORT', 'UPWORK_REPORT'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_evidence_idempotency_idx` ON `billing_evidence` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `billing_evidence_contract_period_idx` ON `billing_evidence` (`contract_id`,`period_start`,`period_end`);--> statement-breakpoint
CREATE TABLE `commercial_contracts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`platform` text NOT NULL,
	`external_reference` text,
	`billing_type` text NOT NULL,
	`hourly_rate` real,
	`currency` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "commercial_contracts_billing_type_check" CHECK("commercial_contracts"."billing_type" in ('HOURLY', 'FIXED')),
	CONSTRAINT "commercial_contracts_status_check" CHECK("commercial_contracts"."status" in ('ACTIVE', 'PAUSED', 'ENDED')),
	CONSTRAINT "commercial_contracts_hourly_rate_check" CHECK("commercial_contracts"."billing_type" != 'HOURLY' or "commercial_contracts"."hourly_rate" is not null)
);
--> statement-breakpoint
CREATE INDEX `commercial_contracts_client_idx` ON `commercial_contracts` (`client_id`);--> statement-breakpoint
CREATE TABLE `finance_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`tax_reserve_percent` real DEFAULT 10 NOT NULL,
	`updated_at` integer,
	CONSTRAINT "finance_settings_singleton_check" CHECK("finance_settings"."id" = 1),
	CONSTRAINT "finance_settings_percent_check" CHECK("finance_settings"."tax_reserve_percent" >= 0 and "finance_settings"."tax_reserve_percent" <= 100)
);
--> statement-breakpoint
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
	`created_at` integer,
	FOREIGN KEY (`billing_evidence_id`) REFERENCES `billing_evidence`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "transactions_type_check" CHECK("__new_transactions"."type" in ('income', 'expense', 'owner_pay'))
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "type", "amount", "category", "date", "notes", "created_at") SELECT "id", "type", "amount", "category", "date", "notes", "created_at" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `transactions_billing_evidence_idx` ON `transactions` (`billing_evidence_id`);