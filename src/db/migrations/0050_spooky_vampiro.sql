PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sensor_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sensor_device_id` integer NOT NULL,
	`local_session_id` text NOT NULL,
	`video_id` integer,
	`context_type` text DEFAULT 'CLIENT' NOT NULL,
	`context_label` text,
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
	CONSTRAINT "sensor_sessions_approval_state_check" CHECK("__new_sensor_sessions"."approval_state" in ('PENDING', 'APPROVED', 'ARCHIVED', 'DELETED')),
	CONSTRAINT "sensor_sessions_context_type_check" CHECK("__new_sensor_sessions"."context_type" in ('CLIENT', 'LEAD', 'INTERNAL', 'ADMIN')),
	CONSTRAINT "sensor_sessions_context_video_check" CHECK("__new_sensor_sessions"."context_type" = 'CLIENT' or "__new_sensor_sessions"."video_id" is null)
);
--> statement-breakpoint
INSERT INTO `__new_sensor_sessions`("id", "sensor_device_id", "local_session_id", "video_id", "context_type", "context_label", "started_at", "ended_at", "activity_type", "note", "approval_state", "approved_work_session_id", "approved_at", "archived_at", "deleted_at", "source", "created_at", "updated_at") SELECT "id", "sensor_device_id", "local_session_id", "video_id", 'CLIENT', NULL, "started_at", "ended_at", "activity_type", "note", "approval_state", "approved_work_session_id", "approved_at", "archived_at", "deleted_at", "source", "created_at", "updated_at" FROM `sensor_sessions`;--> statement-breakpoint
DROP TABLE `sensor_sessions`;--> statement-breakpoint
ALTER TABLE `__new_sensor_sessions` RENAME TO `sensor_sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `sensor_sessions_device_local_unique` ON `sensor_sessions` (`sensor_device_id`,`local_session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sensor_sessions_approved_work_unique` ON `sensor_sessions` (`approved_work_session_id`);--> statement-breakpoint
CREATE INDEX `sensor_sessions_review_idx` ON `sensor_sessions` (`approval_state`,`started_at`);--> statement-breakpoint
CREATE INDEX `sensor_sessions_video_started_idx` ON `sensor_sessions` (`video_id`,`started_at`);