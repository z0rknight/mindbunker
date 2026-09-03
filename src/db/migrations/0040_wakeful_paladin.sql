ALTER TABLE `projects` ADD `contract_id` integer REFERENCES commercial_contracts(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `video_logs` ADD `contract_id` integer REFERENCES commercial_contracts(id) ON DELETE SET NULL;
