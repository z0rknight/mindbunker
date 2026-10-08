CREATE TABLE `delivery_recipe_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` integer NOT NULL,
	`instance_id` integer NOT NULL,
	`instance_step_id` integer NOT NULL,
	`previous_state` text NOT NULL,
	`new_state` text NOT NULL,
	`occurred_at` integer DEFAULT (unixepoch()) NOT NULL,
	`actor` text NOT NULL,
	`source` text NOT NULL,
	`provenance` text NOT NULL,
	FOREIGN KEY (`instance_id`,`video_id`) REFERENCES `video_recipe_instances`(`id`,`video_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instance_step_id`,`instance_id`) REFERENCES `video_recipe_instance_steps`(`id`,`instance_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "delivery_recipe_events_previous_state_check" CHECK("delivery_recipe_events"."previous_state" in ('NOT_STARTED', 'ACTIVE', 'DONE', 'N_A')),
	CONSTRAINT "delivery_recipe_events_new_state_check" CHECK("delivery_recipe_events"."new_state" in ('NOT_STARTED', 'ACTIVE', 'DONE', 'N_A')),
	CONSTRAINT "delivery_recipe_events_actor_check" CHECK("delivery_recipe_events"."actor" in ('admin', 'system')),
	CONSTRAINT "delivery_recipe_events_source_check" CHECK("delivery_recipe_events"."source" in ('MINDBUNKER_WEB', 'RMEDIA_APP', 'SYSTEM'))
);
--> statement-breakpoint
CREATE INDEX `delivery_recipe_events_video_occurred_idx` ON `delivery_recipe_events` (`video_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `delivery_recipe_events_instance_occurred_idx` ON `delivery_recipe_events` (`instance_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `delivery_recipe_steps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipe_id` integer NOT NULL,
	`label` text NOT NULL,
	`gate` text NOT NULL,
	`position` integer NOT NULL,
	`quality_standard` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `delivery_recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "delivery_recipe_steps_gate_check" CHECK("delivery_recipe_steps"."gate" in ('STRUCTURE', 'BUILD', 'FINISH', 'QUALITY_REVIEW', 'REVIEW_DELIVERY')),
	CONSTRAINT "delivery_recipe_steps_position_check" CHECK("delivery_recipe_steps"."position" >= 0)
);
--> statement-breakpoint
CREATE INDEX `delivery_recipe_steps_recipe_position_idx` ON `delivery_recipe_steps` (`recipe_id`,`position`);--> statement-breakpoint
CREATE TABLE `delivery_recipes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`applicability` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_recipes_name_unique` ON `delivery_recipes` (`name`);--> statement-breakpoint
CREATE INDEX `delivery_recipes_active_name_idx` ON `delivery_recipes` (`is_active`,`name`);--> statement-breakpoint
CREATE TABLE `video_recipe_instance_steps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`instance_id` integer NOT NULL,
	`template_step_id` integer,
	`label_snapshot` text NOT NULL,
	`gate_snapshot` text NOT NULL,
	`position_snapshot` integer NOT NULL,
	`quality_standard_snapshot` text,
	`state` text DEFAULT 'NOT_STARTED' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`instance_id`) REFERENCES `video_recipe_instances`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_step_id`) REFERENCES `delivery_recipe_steps`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "video_recipe_instance_steps_gate_check" CHECK("video_recipe_instance_steps"."gate_snapshot" in ('STRUCTURE', 'BUILD', 'FINISH', 'QUALITY_REVIEW', 'REVIEW_DELIVERY')),
	CONSTRAINT "video_recipe_instance_steps_state_check" CHECK("video_recipe_instance_steps"."state" in ('NOT_STARTED', 'ACTIVE', 'DONE', 'N_A'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `video_recipe_instance_steps_id_instance_unique` ON `video_recipe_instance_steps` (`id`,`instance_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `video_recipe_instance_steps_position_unique` ON `video_recipe_instance_steps` (`instance_id`,`position_snapshot`);--> statement-breakpoint
CREATE INDEX `video_recipe_instance_steps_state_idx` ON `video_recipe_instance_steps` (`instance_id`,`state`);--> statement-breakpoint
CREATE TABLE `video_recipe_instances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` integer NOT NULL,
	`recipe_id` integer NOT NULL,
	`recipe_name_snapshot` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	`archived_at` integer,
	FOREIGN KEY (`video_id`) REFERENCES `video_logs`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`recipe_id`) REFERENCES `delivery_recipes`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "video_recipe_instances_status_check" CHECK("video_recipe_instances"."status" in ('ACTIVE', 'COMPLETED', 'ARCHIVED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `video_recipe_instances_id_video_unique` ON `video_recipe_instances` (`id`,`video_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `video_recipe_instances_one_current_video_idx` ON `video_recipe_instances` (`video_id`) WHERE "video_recipe_instances"."archived_at" is null;--> statement-breakpoint
CREATE INDEX `video_recipe_instances_recipe_idx` ON `video_recipe_instances` (`recipe_id`);
