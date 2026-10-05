-- Missing text is NULL, never ''. Blank values from earlier imports/corrections become NULL.
-- company_suggestion is new: filled by the next import.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_attendees` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`company` text,
	`role` text,
	`company_suggestion` text,
	`checked_in_at` text,
	`deleted_at` text,
	`name_override` text,
	`company_override` text,
	`role_override` text,
	`corrected_at` text
);
--> statement-breakpoint
INSERT INTO `__new_attendees`("id", "name", "company", "role", "company_suggestion", "checked_in_at", "deleted_at", "name_override", "company_override", "role_override", "corrected_at") SELECT "id", nullif(trim("name"), ''), nullif(trim("company"), ''), nullif(trim("role"), ''), NULL, "checked_in_at", "deleted_at", nullif(trim("name_override"), ''), nullif(trim("company_override"), ''), nullif(trim("role_override"), ''), "corrected_at" FROM `attendees`;--> statement-breakpoint
DROP TABLE `attendees`;--> statement-breakpoint
ALTER TABLE `__new_attendees` RENAME TO `attendees`;--> statement-breakpoint
PRAGMA foreign_keys=ON;