CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`original_note` text NOT NULL,
	`note` text NOT NULL,
	`details` text NOT NULL,
	`logged` integer DEFAULT false NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `entries_owner_created` ON `entries` (`user_id`,`created_at`);