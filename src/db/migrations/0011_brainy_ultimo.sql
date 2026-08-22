CREATE TABLE `work_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` integer NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`activity_type` text DEFAULT 'EDITING' NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `video_logs`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "work_sessions_ended_after_started_check" CHECK("work_sessions"."ended_at" is null or "work_sessions"."ended_at" > "work_sessions"."started_at"),
	CONSTRAINT "work_sessions_activity_type_check" CHECK("work_sessions"."activity_type" in ('EDITING', 'MOTION_GRAPHICS', 'COLOR', 'AUDIO', 'REVIEW', 'EXPORT', 'ADMIN', 'OTHER'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_sessions_one_open_idx` ON `work_sessions` ((1)) WHERE "work_sessions"."ended_at" is null;--> statement-breakpoint
CREATE INDEX `work_sessions_video_started_idx` ON `work_sessions` (`video_id`,`started_at`);
