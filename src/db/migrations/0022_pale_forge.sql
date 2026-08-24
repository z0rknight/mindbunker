ALTER TABLE `source_media_references` ADD `source_url` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `idempotency_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_idempotency_key_idx` ON `transactions` (`idempotency_key`);