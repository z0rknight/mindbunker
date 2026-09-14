ALTER TABLE `clients` ADD `portal_show_current_account` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `portal_show_search` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `portal_show_summary` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `portal_show_active_work` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `portal_show_recent_deliveries` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `portal_show_completed_by_type` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `portal_show_video_library` integer DEFAULT true NOT NULL;