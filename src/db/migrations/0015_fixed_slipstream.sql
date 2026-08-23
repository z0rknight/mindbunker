ALTER TABLE `clients` ADD `portal_password_hash` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `portal_password_set_at` integer;--> statement-breakpoint
ALTER TABLE `clients` ADD `portal_reset_token_hash` text;--> statement-breakpoint
ALTER TABLE `clients` ADD `portal_reset_expires_at` integer;--> statement-breakpoint
ALTER TABLE `video_logs` ADD `cover_url` text;--> statement-breakpoint
ALTER TABLE `video_logs` ADD `orientation` text CONSTRAINT `video_logs_orientation_check` CHECK (`orientation` is null or `orientation` in ('LANDSCAPE', 'VERTICAL', 'SQUARE'));--> statement-breakpoint
ALTER TABLE `video_logs` ADD `content_type` text CONSTRAINT `video_logs_content_type_check` CHECK (`content_type` is null or `content_type` in ('short-form', 'long-form', 'mini-doc', 'testimonial', 'other'));
