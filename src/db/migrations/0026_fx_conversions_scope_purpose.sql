ALTER TABLE `fx_conversions` ADD `scope` text DEFAULT 'UNCLASSIFIED' NOT NULL CONSTRAINT "fx_conversions_scope_check" CHECK(`scope` in ('BUSINESS', 'PERSONAL', 'UNCLASSIFIED'));--> statement-breakpoint
ALTER TABLE `fx_conversions` ADD `purpose` text CONSTRAINT "fx_conversions_purpose_check" CHECK(`purpose` is null or `purpose` in ('OPERATING_COST', 'TAX_RESERVE', 'OWNER_TRANSFER', 'OTHER'));--> statement-breakpoint
CREATE INDEX `fx_conversions_scope_idx` ON `fx_conversions` (`scope`);
