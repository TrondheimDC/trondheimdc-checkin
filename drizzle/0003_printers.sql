CREATE TABLE `printers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`serial` text DEFAULT '' NOT NULL,
	`model` text DEFAULT 'QL-820NWBc' NOT NULL,
	`connect_type` text DEFAULT 'BT' NOT NULL,
	`created_at` text NOT NULL
);
