CREATE TABLE `sensor_devices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`scopes` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_seen_at` integer,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sensor_devices_public_id_unique` ON `sensor_devices` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sensor_devices_token_hash_unique` ON `sensor_devices` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sensor_devices_active_idx` ON `sensor_devices` (`revoked_at`,`public_id`);--> statement-breakpoint
ALTER TABLE `work_sessions` ADD `sensor_device_id` integer REFERENCES `sensor_devices`(`id`) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `work_sessions` ADD `sensor_local_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `work_sessions_sensor_local_unique` ON `work_sessions` (`sensor_device_id`,`sensor_local_id`);--> statement-breakpoint
CREATE TABLE `device_activity_observations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sensor_device_id` integer NOT NULL,
	`local_observation_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	`app_name` text NOT NULL,
	`bundle_id` text,
	`window_title` text,
	`idle` integer DEFAULT false NOT NULL,
	`keystroke_count` integer,
	`mouse_movement_count` integer,
	`source` text DEFAULT 'MAC_SENSOR' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`sensor_device_id`) REFERENCES `sensor_devices`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "device_activity_observations_interval_check" CHECK("device_activity_observations"."ended_at" >= "device_activity_observations"."started_at"),
	CONSTRAINT "device_activity_observations_keystroke_count_check" CHECK("device_activity_observations"."keystroke_count" is null or "device_activity_observations"."keystroke_count" >= 0),
	CONSTRAINT "device_activity_observations_mouse_movement_count_check" CHECK("device_activity_observations"."mouse_movement_count" is null or "device_activity_observations"."mouse_movement_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_activity_observations_device_local_unique` ON `device_activity_observations` (`sensor_device_id`,`local_observation_id`);--> statement-breakpoint
CREATE INDEX `device_activity_observations_started_idx` ON `device_activity_observations` (`started_at`);--> statement-breakpoint
CREATE INDEX `device_activity_observations_device_started_idx` ON `device_activity_observations` (`sensor_device_id`,`started_at`);
