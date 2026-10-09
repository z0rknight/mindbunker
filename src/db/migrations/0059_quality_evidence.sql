CREATE TABLE `quality_evidence` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` integer NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`before_reference` text,
	`after_reference` text,
	`visibility` text DEFAULT 'INTERNAL_ONLY' NOT NULL,
	`provenance` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `video_logs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "quality_evidence_type_check" CHECK("quality_evidence"."type" in ('IMAGE_COMPARISON', 'AUDIO_COMPARISON')),
	CONSTRAINT "quality_evidence_visibility_check" CHECK("quality_evidence"."visibility" in ('INTERNAL_ONLY', 'CLIENT_SAFE')),
	CONSTRAINT "quality_evidence_has_side_check" CHECK("quality_evidence"."before_reference" is not null OR "quality_evidence"."after_reference" is not null)
);
--> statement-breakpoint
CREATE INDEX `quality_evidence_video_created_idx` ON `quality_evidence` (`video_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `quality_evidence_video_visibility_idx` ON `quality_evidence` (`video_id`,`visibility`);
