CREATE TABLE `auth_attempts` (
	`fingerprint` text PRIMARY KEY NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`window_started` integer NOT NULL,
	`blocked_until` integer
);
