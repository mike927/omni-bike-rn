CREATE TABLE `training_session_samples` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`recorded_at_ms` integer NOT NULL,
	`elapsed_seconds` integer NOT NULL,
	`speed_kmh` real NOT NULL,
	`cadence_rpm` integer NOT NULL,
	`power_watts` integer NOT NULL,
	`heart_rate_bpm` integer,
	`resistance_level` integer,
	`distance_meters` real
);
--> statement-breakpoint
CREATE INDEX `training_session_samples_session_recorded_at_idx` ON `training_session_samples` (`session_id`,`recorded_at_ms`);--> statement-breakpoint
CREATE UNIQUE INDEX `training_session_samples_session_sequence_idx` ON `training_session_samples` (`session_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `training_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`started_at_ms` integer NOT NULL,
	`ended_at_ms` integer,
	`elapsed_seconds` integer NOT NULL,
	`total_distance_meters` real NOT NULL,
	`total_calories_kcal` real NOT NULL,
	`current_speed_kmh` real NOT NULL,
	`current_cadence_rpm` integer NOT NULL,
	`current_power_watts` integer NOT NULL,
	`current_heart_rate_bpm` integer,
	`current_resistance_level` integer,
	`current_distance_meters` real,
	`saved_bike_id` text,
	`saved_bike_name` text,
	`saved_hr_id` text,
	`saved_hr_name` text,
	`upload_state` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `training_sessions_status_updated_at_idx` ON `training_sessions` (`status`,`updated_at_ms`);--> statement-breakpoint
CREATE INDEX `training_sessions_started_at_idx` ON `training_sessions` (`started_at_ms`);