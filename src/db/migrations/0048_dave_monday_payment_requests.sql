CREATE TABLE `payment_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`payment_url` text NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "payment_requests_status_check" CHECK("payment_requests"."status" in ('OPEN', 'PAID', 'CANCELLED')),
	CONSTRAINT "payment_requests_amount_check" CHECK("payment_requests"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE INDEX `payment_requests_client_idx` ON `payment_requests` (`client_id`);--> statement-breakpoint
CREATE INDEX `payment_requests_status_idx` ON `payment_requests` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_requests_one_open_per_client_idx` ON `payment_requests` (`client_id`) WHERE "payment_requests"."status" = 'OPEN';