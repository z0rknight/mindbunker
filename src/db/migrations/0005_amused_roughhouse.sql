CREATE TABLE `availability_windows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`weekday` integer NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`start_minute` integer NOT NULL,
	`end_minute` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `availability_windows_weekday_unique` ON `availability_windows` (`weekday`);--> statement-breakpoint
CREATE TABLE `booking_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`timezone` text DEFAULT 'America/Sao_Paulo' NOT NULL,
	`duration_minutes` integer DEFAULT 30 NOT NULL,
	`buffer_minutes` integer DEFAULT 15 NOT NULL,
	`minimum_notice_hours` integer DEFAULT 24 NOT NULL,
	`booking_horizon_days` integer DEFAULT 30 NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`invitation_id` integer NOT NULL,
	`provider` text DEFAULT 'mock' NOT NULL,
	`provider_event_id` text NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`slot_key` text,
	`visitor_timezone` text NOT NULL,
	`attendee_email` text NOT NULL,
	`cancelled_at` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invitation_id`) REFERENCES `gateway_invitations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_slot_key_unique` ON `bookings` (`slot_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_provider_event_id_unique` ON `bookings` (`provider_event_id`);--> statement-breakpoint
CREATE INDEX `bookings_client_created_idx` ON `bookings` (`client_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `bookings_invitation_created_idx` ON `bookings` (`invitation_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `bookings_status_starts_idx` ON `bookings` (`status`,`starts_at`);--> statement-breakpoint
INSERT INTO `booking_settings` (`id`, `enabled`, `timezone`, `duration_minutes`, `buffer_minutes`, `minimum_notice_hours`, `booking_horizon_days`) VALUES (1, 1, 'America/Sao_Paulo', 30, 15, 24, 30);--> statement-breakpoint
INSERT INTO `availability_windows` (`weekday`, `enabled`, `start_minute`, `end_minute`) VALUES
	(0, 0, 600, 1020),
	(1, 1, 600, 1020),
	(2, 1, 600, 1020),
	(3, 1, 600, 1020),
	(4, 1, 600, 1020),
	(5, 1, 600, 1020),
	(6, 0, 600, 1020);
