CREATE TABLE `sensor_sessions` (
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
	CONSTRAINT "sensor_sessions_ended_after_started_check" CHECK("sensor_sessions"."ended_at" is null or "sensor_sessions"."ended_at" > "sensor_sessions"."started_at"),
	CONSTRAINT "sensor_sessions_activity_type_check" CHECK("sensor_sessions"."activity_type" in ('EDITING', 'MOTION_GRAPHICS', 'COLOR', 'AUDIO', 'REVIEW', 'EXPORT', 'ADMIN', 'OTHER')),
	CONSTRAINT "sensor_sessions_approval_state_check" CHECK("sensor_sessions"."approval_state" in ('PENDING', 'APPROVED', 'ARCHIVED', 'DELETED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sensor_sessions_device_local_unique` ON `sensor_sessions` (`sensor_device_id`,`local_session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sensor_sessions_approved_work_unique` ON `sensor_sessions` (`approved_work_session_id`);--> statement-breakpoint
CREATE INDEX `sensor_sessions_review_idx` ON `sensor_sessions` (`approval_state`,`started_at`);--> statement-breakpoint
CREATE INDEX `sensor_sessions_video_started_idx` ON `sensor_sessions` (`video_id`,`started_at`);--> statement-breakpoint
INSERT OR IGNORE INTO `sensor_sessions` (
	`sensor_device_id`, `local_session_id`, `video_id`, `started_at`, `ended_at`,
	`activity_type`, `note`, `approval_state`, `approved_work_session_id`,
	`approved_at`, `source`, `created_at`, `updated_at`
)
SELECT
	`sensor_device_id`, `sensor_local_id`, `video_id`, `started_at`, `ended_at`,
	`activity_type`, `note`, 'APPROVED', `id`, COALESCE(`ended_at`, `created_at`),
	'MAC_SENSOR', `created_at`, `updated_at`
FROM `work_sessions`
WHERE `source` = 'MAC_SENSOR'
	AND `sensor_device_id` IS NOT NULL
	AND `sensor_local_id` IS NOT NULL
	AND `ended_at` IS NOT NULL;--> statement-breakpoint
UPDATE `work_sessions`
SET `source` = 'MAC_SENSOR_APPROVED'
WHERE `source` = 'MAC_SENSOR'
	AND EXISTS (
		SELECT 1 FROM `sensor_sessions`
		WHERE `sensor_sessions`.`approved_work_session_id` = `work_sessions`.`id`
	);
