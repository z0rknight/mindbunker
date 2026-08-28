PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sensor_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sensor_device_id` integer NOT NULL,
	`local_session_id` text NOT NULL,
	`video_id` integer NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`activity_type` text NOT NULL,
	`note` text,
	`approval_state` text DEFAULT 'PENDING' NOT NULL,
	`approved_work_session_id` integer,
	`approved_at` integer,
	`archived_at` integer,
	`deleted_at` integer,
	`source` text DEFAULT 'MAC_SENSOR' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`sensor_device_id`) REFERENCES `sensor_devices`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`video_id`) REFERENCES `video_logs`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`approved_work_session_id`) REFERENCES `work_sessions`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "sensor_sessions_ended_after_started_check" CHECK("__new_sensor_sessions"."ended_at" is null or "__new_sensor_sessions"."ended_at" > "__new_sensor_sessions"."started_at"),
	CONSTRAINT "sensor_sessions_activity_type_check" CHECK("__new_sensor_sessions"."activity_type" in ('EDITING', 'MOTION_GRAPHICS', 'COLOR', 'AUDIO', 'REVIEW', 'EXPORT', 'ADMIN', 'CLIENT_SERVICE', 'OTHER')),
	CONSTRAINT "sensor_sessions_approval_state_check" CHECK("__new_sensor_sessions"."approval_state" in ('PENDING', 'APPROVED', 'ARCHIVED', 'DELETED'))
);
--> statement-breakpoint
INSERT INTO `__new_sensor_sessions`("id", "sensor_device_id", "local_session_id", "video_id", "started_at", "ended_at", "activity_type", "note", "approval_state", "approved_work_session_id", "approved_at", "archived_at", "deleted_at", "source", "created_at", "updated_at") SELECT "id", "sensor_device_id", "local_session_id", "video_id", "started_at", "ended_at", "activity_type", "note", "approval_state", "approved_work_session_id", "approved_at", "archived_at", "deleted_at", "source", "created_at", "updated_at" FROM `sensor_sessions`;--> statement-breakpoint
DROP TABLE `sensor_sessions`;--> statement-breakpoint
ALTER TABLE `__new_sensor_sessions` RENAME TO `sensor_sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `sensor_sessions_device_local_unique` ON `sensor_sessions` (`sensor_device_id`,`local_session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sensor_sessions_approved_work_unique` ON `sensor_sessions` (`approved_work_session_id`);--> statement-breakpoint
CREATE INDEX `sensor_sessions_review_idx` ON `sensor_sessions` (`approval_state`,`started_at`);--> statement-breakpoint
CREATE INDEX `sensor_sessions_video_started_idx` ON `sensor_sessions` (`video_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `__new_work_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` integer NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`activity_type` text DEFAULT 'EDITING' NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`source` text DEFAULT 'WEB_TIMER' NOT NULL,
	`sensor_device_id` integer,
	`sensor_local_id` text,
	`updated_at` integer,
	FOREIGN KEY (`video_id`) REFERENCES `video_logs`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`sensor_device_id`) REFERENCES `sensor_devices`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "work_sessions_ended_after_started_check" CHECK("__new_work_sessions"."ended_at" is null or "__new_work_sessions"."ended_at" > "__new_work_sessions"."started_at"),
	CONSTRAINT "work_sessions_activity_type_check" CHECK("__new_work_sessions"."activity_type" in ('EDITING', 'MOTION_GRAPHICS', 'COLOR', 'AUDIO', 'REVIEW', 'EXPORT', 'ADMIN', 'CLIENT_SERVICE', 'OTHER'))
);
--> statement-breakpoint
INSERT INTO `__new_work_sessions`("id", "video_id", "started_at", "ended_at", "activity_type", "note", "created_at", "source", "sensor_device_id", "sensor_local_id", "updated_at") SELECT "id", "video_id", "started_at", "ended_at", "activity_type", "note", "created_at", "source", "sensor_device_id", "sensor_local_id", "updated_at" FROM `work_sessions`;--> statement-breakpoint
DROP TABLE `work_sessions`;--> statement-breakpoint
ALTER TABLE `__new_work_sessions` RENAME TO `work_sessions`;--> statement-breakpoint
CREATE UNIQUE INDEX `work_sessions_one_open_idx` ON `work_sessions` ((1)) WHERE "work_sessions"."ended_at" is null;--> statement-breakpoint
CREATE INDEX `work_sessions_video_started_idx` ON `work_sessions` (`video_id`,`started_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `work_sessions_sensor_local_unique` ON `work_sessions` (`sensor_device_id`,`sensor_local_id`);