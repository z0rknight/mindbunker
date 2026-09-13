ALTER TABLE `clients` ADD `portal_can_see_financials` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `portal_can_review` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `portal_can_set_priority` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `visible_to_client` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `video_logs` ADD `visible_to_client` integer DEFAULT true NOT NULL;