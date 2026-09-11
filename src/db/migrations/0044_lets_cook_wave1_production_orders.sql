CREATE TABLE `production_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`project_id` integer NOT NULL,
	`label` text NOT NULL,
	`channel` text,
	`state` text DEFAULT 'OPEN' NOT NULL,
	`pricing_model` text,
	`expected_value_cents` integer,
	`currency` text,
	`notes` text,
	`received_at` text NOT NULL,
	`closed_at` integer,
	`cancelled_at` integer,
	`ingest_key` text NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "production_orders_state_check" CHECK("production_orders"."state" in ('OPEN', 'CLOSED', 'CANCELLED')),
	CONSTRAINT "production_orders_pricing_model_check" CHECK("production_orders"."pricing_model" is null or "production_orders"."pricing_model" in ('HOURLY', 'FIXED', 'OTHER'))
);
--> statement-breakpoint
CREATE INDEX `production_orders_project_idx` ON `production_orders` (`project_id`);--> statement-breakpoint
CREATE INDEX `production_orders_client_idx` ON `production_orders` (`client_id`);--> statement-breakpoint
CREATE INDEX `production_orders_state_idx` ON `production_orders` (`state`);--> statement-breakpoint
CREATE UNIQUE INDEX `production_orders_ingest_key_idx` ON `production_orders` (`ingest_key`);--> statement-breakpoint
ALTER TABLE `video_logs` ADD `production_order_id` integer REFERENCES production_orders(id);--> statement-breakpoint
ALTER TABLE `video_logs` ADD `cancelled_at` integer;--> statement-breakpoint
CREATE INDEX `video_logs_production_order_idx` ON `video_logs` (`production_order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `video_logs_one_container_per_order_idx` ON `video_logs` (`production_order_id`) WHERE "video_logs"."is_operational_container" = 1 and "video_logs"."production_order_id" is not null;