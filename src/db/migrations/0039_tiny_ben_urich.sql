CREATE TABLE `equipment_acquisitions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`stage` text DEFAULT 'IDEA' NOT NULL,
	`problem` text NOT NULL,
	`expected_impact` text,
	`estimated_cost` real,
	`priority` text DEFAULT 'MEDIUM' NOT NULL,
	`required_by` text,
	`risk_reduction` text,
	`revenue_impact` text,
	`system_id` integer,
	`domain` text,
	`resulting_asset_id` integer,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`system_id`) REFERENCES `equipment_systems`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`resulting_asset_id`) REFERENCES `equipment_assets`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "equipment_acquisitions_stage_check" CHECK("equipment_acquisitions"."stage" in ('IDEA', 'RESEARCH', 'APPROVED', 'BUDGETED', 'ORDERED', 'RECEIVED', 'DEPLOYED', 'CANCELLED')),
	CONSTRAINT "equipment_acquisitions_priority_check" CHECK("equipment_acquisitions"."priority" in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
	CONSTRAINT "equipment_acquisitions_domain_check" CHECK("equipment_acquisitions"."domain" IS NULL OR "equipment_acquisitions"."domain" in ('COMPUTE', 'STORAGE', 'NETWORK', 'VIDEO', 'PHOTO', 'AUDIO', 'POWER', 'OTHER')),
	CONSTRAINT "equipment_acquisitions_estimated_cost_check" CHECK("equipment_acquisitions"."estimated_cost" IS NULL OR "equipment_acquisitions"."estimated_cost" >= 0)
);
--> statement-breakpoint
CREATE INDEX `equipment_acquisitions_stage_idx` ON `equipment_acquisitions` (`stage`);--> statement-breakpoint
CREATE INDEX `equipment_acquisitions_priority_idx` ON `equipment_acquisitions` (`priority`);--> statement-breakpoint
CREATE TABLE `equipment_maintenance_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_id` integer NOT NULL,
	`type` text NOT NULL,
	`performed_at` text NOT NULL,
	`cost` real,
	`issue` text,
	`action` text,
	`result` text,
	`next_inspection` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`asset_id`) REFERENCES `equipment_assets`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "equipment_maintenance_events_type_check" CHECK("equipment_maintenance_events"."type" in ('INSPECTION', 'CLEANING', 'REPAIR', 'UPGRADE', 'REPLACEMENT', 'FIRMWARE', 'TEST', 'OTHER')),
	CONSTRAINT "equipment_maintenance_events_cost_check" CHECK("equipment_maintenance_events"."cost" IS NULL OR "equipment_maintenance_events"."cost" >= 0)
);
--> statement-breakpoint
CREATE INDEX `equipment_maintenance_events_asset_idx` ON `equipment_maintenance_events` (`asset_id`);--> statement-breakpoint
CREATE INDEX `equipment_maintenance_events_performed_at_idx` ON `equipment_maintenance_events` (`performed_at`);