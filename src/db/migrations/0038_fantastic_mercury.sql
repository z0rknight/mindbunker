CREATE TABLE `equipment_assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_code` text NOT NULL,
	`name` text NOT NULL,
	`ownership` text NOT NULL,
	`domain` text NOT NULL,
	`category` text NOT NULL,
	`system_id` integer,
	`parent_asset_id` integer,
	`location` text,
	`assigned_to` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`condition` text DEFAULT 'GOOD' NOT NULL,
	`criticality` text DEFAULT 'CONVENIENCE' NOT NULL,
	`purchase_date` text,
	`purchase_price` real,
	`current_value` real,
	`replacement_cost` real,
	`warranty_until` text,
	`serial_number` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `equipment_systems`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`parent_asset_id`) REFERENCES `equipment_assets`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "equipment_assets_ownership_check" CHECK("equipment_assets"."ownership" in ('PERSONAL', 'RMEDIA', 'FAMILY', 'THIRD_PARTY')),
	CONSTRAINT "equipment_assets_domain_check" CHECK("equipment_assets"."domain" in ('COMPUTE', 'STORAGE', 'NETWORK', 'VIDEO', 'PHOTO', 'AUDIO', 'POWER', 'OTHER')),
	CONSTRAINT "equipment_assets_status_check" CHECK("equipment_assets"."status" in ('ACTIVE', 'RESERVE', 'LOANED', 'MAINTENANCE', 'RETIRED', 'SOLD')),
	CONSTRAINT "equipment_assets_condition_check" CHECK("equipment_assets"."condition" in ('EXCELLENT', 'GOOD', 'ATTENTION', 'CRITICAL')),
	CONSTRAINT "equipment_assets_criticality_check" CHECK("equipment_assets"."criticality" in ('CRITICAL', 'PRODUCTION', 'CONVENIENCE', 'HOBBY')),
	CONSTRAINT "equipment_assets_purchase_price_check" CHECK("equipment_assets"."purchase_price" IS NULL OR "equipment_assets"."purchase_price" >= 0),
	CONSTRAINT "equipment_assets_current_value_check" CHECK("equipment_assets"."current_value" IS NULL OR "equipment_assets"."current_value" >= 0),
	CONSTRAINT "equipment_assets_replacement_cost_check" CHECK("equipment_assets"."replacement_cost" IS NULL OR "equipment_assets"."replacement_cost" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `equipment_assets_code_idx` ON `equipment_assets` (`asset_code`);--> statement-breakpoint
CREATE INDEX `equipment_assets_system_idx` ON `equipment_assets` (`system_id`);--> statement-breakpoint
CREATE INDEX `equipment_assets_parent_idx` ON `equipment_assets` (`parent_asset_id`);--> statement-breakpoint
CREATE INDEX `equipment_assets_ownership_domain_idx` ON `equipment_assets` (`ownership`,`domain`);--> statement-breakpoint
CREATE TABLE `equipment_systems` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`ownership` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`location` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	CONSTRAINT "equipment_systems_ownership_check" CHECK("equipment_systems"."ownership" in ('PERSONAL', 'RMEDIA', 'FAMILY', 'THIRD_PARTY')),
	CONSTRAINT "equipment_systems_status_check" CHECK("equipment_systems"."status" in ('ACTIVE', 'RESERVE', 'RETIRED'))
);
