ALTER TABLE `crm_events` ADD `idempotency_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `crm_events_idempotency_key_idx` ON `crm_events` (`idempotency_key`);--> statement-breakpoint
ALTER TABLE `projects` ADD `cover_url` text;