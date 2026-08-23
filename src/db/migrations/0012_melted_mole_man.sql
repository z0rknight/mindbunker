CREATE TABLE `hist_facts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_id` integer NOT NULL,
	`period_granularity` text NOT NULL,
	`period_year` integer,
	`period_month` integer,
	`period_start` text,
	`period_end` text,
	`identity_canonical_id` text,
	`source` text NOT NULL,
	`metric` text NOT NULL,
	`value` real,
	`unit` text NOT NULL,
	`confidence` text NOT NULL,
	`canonical` integer NOT NULL,
	`provenance` text NOT NULL,
	`derivation_note` text,
	FOREIGN KEY (`batch_id`) REFERENCES `hist_import_batches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`batch_id`,`identity_canonical_id`) REFERENCES `hist_identities`(`batch_id`,`canonical_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "hist_facts_period_granularity_check" CHECK("hist_facts"."period_granularity" in ('month', 'year', 'lifetime', 'window')),
	CONSTRAINT "hist_facts_source_check" CHECK("hist_facts"."source" in ('upwork_weekly_summary', 'upwork_lifetime_billings', 'clockify_detailed_export', 'activitywatch_afk')),
	CONSTRAINT "hist_facts_confidence_check" CHECK("hist_facts"."confidence" in ('HIGH', 'MEDIUM', 'LOW', 'N/A', 'EXPERIMENTAL'))
);
--> statement-breakpoint
CREATE INDEX `hist_facts_batch_period_idx` ON `hist_facts` (`batch_id`,`period_granularity`,`period_year`,`period_month`);--> statement-breakpoint
CREATE INDEX `hist_facts_batch_source_metric_idx` ON `hist_facts` (`batch_id`,`source`,`metric`);--> statement-breakpoint
CREATE INDEX `hist_facts_batch_identity_idx` ON `hist_facts` (`batch_id`,`identity_canonical_id`);--> statement-breakpoint
CREATE TABLE `hist_identities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_id` integer NOT NULL,
	`canonical_id` text NOT NULL,
	`canonical_label` text NOT NULL,
	`identity_type` text NOT NULL,
	`resolution_status` text NOT NULL,
	`resolution_date` text,
	`resolution_note` text,
	FOREIGN KEY (`batch_id`) REFERENCES `hist_import_batches`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "hist_identities_identity_type_check" CHECK("hist_identities"."identity_type" in ('client', 'internal_category', 'unresolved_clockify_label', 'extraction_artifact')),
	CONSTRAINT "hist_identities_resolution_status_check" CHECK("hist_identities"."resolution_status" in ('HUMAN_CONFIRMED', 'SINGLE_SOURCE_ONLY', 'INTERNAL', 'NOT_AN_IDENTITY'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hist_identities_batch_canonical_id_unique` ON `hist_identities` (`batch_id`,`canonical_id`);--> statement-breakpoint
CREATE INDEX `hist_identities_batch_status_idx` ON `hist_identities` (`batch_id`,`resolution_status`);--> statement-breakpoint
CREATE TABLE `hist_identity_source_labels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_id` integer NOT NULL,
	`identity_canonical_id` text NOT NULL,
	`source` text NOT NULL,
	`label` text NOT NULL,
	`occurrences` integer,
	FOREIGN KEY (`batch_id`) REFERENCES `hist_import_batches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`batch_id`,`identity_canonical_id`) REFERENCES `hist_identities`(`batch_id`,`canonical_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `hist_identity_source_labels_batch_identity_idx` ON `hist_identity_source_labels` (`batch_id`,`identity_canonical_id`);--> statement-breakpoint
CREATE TABLE `hist_import_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`artifact_version` text NOT NULL,
	`fingerprint` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`fact_count` integer DEFAULT 0 NOT NULL,
	`identity_count` integer DEFAULT 0 NOT NULL,
	`coverage_month_count` integer DEFAULT 0 NOT NULL,
	`imported_at` integer DEFAULT (unixepoch()) NOT NULL,
	`superseded_at` integer,
	CONSTRAINT "hist_import_batches_status_check" CHECK("hist_import_batches"."status" in ('PENDING', 'ACTIVE', 'SUPERSEDED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hist_import_batches_fingerprint_unique` ON `hist_import_batches` (`fingerprint`);--> statement-breakpoint
CREATE UNIQUE INDEX `hist_import_batches_one_active_idx` ON `hist_import_batches` ((1)) WHERE "hist_import_batches"."status" = 'ACTIVE';--> statement-breakpoint
CREATE TABLE `hist_source_coverage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_id` integer NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`note` text,
	FOREIGN KEY (`batch_id`) REFERENCES `hist_import_batches`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "hist_source_coverage_source_check" CHECK("hist_source_coverage"."source" in ('upwork_weekly_summary', 'clockify_detailed_export', 'activitywatch_afk')),
	CONSTRAINT "hist_source_coverage_status_check" CHECK("hist_source_coverage"."status" in ('DATA_PRESENT', 'UNKNOWN_NO_SOURCE_DATA'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hist_source_coverage_batch_period_source_unique` ON `hist_source_coverage` (`batch_id`,`year`,`month`,`source`);