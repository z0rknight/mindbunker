CREATE TABLE `assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`amount` real NOT NULL,
	`avg_buy_price` real NOT NULL,
	`current_price` real NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'lead' NOT NULL,
	`email` text,
	`phone` text,
	`notes` text,
	`total_projects` integer DEFAULT 0 NOT NULL,
	`total_revenue` real DEFAULT 0 NOT NULL,
	`source` text,
	`contacted` integer DEFAULT false NOT NULL,
	`converted` integer DEFAULT false NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `health_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`sleep_hours` real,
	`caffeine_mg` integer,
	`substances_notes` text,
	`screen_time_hours` real,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `health_logs_date_unique` ON `health_logs` (`date`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`category` text NOT NULL,
	`date` text NOT NULL,
	`notes` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `video_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`client_id` integer,
	`revisions_count` integer DEFAULT 0 NOT NULL,
	`delivered` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
