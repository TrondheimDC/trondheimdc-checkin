CREATE TABLE `check_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attendee_id` text NOT NULL,
	`action` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`attendee_id`) REFERENCES `attendees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `check_events_attendee_idx` ON `check_events` (`attendee_id`);--> statement-breakpoint
ALTER TABLE `attendees` ADD `checked_in_at` text;