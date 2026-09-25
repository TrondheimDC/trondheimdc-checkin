CREATE TABLE `smooth_print_apks` (
	`id` text PRIMARY KEY NOT NULL,
	`original_name` text NOT NULL,
	`stored_name` text NOT NULL,
	`version_label` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`byte_size` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `smooth_print_apks_active_idx` ON `smooth_print_apks` (`active`);