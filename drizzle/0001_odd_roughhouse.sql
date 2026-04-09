CREATE TABLE `session_provider_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`upload_state` text NOT NULL,
	`external_id` text,
	`error_message` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_provider_uploads_session_provider_idx` ON `session_provider_uploads` (`session_id`,`provider_id`);--> statement-breakpoint
CREATE INDEX `session_provider_uploads_state_idx` ON `session_provider_uploads` (`upload_state`);